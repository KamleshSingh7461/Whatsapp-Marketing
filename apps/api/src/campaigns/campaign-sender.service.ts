import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappIntegrationService } from '../whatsapp-integration/whatsapp-integration.service';
import { refreshCampaignStats } from './campaign-progress';

const TICK_MS = 500;
const CONCURRENCY = 5;
const DEFAULT_MSGS_PER_SEC = 10;
const MAX_MSGS_PER_SEC = 40;

// Meta error codes that mean "slow down", not "this recipient is bad". The message goes back to
// the queue and the whole worker backs off, instead of burning through the audience as failures.
const THROTTLE_CODES = new Set([4, 17, 80007, 130429]);

// Messaging tier -> unique recipients per rolling 24h.
const TIER_LIMITS: Record<string, number> = {
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  UNLIMITED: Number.MAX_SAFE_INTEGER,
};
const FALLBACK_DAILY_LIMIT = 1000;

interface ClaimedRow {
  id: string;
  phone: string;
  displayName: string | null;
  attempts: number;
}

type SendOutcome =
  | { ok: true; wamid: string }
  | { ok: false; code: string; message: string; throttled: boolean };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Name to put in {{1}}: never a phone-number placeholder, and safe for Meta's parameter rules. */
export function greetingName(displayName: string | null | undefined): string {
  const cleaned = String(displayName ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 60);
  if (!cleaned || cleaned.startsWith('+') || /^[\d\s()-]{6,}$/.test(cleaned)) return 'there';
  return cleaned;
}

/**
 * Durable server-side broadcast sender.
 *
 * Every recipient of a server-sent campaign is a CampaignRecipient row. This worker claims QUEUED
 * rows in small batches (FOR UPDATE SKIP LOCKED), sends them at a controlled pace and records the
 * outcome on the row. All state lives in the database, so a restart or crash loses nothing.
 *
 * Delivery guarantees, deliberately conservative for marketing messages:
 *  - at-most-once: a row is marked SENDING before Meta is called. If the process dies in between,
 *    the outcome is unknown, so the row is marked FAILED/INTERRUPTED and is NOT retried automatically.
 *    A duplicate marketing message is worse than a missed one; an admin can retry explicitly.
 *  - opt-in only, decided when the campaign is launched.
 *
 * OFF by default. Enable with BROADCAST_WORKER=on. BROADCAST_SENDER=stub swaps the Meta call for a
 * simulator so the whole pipeline can be exercised without sending any real message.
 * Assumes a single API instance.
 */
@Injectable()
export class CampaignSenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CampaignSender');

  enabled = false;
  stub = false;

  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private stopping = false;
  private backoffUntil = 0;
  private limitCache: { value: number; at: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private whatsapp: WhatsappIntegrationService,
  ) {}

  private get msgsPerSecond(): number {
    const n = Number(this.config.get('BROADCAST_MSGS_PER_SEC'));
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_MSGS_PER_SEC) : DEFAULT_MSGS_PER_SEC;
  }

  async onModuleInit() {
    this.stub = this.config.get<string>('BROADCAST_SENDER') === 'stub';
    if (this.stub && this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error('BROADCAST_SENDER=stub must never be enabled in production');
    }

    this.enabled = this.config.get<string>('BROADCAST_WORKER') === 'on';
    if (!this.enabled) {
      this.logger.log('Server-side broadcast sending is OFF (set BROADCAST_WORKER=on to enable). Browser-side sending stays in use.');
      return;
    }

    if (this.stub) this.logger.warn('STUB SENDER ACTIVE: no WhatsApp messages will actually be sent.');

    try {
      await this.recoverInterrupted();
    } catch (e: any) {
      this.logger.warn(`Could not recover interrupted sends at startup: ${e?.message ?? e}`);
    }

    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Broadcast worker started (max ${this.msgsPerSecond} messages/sec).`);
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    // Let an in-flight batch finish so we do not strand rows in SENDING.
    for (let i = 0; i < 40 && this.busy; i++) await sleep(250);
  }

  /** Rows still SENDING at startup were interrupted mid-flight: outcome unknown, never auto-retried. */
  private async recoverInterrupted() {
    const r = await this.prisma.campaignRecipient.updateMany({
      where: { status: 'SENDING' },
      data: {
        status: 'FAILED',
        errorCode: 'INTERRUPTED',
        errorMessage:
          'The server stopped while this message was being sent. It may or may not have been delivered, so it was not retried automatically.',
      },
    });
    if (r.count > 0) this.logger.warn(`${r.count} interrupted send(s) marked FAILED (INTERRUPTED); not retried automatically.`);
  }

  private async tick() {
    if (this.busy || this.stopping || Date.now() < this.backoffUntil) return;
    this.busy = true;
    try {
      await this.processOnce();
    } catch (e: any) {
      this.logger.error(`Worker tick failed: ${e?.message ?? e}`);
    } finally {
      this.busy = false;
    }
  }

  private async processOnce() {
    const started = Date.now();

    const campaign = await this.prisma.campaign.findFirst({
      where: { status: 'SENDING', segmentJson: { path: ['serverSend'], equals: true } },
      orderBy: { createdAt: 'asc' },
    });
    if (!campaign) return;

    const allowance = await this.remainingDailyAllowance();
    if (allowance <= 0) {
      if (campaign.pauseReason !== 'DAILY_LIMIT') {
        await this.prisma.campaign.update({ where: { id: campaign.id }, data: { pauseReason: 'DAILY_LIMIT' } });
        this.logger.warn(`Campaign ${campaign.id} is waiting: daily messaging limit reached.`);
      }
      this.backoffUntil = Date.now() + 60_000;
      return;
    }
    if (campaign.pauseReason === 'DAILY_LIMIT') {
      await this.prisma.campaign.update({ where: { id: campaign.id }, data: { pauseReason: null } });
    }

    const claimed = await this.claim(campaign.id, Math.min(this.msgsPerSecond, allowance));
    if (claimed.length === 0) {
      await this.finishIfDone(campaign);
      return;
    }

    let throttled = false;
    for (let i = 0; i < claimed.length; i += CONCURRENCY) {
      const slice = claimed.slice(i, i + CONCURRENCY);

      if (throttled) {
        await this.requeue(slice.map(r => r.id));
        continue;
      }

      const outcomes = await Promise.all(slice.map(r => this.sendOne(campaign, r)));
      for (let j = 0; j < slice.length; j++) {
        const row = slice[j];
        const outcome = outcomes[j];
        if (outcome.ok) {
          await this.prisma.campaignRecipient.updateMany({
            where: { id: row.id, status: 'SENDING' },
            data: { status: 'SENT', metaMessageId: outcome.wamid, sentAt: new Date(), errorCode: null, errorMessage: null },
          });
        } else if (outcome.throttled) {
          throttled = true;
          await this.requeue([row.id]);
        } else {
          await this.prisma.campaignRecipient.updateMany({
            where: { id: row.id, status: 'SENDING' },
            data: { status: 'FAILED', errorCode: outcome.code, errorMessage: outcome.message },
          });
        }
      }
    }

    if (throttled) {
      this.backoffUntil = Date.now() + 30_000;
      this.logger.warn('Meta is throttling requests; backing off for 30s. Nothing was lost: unsent recipients stay queued.');
    }

    await refreshCampaignStats(this.prisma, campaign);

    // Pace to at most msgsPerSecond.
    const elapsed = Date.now() - started;
    if (elapsed < 1000) await sleep(1000 - elapsed);
  }

  private async claim(campaignId: string, limit: number): Promise<ClaimedRow[]> {
    return this.prisma.$queryRaw<ClaimedRow[]>(Prisma.sql`
      UPDATE "CampaignRecipient"
      SET "status" = 'SENDING'::"RecipientStatus", "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" IN (
        SELECT "id" FROM "CampaignRecipient"
        WHERE "campaignId" = ${campaignId} AND "status" = 'QUEUED'::"RecipientStatus"
        ORDER BY "createdAt", "id"
        LIMIT ${limit}::int
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "phone", "displayName", "attempts"
    `);
  }

  private async requeue(ids: string[]) {
    if (ids.length === 0) return;
    await this.prisma.campaignRecipient.updateMany({
      where: { id: { in: ids }, status: 'SENDING' },
      data: { status: 'QUEUED', attempts: { decrement: 1 } },
    });
  }

  private async finishIfDone(campaign: { id: string; stats: unknown; segmentJson: unknown }) {
    const open = await this.prisma.campaignRecipient.count({
      where: { campaignId: campaign.id, status: { in: ['QUEUED', 'SENDING'] } },
    });
    if (open > 0) return;

    const p = await refreshCampaignStats(this.prisma, campaign);
    // updateMany + status guard: a cancel that landed a moment ago must not be overwritten.
    await this.prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'SENDING' },
      data: { status: p.accepted > 0 ? 'COMPLETED' : 'FAILED', completedAt: new Date(), pauseReason: null },
    });
    this.logger.log(`Campaign ${campaign.id} finished: ${p.accepted} accepted by Meta, ${p.failed} failed of ${p.total}.`);
  }

  private async sendOne(campaign: { segmentJson: unknown }, row: ClaimedRow): Promise<SendOutcome> {
    if (this.stub) return this.stubSend(row.phone);

    const seg = (campaign.segmentJson as any) || {};
    const components = seg.usesName
      ? [{ type: 'body', parameters: [{ type: 'text', text: greetingName(row.displayName) }] }]
      : undefined;

    const res: any = await this.whatsapp.sendTemplateMessage({
      to: row.phone,
      templateName: seg.templateName,
      language: seg.language,
      components,
    });

    if (res?.success) return { ok: true, wamid: String(res.messageId) };

    const metaCode = res?.metaResponse?.error?.code ?? res?.metaResponse?.error?.error_subcode;
    return {
      ok: false,
      code: String(metaCode ?? 'SEND_FAILED'),
      message: String(res?.error ?? 'Send failed').slice(0, 500),
      throttled: THROTTLE_CODES.has(Number(metaCode)),
    };
  }

  /** Simulator: numbers ending in 0 fail, everything else "succeeds". Never touches the network. */
  private async stubSend(phone: string): Promise<SendOutcome> {
    await sleep(20 + Math.floor(Math.random() * 80));
    if (phone.endsWith('0')) {
      return { ok: false, code: '131026', message: 'Message undeliverable (stub sender)', throttled: false };
    }
    return { ok: true, wamid: `wamid.STUB.${Date.now()}.${Math.random().toString(36).slice(2, 10)}` };
  }

  /** Unique recipients we may still message in this rolling 24h, given the account's tier. */
  private async remainingDailyAllowance(): Promise<number> {
    const limit = await this.dailyLimit();
    const used = await this.prisma.campaignRecipient.count({
      where: {
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    });
    return limit - used;
  }

  private async dailyLimit(): Promise<number> {
    const override = Number(this.config.get('BROADCAST_DAILY_LIMIT'));
    if (Number.isFinite(override) && override > 0) return override;

    if (this.limitCache && Date.now() - this.limitCache.at < 60_000) return this.limitCache.value;
    let value = FALLBACK_DAILY_LIMIT;
    try {
      const status: any = await this.whatsapp.getStatus();
      value = TIER_LIMITS[String(status?.tier)] ?? FALLBACK_DAILY_LIMIT;
    } catch {
      // keep the fallback
    }
    this.limitCache = { value, at: Date.now() };
    return value;
  }
}
