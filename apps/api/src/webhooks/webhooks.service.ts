import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_WINDOW_HOURS = 24;

/**
 * Handles the payload shape Meta sends to a WABA webhook subscription:
 * entry[].changes[].value.{messages[], statuses[], metadata}.
 * This is the Phase 1 skeleton from §08/§13 of the plan — inbound-only,
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
        if (!value?.metadata?.phone_number_id) continue;

        const waba = await this.prisma.wabaConnection.findUnique({
          where: { phoneNumberId: value.metadata.phone_number_id },
        });
        if (!waba) {
          this.logger.warn(`No WABA registered for phone_number_id=${value.metadata.phone_number_id}`);
          continue;
        }

        for (const message of value.messages ?? []) {
          await this.recordInboundMessage(waba.companyId, message);
        }
        for (const status of value.statuses ?? []) {
          await this.recordStatusUpdate(status);
        }
      }
    }
  }

  private async recordInboundMessage(companyId: string, message: any) {
    const contact = await this.prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone: message.from } },
      update: {},
      create: { companyId, phone: message.from },
    });

    const windowExpiresAt = new Date(Date.now() + SESSION_WINDOW_HOURS * 60 * 60 * 1000);
    const conversation = await this.prisma.conversation.create({
      data: { companyId, contactId: contact.id, windowExpiresAt },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.DELIVERED,
        metaMessageId: message.id,
        payloadJson: message,
      },
    });
  }

  private async recordStatusUpdate(status: any) {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };
    const mapped = statusMap[status.status];
    if (!mapped) return;

    await this.prisma.message.updateMany({
      where: { metaMessageId: status.id },
      data: {
        status: mapped,
        errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : undefined,
      },
    });
  }
}
