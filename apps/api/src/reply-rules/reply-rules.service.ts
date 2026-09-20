import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappIntegrationService } from '../whatsapp-integration/whatsapp-integration.service';
import { CallLeadsService } from './call-leads.service';
import {
  buttonMatches,
  extractButtonTap,
  mergeTags,
  pickMatchingRules,
  RuleLike,
  validateRuleInput,
} from './reply-rules.logic';

/** When a tap has no `context` (rare), look for the template we most recently sent this person. */
const RECENT_TEMPLATE_DAYS = 14;

@Injectable()
export class ReplyRulesService {
  private readonly logger = new Logger(ReplyRulesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappIntegrationService,
    private callLeads: CallLeadsService,
  ) {}

  // ------------------------------------------------------------------ rules (for the Automations page)

  async list() {
    const [rules, counts] = await Promise.all([
      this.prisma.replyRule.findMany({ orderBy: { createdAt: 'asc' } }),
      this.callLeads.countsByRule(),
    ]);
    return rules.map(r => {
      const c = counts.get(r.id);
      return {
        ...r,
        // People on this rule's call sheet (one per person), and how far along the calls are.
        leadCount: c?.total ?? 0,
        lastLeadAt: c?.lastTapAt ?? null,
        callStatusCounts: c?.byStatus ?? { CALL_PENDING: 0, CALLED_NOT_PICKED: 0, CALL_DONE: 0, FOLLOW_UP_PENDING: 0 },
      };
    });
  }

  async create(body: unknown) {
    const v = validateRuleInput(body);
    if (!v.ok) throw new BadRequestException(v.error);
    const d = v.value;
    return this.prisma.replyRule.create({
      data: {
        name: d.name!,
        templateName: d.templateName ?? null,
        buttonText: d.buttonText!,
        tags: d.tags ?? [],
        replyText: d.replyText ?? null,
        active: d.active ?? true,
      },
    });
  }

  async update(id: string, body: unknown) {
    await this.mustExist(id);
    const v = validateRuleInput(body, true);
    if (!v.ok) throw new BadRequestException(v.error);
    return this.prisma.replyRule.update({ where: { id }, data: v.value });
  }

  /**
   * A rule that has already collected leads is kept, so the call sheet stays complete. Pause it instead.
   */
  async remove(id: string) {
    await this.mustExist(id);
    const leads = await this.prisma.replyLead.count({ where: { ruleId: id } });
    if (leads > 0) {
      throw new ConflictException('This rule already has leads, so it cannot be deleted. Pause it instead.');
    }
    await this.prisma.replyRule.delete({ where: { id } });
    return { ok: true };
  }

  /** A rule's call sheet: one row per person, with their call status and remarks. */
  async leads(id: string, from?: string) {
    await this.mustExist(id);
    return this.callLeads.listForRule(id, from ? this.parseDate(from, 'from') : undefined);
  }

  // ------------------------------------------------------------------ the webhook hook

  /**
   * Called for every inbound customer message. Does nothing unless it is a tap on a template button that an
   * active rule covers. Safe to call twice for the same message (Meta retries webhooks): the first call records
   * the tap, tags the contact and sends the reply; later calls find the record and stop.
   */
  async handleInbound(args: { message: any; contactId: string; phone: string; conversationId: string }) {
    const tap = extractButtonTap(args.message);
    if (!tap) return;

    const wamid = typeof args.message?.id === 'string' ? args.message.id : '';
    if (!wamid) {
      this.logger.warn('Button tap without a message id was ignored (cannot be de-duplicated).');
      return;
    }

    const active = await this.prisma.replyRule.findMany({ where: { active: true } });
    if (active.length === 0) return;

    // Cheap check first, so an unrelated tap (for example an unsubscribe button) costs no template lookups.
    const forThisButton = active.filter(r => buttonMatches(r, tap.labels));
    if (forThisButton.length === 0) return;

    const templateName = await this.resolveTemplateName(tap.contextMessageId, args.phone, args.conversationId);
    const matched = pickMatchingRules(forThisButton, templateName, tap.labels);
    if (matched.length === 0) return;

    const tapped = tap.labels[0];
    const recorded: RuleLike[] = [];
    for (const rule of matched) {
      try {
        await this.prisma.replyLead.create({
          data: { ruleId: rule.id, contactId: args.contactId, metaMessageId: wamid, templateName, buttonText: tapped },
        });
        recorded.push(rule);
        try {
          await this.callLeads.recordTap({ ruleId: rule.id, contactId: args.contactId, templateName, buttonText: tapped });
        } catch (e: any) {
          // The tap itself is already recorded; a call-sheet problem must not stop the tags and the reply.
          this.logger.warn(`Could not add ${args.contactId} to the call sheet of rule ${rule.id}: ${e?.message ?? e}`);
        }
      } catch (e: any) {
        if (e?.code === 'P2002') continue; // already handled: this webhook is a retry
        throw e;
      }
    }
    if (recorded.length === 0) return;

    const contact = await this.prisma.contact.findUnique({ where: { id: args.contactId }, select: { tags: true } });
    const tags = mergeTags(contact?.tags, recorded.flatMap(r => r.tags));
    await this.prisma.contact.update({ where: { id: args.contactId }, data: { tags } });

    // One automatic reply per tap, even if several rules matched.
    const withReply = recorded.find(r => r.replyText);
    if (withReply?.replyText) {
      await this.sendReply(args.phone, args.conversationId, withReply.replyText, withReply.name);
    }
    this.logger.log(
      `Button "${tapped}" from +${args.phone} (template: ${templateName ?? 'unknown'}) handled by ${recorded.length} rule(s).`,
    );
  }

  // ------------------------------------------------------------------ helpers

  private async mustExist(id: string) {
    const rule = await this.prisma.replyRule.findUnique({ where: { id }, select: { id: true } });
    if (!rule) throw new NotFoundException('Reply rule not found.');
  }

  private parseDate(value: string, label: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`The "${label}" date is not valid.`);
    return d;
  }

  /**
   * Works out which template the customer replied to.
   *  - Normally Meta tells us the id of the message that held the button (`context.id`). That message is either
   *    a broadcast recipient (campaign) or a message sent from a chat, so we look in both.
   *  - If Meta gave no context at all, use the template we most recently sent this person.
   *  - If Meta gave a context we cannot find (sent from somewhere else, such as WhatsApp Manager), the template
   *    is unknown: only "any template" rules can match, which is the safe choice.
   */
  private async resolveTemplateName(contextId: string | undefined, phone: string, conversationId: string): Promise<string | null> {
    if (contextId) {
      const recipient = await this.prisma.campaignRecipient.findFirst({
        where: { metaMessageId: contextId },
        include: { campaign: { include: { template: true } } },
      });
      if (recipient) return this.campaignTemplateName(recipient.campaign);

      const message = await this.prisma.message.findFirst({ where: { metaMessageId: contextId } });
      if (message) return this.messageTemplateName(message);
      return null;
    }

    const since = new Date(Date.now() - RECENT_TEMPLATE_DAYS * 86400000);
    const phones = [phone, `+${phone}`];
    const [recipient, message] = await Promise.all([
      this.prisma.campaignRecipient.findFirst({
        where: { phone: { in: phones }, status: { in: ['SENT', 'DELIVERED', 'READ'] }, sentAt: { gte: since } },
        orderBy: { sentAt: 'desc' },
        include: { campaign: { include: { template: true } } },
      }),
      this.prisma.message.findFirst({
        where: { conversationId, direction: MessageDirection.OUTBOUND, createdAt: { gte: since }, templateId: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const recipientAt = recipient?.sentAt?.getTime() ?? 0;
    const messageAt = message?.createdAt.getTime() ?? 0;
    if (recipient && recipientAt >= messageAt) return this.campaignTemplateName(recipient.campaign);
    if (message) return this.messageTemplateName(message);
    return null;
  }

  private campaignTemplateName(campaign: { segmentJson: unknown; template: { name: string } | null }): string | null {
    return ((campaign.segmentJson as any)?.templateName as string | undefined) || campaign.template?.name || null;
  }

  private async messageTemplateName(message: { templateId: string | null; payloadJson: unknown }): Promise<string | null> {
    const p: any = message.payloadJson || {};
    const direct = p.templateData?.name || p.templateName;
    if (direct) return String(direct);
    if (!message.templateId) return null;
    const template = await this.prisma.template.findUnique({ where: { id: message.templateId }, select: { name: true } });
    return template?.name ?? message.templateId; // older rows stored the template name itself in templateId
  }

  /** Sends the reply as a normal message (allowed: the customer's tap just opened the 24-hour window). */
  private async sendReply(phone: string, conversationId: string, text: string, ruleName: string) {
    try {
      const res: any = await this.whatsapp.sendTextMessage({ to: phone, text });
      if (!res?.success) {
        this.logger.warn(`Automatic reply for rule "${ruleName}" was not sent: ${res?.error ?? 'unknown error'}`);
        return;
      }
      await this.prisma.message.create({
        data: {
          conversationId,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.SENT,
          metaMessageId: res.messageId ? String(res.messageId) : undefined,
          payloadJson: { body: text, authorName: 'FGSN Auto-Reply Bot', automation: ruleName },
        },
      });
    } catch (e: any) {
      this.logger.warn(`Automatic reply for rule "${ruleName}" failed: ${e?.message ?? e}`);
    }
  }
}
