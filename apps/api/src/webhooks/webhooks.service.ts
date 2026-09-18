import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappIntegrationService } from '../whatsapp-integration/whatsapp-integration.service';

const SESSION_WINDOW_HOURS = 24;

/**
 * Handles the payload shape Meta sends to the WABA webhook subscription:
 * entry[].changes[].value.{messages[], statuses[], metadata}.
 * This is the Phase 1 skeleton from §08/§12 of the plan — inbound-only,
 * synchronous. Move to a queue (BullMQ, per §10) once volume needs it.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappIntegrationService,
  ) {}

  async handleIncoming(payload: any): Promise<void> {
    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const contactsList = value.contacts || [];
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            await this.recordInboundMessage(message, contactsList);
          }
        }

        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            await this.recordStatusUpdate(status);
          }
        }
      }
    }
  }

  private async currentPhoneNumberId(): Promise<string | undefined> {
    const waba = await this.prisma.wabaConnection.findFirst();
    return waba?.phoneNumberId;
  }

  private async recordInboundMessage(message: any, contactsList: any[] = []) {
    const rawFrom = String(message.from || '').replace(/[^0-9]/g, '');
    if (!rawFrom) return;
    const phone = rawFrom.length === 10 ? '91' + rawFrom : rawFrom;
    const phoneWithPlus = '+' + phone;

    // In Meta's official API specification, the WhatsApp user's profile name is sent in value.contacts[].profile.name
    const matchedMetaContact = contactsList.find((c: any) => {
      const waId = String(c.wa_id || '').replace(/[^0-9]/g, '');
      return waId === rawFrom || waId === phone;
    });
    const metaProfileName = matchedMetaContact?.profile?.name || message.profile?.name;

    let contact = await this.prisma.contact.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: phoneWithPlus },
        ],
      },
    });

    if (contact) {
      const newDisplayName = (metaProfileName && !metaProfileName.startsWith('+')) ? metaProfileName : contact.displayName;
      if (contact.phone !== phone || (metaProfileName && contact.displayName !== metaProfileName)) {
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: {
            phone: phone,
            displayName: newDisplayName,
            optedIn: true,
            optedInAt: new Date(),
          },
        }).catch(() => contact);
      }
    } else {
      contact = await this.prisma.contact.create({
        data: {
          phone,
          displayName: metaProfileName || `+${phone}`,
          optedIn: true,
          optedInAt: new Date(),
          tags: ['WhatsApp Inbound'],
        },
      });
    }

    if (!contact) return;

    const windowExpiresAt = new Date(Date.now() + SESSION_WINDOW_HOURS * 60 * 60 * 1000);
    const convId = `conv_${phone}`;
    const altConvId = `conv_${phoneWithPlus}`;
    
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { id: convId },
          { id: altConvId },
          { contactId: contact.id },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          id: convId,
          contactId: contact.id,
          windowExpiresAt,
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { contactId: contact.id, windowExpiresAt, updatedAt: new Date() },
      });
    }

    const rawText = 
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      message.caption ||
      (message.type ? `[${message.type.toUpperCase()} Message]` : 'Inbound WhatsApp message');

    const textContent = String(rawText).trim();

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.DELIVERED,
        metaMessageId: message.id,
        payloadJson: {
          body: textContent,
          authorName: contact.displayName || metaProfileName || 'Customer',
          raw: message,
        },
      },
    });

    this.logger.log(`Inbound message recorded from +${phone}: "${textContent}"`);

    // Predefined "Yes" Auto-Response & Hot Lead Tagging Logic
    const cleanLower = textContent.toLowerCase();
    const isYesReply =
      cleanLower === 'yes' ||
      cleanLower.startsWith('yes ') ||
      cleanLower.endsWith(' yes') ||
      cleanLower === 'yes!' ||
      cleanLower === 'yess' ||
      cleanLower === 'yeah';

    if (isYesReply) {
      // 1. Tag contact as "Hot Lead - Yes Opt-In"
      const existingTags = contact.tags || [];
      const updatedTags = Array.from(new Set([...existingTags, 'Hot Lead - Yes Opt-In', 'Hot Lead']));
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { tags: updatedTags },
      });

      // 2. Dispatch automated WhatsApp response
      const autoReplyText = `Alright, let’s say it’s time for you to get started. \nOur student subject matter expert will call you shortly do you have a preferred time that we can connect?`;

      try {
        await this.whatsappService.sendTextMessage({
          to: phone,
          text: autoReplyText,
        });
      } catch (err: any) {
        this.logger.warn(`Auto-reply dispatch exception to +${phone}: ${err.message}`);
      }

      // 3. Record outbound automated response in conversation thread
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.DELIVERED,
          payloadJson: {
            body: autoReplyText,
            authorName: 'FGSN Auto-Reply Bot',
          },
        },
      });

      this.logger.log(`Dispatched YES auto-reply to +${phone} and tagged as 'Hot Lead - Yes Opt-In'`);
    }
  }

  private async recordStatusUpdate(status: any) {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };
    const mapped = statusMap[status.status];
    
    if (status.errors && status.errors.length > 0) {
      const err = status.errors[0];
      this.logger.error(`Meta Webhook Delivery Failure for WAMID ${status.id} to recipient ${status.recipient_id}: Code ${err.code} - ${err.title} (${err.message || err.error_data?.details || 'Unknown error'})`);
    } else {
      this.logger.log(`Meta Webhook Status Update: WAMID ${status.id} is '${status.status}' for recipient ${status.recipient_id}`);
    }

    if (!mapped) return;

    try {
      await this.prisma.message.updateMany({
        where: { metaMessageId: status.id },
        data: {
          status: mapped,
          errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : undefined,
        },
      });
    } catch (e) {
      // ignore
    }
  }
}
