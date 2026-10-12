import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { inviteStatus, inviteUsable, revokedToken } from './invite-status.logic';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.seedSuperAdmin();
  }

  /**
   * Seeds default Super Admin (admin@fgsnlive.com) on startup if not present or updates password.
   */
  async seedSuperAdmin() {
    const superAdminEmail = 'admin@fgsnlive.com';
    const passwordHash = await bcrypt.hash('FGSN@Admin2026!', 10);
    const existing = await this.prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existing) {
      await this.prisma.user.create({
        data: {
          email: superAdminEmail,
          passwordHash,
          name: 'FGSN Super Admin',
          role: Role.ADMIN,
          isSuperAdmin: true,
          status: 'ACTIVE',
        },
      });
      console.log(`[AuthService] Seeded default Super Admin: ${superAdminEmail}`);
    } else {
      await this.prisma.user.update({
        where: { email: superAdminEmail },
        data: {
          passwordHash,
          isSuperAdmin: true,
          role: Role.ADMIN,
          status: 'ACTIVE',
        },
      });
      console.log(`[AuthService] Updated Super Admin credentials for: ${superAdminEmail}`);
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email credentials or inactive account');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email credentials or password');
    }

    const payload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account not found or inactive');
    }
    return user;
  }

  async createInvite(inviterId: string, email: string, role: Role) {
    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } });
    if (!inviter || (inviter.role !== Role.ADMIN && !inviter.isSuperAdmin)) {
      throw new ForbiddenException('Only Administrators can invite team members');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already has an active account');
    }

    // A new invite replaces any older link still pending for this email, so only one link to an email ever works.
    await this.revokePendingInvitesFor(email, inviter, 'INVITE_REPLACED');

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await this.prisma.invite.create({
      data: {
        email,
        role,
        token,
        invitedById: inviterId,
        expiresAt,
      },
    });

    const mailResult = await this.mailService.sendInviteEmail({
      to: email,
      inviterName: inviter.name,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
    });

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
      emailSent: mailResult.sent,
      emailMessage: mailResult.message,
      inviteLink: mailResult.inviteLink,
    };
  }

  async validateInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { invitedBy: { select: { name: true, email: true } } },
    });

    if (!invite || !inviteUsable(invite)) {
      throw new BadRequestException('Invite link is invalid, expired, revoked, or has already been used');
    }

    return {
      email: invite.email,
      role: invite.role,
      invitedByName: invite.invitedBy.name,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(token: string, name: string, password: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || !inviteUsable(invite)) {
      throw new BadRequestException('Invite link is invalid, expired or revoked');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      throw new BadRequestException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        name,
        passwordHash,
        role: invite.role,
        isSuperAdmin: false,
        status: 'ACTIVE',
      },
    });

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    const payload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  async getTeamMembers() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteTeamMember(targetUserId: string, requesterId: string) {
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || (requester.role !== Role.ADMIN && !requester.isSuperAdmin)) {
      throw new ForbiddenException('Only Administrators can manage team access');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (target.isSuperAdmin) {
      throw new ForbiddenException('Cannot remove the primary Super Admin account');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'INACTIVE' },
    });
    // Any invite link still pending for this person stops working too. (Their open sessions end on their next
    // request: JwtStrategy only lets ACTIVE users through.)
    await this.revokePendingInvitesFor(target.email, requester, 'INVITE_REVOKED');
    await this.audit(requester, 'MEMBER_REMOVED', { userId: target.id, email: target.email, role: target.role });

    return { success: true };
  }

  // ---------------------------------------------------------------- invites: list and revoke

  /** Invites that were never accepted, newest first, with whether each link still works. Admins only. */
  async listInvites(requesterId: string) {
    await this.requireAdmin(requesterId);
    const rows = await this.prisma.invite.findMany({
      where: { usedAt: null },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const now = new Date();
    return rows.map(i => {
      const status = inviteStatus(i, now);
      return {
        id: i.id,
        email: i.email,
        role: i.role,
        invitedByName: i.invitedBy?.name || 'Unknown',
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        status,
        // The link is only handed back while it still works, so it can be copied and resent.
        token: status === 'PENDING' ? i.token : undefined,
      };
    });
  }

  /**
   * Revokes an invite: the link that was shared stops working immediately and for good (its secret is replaced). The
   * row is kept as a record, and the revoke is written to the audit log.
   */
  async revokeInvite(inviteId: string, requesterId: string) {
    const admin = await this.requireAdmin(requesterId);
    const invite = await this.prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invite not found');
    const status = inviteStatus(invite);
    if (status === 'ACCEPTED') {
      throw new BadRequestException('This invite was already accepted. Remove the person from Team members instead.');
    }
    if (status === 'REVOKED') return { success: true, status };

    await this.prisma.invite.update({ where: { id: invite.id }, data: { token: revokedToken(), expiresAt: new Date() } });
    await this.audit(admin, 'INVITE_REVOKED', { inviteId: invite.id, email: invite.email, role: invite.role });
    return { success: true, status: 'REVOKED' };
  }

  private async revokePendingInvitesFor(email: string, actor: { id: string; role: Role }, action: string) {
    const pending = await this.prisma.invite.findMany({ where: { email, usedAt: null } });
    for (const invite of pending) {
      if (inviteStatus(invite) !== 'PENDING') continue;
      await this.prisma.invite.update({ where: { id: invite.id }, data: { token: revokedToken(), expiresAt: new Date() } });
      await this.audit(actor, action, { inviteId: invite.id, email: invite.email, role: invite.role });
    }
  }

  private async requireAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE' || (user.role !== Role.ADMIN && !user.isSuperAdmin)) {
      throw new ForbiddenException('Only Administrators can manage team access');
    }
    return user;
  }

  /** Append-only record of who changed team access. Never blocks the change itself. */
  private async audit(actor: { id: string; role: Role }, action: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLogEntry
      .create({ data: { actorId: actor.id, actorRole: actor.role, action, metadataJson: metadata as any } })
      .catch(() => null);
  }
}
