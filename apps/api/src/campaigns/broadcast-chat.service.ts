import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { BROADCAST_CHAT_LOOKBACK_DAYS, broadcastText, chatPhone, chatStatusFor } from './broadcast-chat.logic';

const TEMPLATE_CACHE_MS = 10 * 60_000;

/**
 * Shows broadcast messages in Chats. A broadcast message is added to a person's chat when they already have one (right
 * after it is sent) or as soon as they reply (above their reply), so agents always see what a customer is answering.
 * It never creates a chat: people who do not reply stay out of the Chats list (they are in the broadcast's Report).
 * Everything here is best-effort and never throws: showing a broadcast in Chats must never stop a send or a reply.
 */
@Injectable()
export class BroadcastChatService {
  private readonly logger = new Logger(BroadcastChatService.name);
  private templateCache = new Map<string, { body: string; at: number }>();

  constructor(
    private prisma: PrismaService,
    private templates: TemplatesService,
  ) {}

  /** Adds this number's recent broadcasts to its chat. Returns how many were added. */
  async addToChat(phone: string, opts: { conversationId?: string; bumpChat?: boolean } = {}): Promise<number> {
    try {
      const digits = chatPhone(phone);
      if (!digits) return 0;

      let conversationId = opts.conversationId;
      if (!conversationId) {
        const contact = await this.prisma.contact.findFirst({ where: { OR: [{ phone: digits }, { phone: `+${digits}` }] } });
        if (!contact) return 0;
        const conv = await this.prisma.conversation.findFirst({ where: { contactId: contact.id }, orderBy: { updatedAt: 'desc' } });
        if (!conv) return 0;
        conversationId = conv.id;
      }

      const since = new Date(Date.now() - BROADCAST_CHAT_LOOKBACK_DAYS * 86400000);
      const rows = await this.prisma.campaignRecipient.findMany({
        where: {
          phone: digits,
          metaMessageId: { not: null },
          OR: [{ sentAt: { gte: since } }, { sentAt: null, createdAt: { gte: since } }],
        },
        include: { campaign: { select: { id: true, name: true, segmentJson: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length === 0) return 0;

      const already = await this.prisma.message.findMany({
        where: { metaMessageId: { in: rows.map(r => r.metaMessageId!) } },
        select: { metaMessageId: true },
      });
      const shown = new Set(already.map(m => m.metaMessageId));

      let added = 0;
      for (const r of rows) {
        if (shown.has(r.metaMessageId)) continue;
        const seg = (r.campaign.segmentJson as any) || {};
        const templateName = String(seg.templateName || 'template');
        const body = await this.templateBody(templateName);
        await this.prisma.message.create({
          data: {
            conversationId,
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus[chatStatusFor(r.status)],
            metaMessageId: r.metaMessageId,
            templateId: templateName,
            errorCode: r.errorCode || undefined,
            createdAt: r.sentAt || r.createdAt,
            payloadJson: {
              body: broadcastText(body, { serverSend: !!seg.serverSend, name: r.displayName, templateName }),
              templateName,
              authorName: r.campaign.name,
              authorRoleLabel: 'Broadcast',
              broadcast: { campaignId: r.campaign.id, name: r.campaign.name },
            },
          },
        });
        added++;
      }

      // Like WhatsApp: a chat that just got a broadcast moves up. The 24-hour reply window is not touched: a template
      // does not open it.
      if (added > 0 && opts.bumpChat) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }).catch(() => null);
      }
      return added;
    } catch (e: any) {
      this.logger.warn(`Could not show broadcasts in the chat of +${chatPhone(phone)}: ${e?.message ?? e}`);
      return 0;
    }
  }

  private async templateBody(name: string): Promise<string> {
    const hit = this.templateCache.get(name);
    if (hit && Date.now() - hit.at < TEMPLATE_CACHE_MS) return hit.body;
    const all: any[] = await this.templates.findAll().catch(() => []);
    const now = Date.now();
    for (const t of all) if (t?.name) this.templateCache.set(t.name, { body: t.bodyJson?.body || '', at: now });
    if (!this.templateCache.has(name)) this.templateCache.set(name, { body: '', at: now });
    return this.templateCache.get(name)!.body;
  }
}
