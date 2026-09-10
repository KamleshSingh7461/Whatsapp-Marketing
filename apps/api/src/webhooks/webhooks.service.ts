import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

  async handleIncoming(payload: any): Promise<void> {
    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            await this.recordInboundMessage(message);
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

  private async recordInboundMessage(message: any) {
    const phone = String(message.from || '').replace(/[^0-9]/g, '');
    if (!phone) return;

    const contact = await this.prisma.contact.upsert({
      where: { phone },
      update: {
        optedIn: true,
        optedInAt: new Date(),
        displayName: message.profile?.name || undefined,
      },
      create: {
        phone,
        displayName: message.profile?.name || `+${phone}`,
        optedIn: true,
        optedInAt: new Date(),
        tags: ['WhatsApp Inbound'],
      },
    });

    const windowExpiresAt = new Date(Date.now() + SESSION_WINDOW_HOURS * 60 * 60 * 1000);
    const convId = `conv_${phone}`;
    
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { id: convId },
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
        data: { windowExpiresAt, updatedAt: new Date() },
      });
    }

    const textContent = 
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      message.caption ||
      (message.type ? `[${message.type.toUpperCase()} Message]` : 'Inbound WhatsApp message');

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.DELIVERED,
        metaMessageId: message.id,
        payloadJson: {
          body: textContent,
          raw: message,
        },
      },
    });

    this.logger.log(`Inbound message recorded from +${phone}: "${textContent}"`);
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
