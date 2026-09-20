import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  aggregatePeople,
  CallStatusValue,
  clampOverviewDays,
  countByStatus,
  validateCallUpdate,
} from './call-leads.logic';

const MAX_SHEET_ROWS = 5000;
const MAX_ACTIVITY_ROWS = 20000;
const RECENT_UPDATES = 50;
const HISTORY_ROWS = 100;

const contactSelect = { select: { id: true, displayName: true, phone: true, tags: true } } as const;

@Injectable()
export class CallLeadsService {
  private readonly logger = new Logger(CallLeadsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * A customer tapped a rule's button. The first tap puts them on the call sheet as "Call pending"; a later tap
   * only adds to the count and moves the "last tapped" time, so nobody is on the sheet twice and their status and
   * remarks are never reset.
   */
  async recordTap(a: { ruleId: string; contactId: string; templateName: string | null; buttonText: string }) {
    await this.prisma.callLead.upsert({
      where: { ruleId_contactId: { ruleId: a.ruleId, contactId: a.contactId } },
      create: { ruleId: a.ruleId, contactId: a.contactId, templateName: a.templateName, buttonText: a.buttonText },
      update: {
        lastTapAt: new Date(),
        tapCount: { increment: 1 },
        buttonText: a.buttonText,
        ...(a.templateName ? { templateName: a.templateName } : {}),
      },
    });
  }

  /** Counts per rule and status, for the rule cards and the sheet's tabs. */
  async countsByRule() {
    const rows = await this.prisma.callLead.groupBy({
      by: ['ruleId', 'callStatus'],
      _count: { _all: true },
      _max: { lastTapAt: true },
    });
    const out = new Map<string, { byStatus: Record<CallStatusValue, number>; total: number; lastTapAt: Date | null }>();
    for (const r of rows) {
      const cur = out.get(r.ruleId) ?? { byStatus: countByStatus([]), total: 0, lastTapAt: null };
      cur.byStatus[r.callStatus as CallStatusValue] += r._count._all;
      cur.total += r._count._all;
      const last = r._max.lastTapAt;
      if (last && (!cur.lastTapAt || last > cur.lastTapAt)) cur.lastTapAt = last;
      out.set(r.ruleId, cur);
    }
    return out;
  }

  /** Everyone on a rule's call sheet. `from` keeps only people who tapped since then. */
  async listForRule(ruleId: string, from?: Date) {
    const rows = await this.prisma.callLead.findMany({
      where: { ruleId, ...(from ? { lastTapAt: { gte: from } } : {}) },
      include: { contact: contactSelect },
      orderBy: { firstTapAt: 'asc' },
      take: MAX_SHEET_ROWS,
    });
    return rows.map(r => ({
      id: r.id,
      ruleId: r.ruleId,
      contact: r.contact,
      templateName: r.templateName,
      buttonText: r.buttonText,
      firstTapAt: r.firstTapAt,
      lastTapAt: r.lastTapAt,
      tapCount: r.tapCount,
      status: r.callStatus,
      remarks: r.remarks,
      updatedAt: r.statusUpdatedAt,
      updatedBy: r.statusUpdatedByName,
    }));
  }

  /** Records a status change with the remark and who made it, and moves the lead to the new status. */
  async update(leadId: string, body: unknown, user: AuthenticatedUser) {
    const lead = await this.prisma.callLead.findUnique({
      where: { id: leadId },
      select: { id: true, callStatus: true, remarks: true },
    });
    if (!lead) throw new NotFoundException('Lead not found.');

    const v = validateCallUpdate(body, { callStatus: lead.callStatus as CallStatusValue, remarks: lead.remarks });
    if (!v.ok) throw new BadRequestException(v.error);

    const actor = await this.actor(user);
    const now = new Date();
    const [, updated] = await this.prisma.$transaction([
      this.prisma.callLeadUpdate.create({
        data: { leadId, status: v.value.status, remarks: v.value.remarks, byUserId: actor.id, byName: actor.name, byRole: actor.role },
      }),
      this.prisma.callLead.update({
        where: { id: leadId },
        data: {
          callStatus: v.value.status,
          remarks: v.value.remarks,
          statusUpdatedAt: now,
          statusUpdatedById: actor.id,
          statusUpdatedByName: actor.name,
        },
      }),
    ]);
    this.logger.log(`Call lead ${leadId} set to ${v.value.status} by ${actor.name}.`);
    return { id: updated.id, status: updated.callStatus, remarks: updated.remarks, updatedAt: updated.statusUpdatedAt, updatedBy: updated.statusUpdatedByName };
  }

  /** The full trail of one lead, newest first. */
  async history(leadId: string) {
    const lead = await this.prisma.callLead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found.');
    const rows = await this.prisma.callLeadUpdate.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_ROWS,
    });
    return rows.map(r => ({ id: r.id, status: r.status, remarks: r.remarks, byName: r.byName, byRole: r.byRole, createdAt: r.createdAt }));
  }

  /**
   * What managers use to oversee the work: where every lead stands now, what each team member has done in the
   * period, and the latest updates with who made them.
   */
  async overview(daysInput?: unknown) {
    const days = clampOverviewDays(daysInput);
    const since = new Date(Date.now() - days * 86400000);

    const [updates, pipelineRows, recent] = await Promise.all([
      this.prisma.callLeadUpdate.findMany({
        where: { createdAt: { gte: since } },
        select: { byUserId: true, byName: true, byRole: true, status: true, leadId: true, createdAt: true },
        take: MAX_ACTIVITY_ROWS,
      }),
      this.prisma.callLead.groupBy({ by: ['callStatus'], _count: { _all: true } }),
      this.prisma.callLeadUpdate.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_UPDATES,
        include: { lead: { select: { id: true, rule: { select: { id: true, name: true } }, contact: { select: { displayName: true, phone: true } } } } },
      }),
    ]);

    return {
      days,
      since,
      people: aggregatePeople(updates as any),
      pipeline: countByStatus(pipelineRows.map(r => ({ status: r.callStatus as CallStatusValue, count: r._count._all }))),
      recent: recent.map(r => ({
        id: r.id,
        at: r.createdAt,
        status: r.status,
        remarks: r.remarks,
        byName: r.byName,
        byRole: r.byRole,
        leadId: r.leadId,
        ruleName: r.lead?.rule?.name ?? '',
        contactName: r.lead?.contact?.displayName ?? '',
        phone: r.lead?.contact?.phone ?? '',
      })),
    };
  }

  /** Name and role as they are now; falls back to what the login token says if the account cannot be read. */
  private async actor(user: AuthenticatedUser): Promise<{ id: string; name: string; role: Role }> {
    const u = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, role: true } });
    return { id: user.userId, name: u?.name || 'Unknown user', role: (u?.role as Role) || user.role };
  }
}
