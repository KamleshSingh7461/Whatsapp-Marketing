import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { REST_DAYS, isBlockingCode, nextMetaDelivery, shouldClearOnDelivery } from './delivery-blocks.logic';

/**
 * Remembers on a contact that Meta refused to deliver to them, so broadcasts skip them for a while.
 * Fed by Meta's delivery-status webhook. See delivery-blocks.logic.ts for the rules.
 *
 * Optional setting: META_REST_DAYS (1 to 365) changes the rest after a marketing hold-back (131049 and 130472).
 */
@Injectable()
export class DeliveryBlocksService {
  private readonly logger = new Logger(DeliveryBlocksService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private restDays(): Record<string, number> {
    const n = Number(this.config.get<string>('META_REST_DAYS'));
    if (!Number.isInteger(n) || n < 1 || n > 365) return REST_DAYS;
    return { ...REST_DAYS, '131049': n, '130472': n };
  }

  /** Same phone lookup the inbound handler uses: digits with the country code, with or without a leading +. */
  private async findContact(recipientId: unknown) {
    const digits = String(recipientId ?? '').replace(/\D/g, '');
    if (!digits) return null;
    return this.prisma.contact.findFirst({
      where: { OR: [{ phone: digits }, { phone: `+${digits}` }] },
      select: { id: true, phone: true, attributes: true },
    });
  }

  /** Call for every delivery-status update Meta sends. Never throws into the caller's flow: it is best-effort. */
  async onStatus(status: any): Promise<void> {
    const err = status?.errors?.[0];
    const code = err?.code;

    if (err && isBlockingCode(code)) {
      const contact = await this.findContact(status.recipient_id);
      if (!contact) return;
      const next = nextMetaDelivery((contact.attributes as any)?.metaDelivery, code, status.id, new Date(), this.restDays());
      if (!next) return; // a repeat of the same notice
      // jsonb_set changes only this one key, so anything else stored on the contact is left exactly as it was.
      await this.prisma.$executeRaw`
        UPDATE "Contact"
        SET "attributes" = jsonb_set(COALESCE("attributes", '{}'::jsonb), '{metaDelivery}', ${JSON.stringify(next)}::jsonb, true)
        WHERE "id" = ${contact.id}`;
      this.logger.warn(`Meta refused delivery to +${contact.phone.replace(/\D/g, '')} (code ${next.code}); broadcasts will skip them until ${next.until}.`);
      return;
    }

    if (!err && (status?.status === 'delivered' || status?.status === 'read')) {
      const contact = await this.findContact(status.recipient_id);
      if (!contact || !shouldClearOnDelivery(contact.attributes)) return;
      await this.prisma.$executeRaw`
        UPDATE "Contact" SET "attributes" = "attributes" - 'metaDelivery' WHERE "id" = ${contact.id}`;
      this.logger.log(`A message reached +${contact.phone.replace(/\D/g, '')}, so their "undeliverable" mark was cleared.`);
    }
  }
}
