import { PrismaService } from '../prisma/prisma.service';

/**
 * Progress of a server-sent campaign, derived live from its CampaignRecipient rows.
 * The rows are the single source of truth; nothing here is an estimate.
 */
export interface CampaignProgress {
  total: number;
  queued: number;
  sending: number;
  /** Accepted by Meta, no delivery receipt yet. */
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  cancelled: number;
  /** Handed to Meta successfully: sent + delivered + read. */
  accepted: number;
  /** Finished one way or another: accepted + failed + cancelled. */
  processed: number;
  /** 0-100, one decimal. */
  percentDone: number;
}

export function summarize(byStatus: Record<string, number>): CampaignProgress {
  const n = (k: string) => byStatus[k] || 0;
  const queued = n('QUEUED');
  const sending = n('SENDING');
  const sent = n('SENT');
  const delivered = n('DELIVERED');
  const read = n('READ');
  const failed = n('FAILED');
  const cancelled = n('CANCELLED');
  const total = queued + sending + sent + delivered + read + failed + cancelled;
  const accepted = sent + delivered + read;
  const processed = accepted + failed + cancelled;
  return {
    total,
    queued,
    sending,
    sent,
    delivered,
    read,
    failed,
    cancelled,
    accepted,
    processed,
    percentDone: total > 0 ? Math.round((processed / total) * 1000) / 10 : 0,
  };
}

/** One grouped query for many campaigns; uses the (campaignId, status) index. */
export async function loadCounts(
  prisma: PrismaService,
  campaignIds: string[],
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (campaignIds.length === 0) return map;
  const rows = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: campaignIds } },
    _count: { _all: true },
  });
  for (const r of rows) {
    const m = map.get(r.campaignId) ?? {};
    m[r.status] = r._count._all;
    map.set(r.campaignId, m);
  }
  return map;
}

// Meta per-message rates for India, in INR (the same rates the dashboard ledger uses), and the
// USD to INR factor the web app's currency formatter multiplies by. The web app stores money in a
// USD-based unit, so cost is converted through that factor to display as the real per-message INR
// rate. Keep in sync with apps/web/src/lib/campaignAudience.ts.
const META_RATE_INR: Record<string, number> = { MARKETING: 0.8629, UTILITY: 0.115, AUTHENTICATION: 0.115 };
const USD_TO_INR = 83.5;

export function estimateCostUSD(acceptedMessages: number, category?: string): number {
  const inr = META_RATE_INR[String(category || 'MARKETING').toUpperCase()] ?? META_RATE_INR.MARKETING;
  return Number(((acceptedMessages * inr) / USD_TO_INR).toFixed(4));
}

/** Persists real counts into Campaign.stats so any consumer of the stats column sees real numbers. */
export async function refreshCampaignStats(
  prisma: PrismaService,
  campaign: { id: string; stats: unknown; segmentJson: unknown },
): Promise<CampaignProgress> {
  const counts = await loadCounts(prisma, [campaign.id]);
  const p = summarize(counts.get(campaign.id) ?? {});
  const seg = (campaign.segmentJson as any) || {};
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      stats: {
        ...((campaign.stats as any) || {}),
        sent: p.accepted,
        delivered: p.delivered + p.read,
        read: p.read,
        failed: p.failed,
        cost: estimateCostUSD(p.accepted, seg.category),
      } as any,
    },
  });
  return p;
}
