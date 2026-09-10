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
   * Seeds default Super Admin (admin@fgsnlive.com) on startup if not present.
   */
  async seedSuperAdmin() {
    const superAdminEmail = 'admin@fgsnlive.com';
    const existing = await this.prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash('Admin@fgsn2026!', 10);
      await this.prisma.user.create({
        data: {
          email: superAdminEmail,
          passwordHash,
          name: 'Super Admin',
          role: Role.ADMIN,
          isSuperAdmin: true,
          status: 'ACTIVE',
        },
      });
      console.log(`[AuthService] Seeded default Super Admin: ${superAdminEmail}`);
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

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite link is invalid, expired, or has already been used');
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
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite link is invalid or expired');
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

    return { success: true };
  }
}
