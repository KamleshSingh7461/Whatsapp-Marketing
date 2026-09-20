import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ReplyRulesService } from '../reply-rules/reply-rules.service';
import { DeliveryBlocksService } from '../delivery-blocks/delivery-blocks.service';

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
    private campaigns: CampaignsService,
    private replyRules: ReplyRulesService,
    private deliveryBlocks: DeliveryBlocksService,
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

    const isImage = message.type === 'image' || !!message.image;
    const mediaUrl = isImage && message.image?.id ? `/api/whatsapp/media/${message.image.id}` : undefined;

    const rawText = 
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      message.image?.caption ||
      message.caption ||
      (isImage ? 'Image attachment' : (message.type ? `[${message.type.toUpperCase()} Message]` : 'Inbound WhatsApp message'));

    const textContent = String(rawText).trim();

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.DELIVERED,
        metaMessageId: message.id,
        payloadJson: {
          body: textContent,
          mediaUrl: mediaUrl,
          mediaType: isImage ? 'image' : undefined,
          authorName: contact.displayName || metaProfileName || 'Customer',
          raw: message,
        },
      },
    });

    this.logger.log(`Inbound message recorded from +${phone}: "${textContent}"`);

    // A customer tapping a button on one of our templates: apply any matching reply rule (tag the contact,
    // send the automatic reply, record them for the call sheet). Rules are set up on the Automations page.
    // Kept in its own try/catch so a problem here can never stop the message above from being recorded.
    try {
      await this.replyRules.handleInbound({
        message,
        contactId: contact.id,
        phone,
        conversationId: conversation.id,
      });
    } catch (e: any) {
      this.logger.warn(`Reply rules could not process message ${message.id}: ${e?.message ?? e}`);
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

    // Remember people Meta will not deliver to, so broadcasts skip them for a while. Best-effort and kept in its
    // own try/catch: a problem here must never stop the status handling below.
    try {
      await this.deliveryBlocks.onStatus(status);
    } catch (e: any) {
      this.logger.warn(`Could not record the delivery refusal for ${status?.recipient_id}: ${e?.message ?? e}`);
    }

    if (!mapped) return;

    // Broadcast recipients: advance the matching CampaignRecipient (no-op for ordinary chat messages).
    // Kept in its own try/catch so a problem here can never stop the chat status update below.
    try {
      const err = status.errors?.[0];
      await this.campaigns.applyDeliveryStatus(status.id, status.status, err
        ? { code: err.code, message: err.message || err.title || err.error_data?.details }
        : undefined);
    } catch (e: any) {
      this.logger.warn(`Could not apply delivery status to campaign recipient ${status.id}: ${e?.message ?? e}`);
    }

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
