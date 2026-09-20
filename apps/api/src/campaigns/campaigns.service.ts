import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Campaign, Prisma, RecipientStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { CampaignSenderService } from './campaign-sender.service';
import { LaunchCampaignDto } from './dto/launch-campaign.dto';
import { CampaignProgress, estimateCostUSD, loadCounts, summarize } from './campaign-progress';

const ALL_OPTED_IN = 'All Opted-In';
const INTERNAL_TEST_GROUP = 'Internal Team Test Group';
const INTERNAL_TEAM_TAG = 'Internal Team';
const MEDIA_HEADERS = ['IMAGE', 'VIDEO', 'DOCUMENT'];

const LEGACY_STATS = { sent: 0, delivered: 0, read: 0, clickedOrReplied: 0, converted: 0, failed: 0, revenue: 0, cost: 0 };

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private templates: TemplatesService,
    private sender: CampaignSenderService,
  ) {}

  // ---------------------------------------------------------------- listing

  /** Shape sent to the web app. Server-sent campaigns carry live, real progress. */
  private toDto(c: Campaign, counts?: Record<string, number>) {
    const seg = (c.segmentJson as any) || {};
    const stored = (c.stats as any) || {};
    const serverSend = !!seg.serverSend;
    const progress = serverSend ? summarize(counts ?? {}) : undefined;

    const stats = progress
      ? {
          sent: progress.accepted,
          delivered: progress.delivered + progress.read,
          read: progress.read,
          clickedOrReplied: stored.clickedOrReplied || 0,
          converted: stored.converted || 0,
          failed: progress.failed,
          revenue: stored.revenue || 0,
          cost: estimateCostUSD(progress.accepted, seg.category),
        }
      : {
          sent: stored.sent || 0,
          delivered: stored.delivered || 0,
          read: stored.read || 0,
          clickedOrReplied: stored.clickedOrReplied || 0,
          converted: stored.converted || 0,
          failed: stored.failed || 0,
          revenue: stored.revenue || 0,
          cost: stored.cost || 0,
        };

    return {
      id: c.id,
      name: c.name,
      templateName: seg.templateName || 'fgsn_learn_notification',
      category: seg.category,
      targetTags: seg.targetTags || [],
      totalRecipients: progress ? progress.total : seg.totalRecipients || 1000,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      startedAt: c.startedAt ? c.startedAt.toISOString() : null,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      serverSend,
      pauseReason: c.pauseReason,
      progress,
      stats,
    };
  }

  async getAllCampaigns() {
    try {
      const campaigns = await this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
      const serverIds = campaigns.filter(c => (c.segmentJson as any)?.serverSend).map(c => c.id);
      const counts = await loadCounts(this.prisma, serverIds);
      return campaigns.map(c => this.toDto(c, counts.get(c.id)));
    } catch (e: any) {
      this.logger.error(`Failed to get campaigns: ${e.message}`);
      return [];
    }
  }

  private async getOneDto(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    const counts = await loadCounts(this.prisma, [id]);
    return this.toDto(c, counts.get(id));
  }

  // ---------------------------------------------------------------- legacy (browser-sent) paths

  async createCampaign(dto: {
    name: string;
    templateName: string;
    targetTags?: string[];
    totalRecipients?: number;
    stats?: any;
    status?: any;
  }) {
    try {
      const created = await this.prisma.campaign.create({
        data: {
          name: dto.name,
          status: dto.status || 'SENDING',
          templateId: undefined,
          segmentJson: {
            templateName: dto.templateName,
            targetTags: dto.targetTags || [],
            totalRecipients: dto.totalRecipients || 1000,
          },
          stats: dto.stats || { ...LEGACY_STATS },
        },
      });
      return this.toDto(created);
    } catch (e: any) {
      this.logger.error(`Failed to create campaign ${dto.name}: ${e.message}`);
      throw e;
    }
  }

  async updateCampaign(id: string, dto: { status?: any; stats?: any }) {
    try {
      const existing = await this.prisma.campaign.findUnique({ where: { id } });
      if (!existing) return null;

      // Server-sent campaigns are owned by the worker; the browser must not overwrite their state.
      if ((existing.segmentJson as any)?.serverSend) {
        throw new BadRequestException('This campaign is managed by the server. Use pause, resume or cancel.');
      }

      const updated = await this.prisma.campaign.update({
        where: { id },
        data: {
          status: dto.status || existing.status,
          stats: dto.stats ? { ...(existing.stats as any), ...dto.stats } : (existing.stats as any),
        },
      });
      return this.toDto(updated);
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Failed to update campaign ${id}: ${e.message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------- server-side sending

  get serverSendEnabled() {
    return { enabled: this.sender.enabled, stub: this.sender.stub };
  }

  /** Same audience definition as apps/web/src/lib/campaignAudience.ts. Opt-in is always required. */
  private async resolveRecipients(targetTags: string[]) {
    const all = targetTags.length === 0 || targetTags.includes(ALL_OPTED_IN);
    const wanted = targetTags.map(t => (t === INTERNAL_TEST_GROUP ? INTERNAL_TEAM_TAG : t));
    return this.prisma.contact.findMany({
      where: { optedIn: true, ...(all ? {} : { tags: { hasSome: wanted } }) },
      select: { id: true, phone: true, displayName: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Only templates we can actually send unattended: approved, and body-only with at most {{1}}. */
  private async requireSendableTemplate(name: string, language?: string) {
    const all: any[] = await this.templates.findAll();
    const t = all.find(x => x.name === name && (!language || x.language === language)) ?? all.find(x => x.name === name);
    if (!t) throw new BadRequestException(`Template "${name}" was not found.`);

    const status = String(t.status || '').toUpperCase();
    if (status !== 'APPROVED') {
      throw new BadRequestException(`Template "${name}" is ${status || 'not approved'}; only APPROVED templates can be broadcast.`);
    }

    const body = String(t.bodyJson?.body ?? '');
    const header = t.bodyJson?.header;
    const headerType = String(header?.type ?? '').toUpperCase();

    if (MEDIA_HEADERS.includes(headerType)) {
      throw new BadRequestException(`Template "${name}" has a ${headerType.toLowerCase()} header, which server-side broadcasts do not support yet.`);
    }
    if (typeof header?.text === 'string' && /\{\{\d+\}\}/.test(header.text)) {
      throw new BadRequestException(`Template "${name}" has a variable in its header, which is not supported yet.`);
    }
    const urlWithVariable = (t.bodyJson?.buttons ?? []).some((b: any) => typeof b?.url === 'string' && b.url.includes('{{'));
    if (urlWithVariable) {
      throw new BadRequestException(`Template "${name}" has a button URL variable, which is not supported yet.`);
    }

    const vars = Array.from(new Set((body.match(/\{\{(\d+)\}\}/g) || []).map(v => Number(v.replace(/\D/g, '')))));
    if (vars.some(v => v !== 1)) {
      throw new BadRequestException(`Template "${name}" uses ${vars.length} variables; only {{1}} (the contact's name) is supported.`);
    }

    return { name: String(t.name), language: String(t.language), category: String(t.category || 'MARKETING'), usesName: vars.length === 1 };
  }

  async launch(dto: LaunchCampaignDto) {
    if (!this.sender.enabled) {
      throw new ServiceUnavailableException({
        code: 'SERVER_SEND_DISABLED',
        message: 'Server-side sending is not enabled on this server.',
      });
    }

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Campaign name is required.');

    const template = await this.requireSendableTemplate(dto.templateName, dto.language);
    const targetTags = dto.targetTags ?? [];
    const contacts = await this.resolveRecipients(targetTags);
    if (contacts.length === 0) {
      throw new BadRequestException('No opted-in contacts match the selected audience.');
    }

    // Double-click / retry guard: the same name launched in the last two minutes is almost certainly a duplicate.
    const recent = await this.prisma.campaign.findFirst({
      where: { name, createdAt: { gte: new Date(Date.now() - 120_000) }, segmentJson: { path: ['serverSend'], equals: true } },
    });
    if (recent) {
      throw new ConflictException('A broadcast with this name was just launched. Check the list before sending again.');
    }

    const campaign = await this.prisma.$transaction(
      async tx => {
        const c = await tx.campaign.create({
          data: {
            name,
            status: 'SENDING',
            startedAt: new Date(),
            segmentJson: {
              serverSend: true,
              templateName: template.name,
              language: template.language,
              category: template.category,
              usesName: template.usesName,
              targetTags,
              totalRecipients: contacts.length,
            },
            stats: { ...LEGACY_STATS },
          },
        });
        for (let i = 0; i < contacts.length; i += 1000) {
          await tx.campaignRecipient.createMany({
            data: contacts.slice(i, i + 1000).map(ct => ({
              campaignId: c.id,
              contactId: ct.id,
              phone: ct.phone,
              displayName: ct.displayName,
            })),
            skipDuplicates: true,
          });
        }
        return c;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    this.logger.log(`Campaign ${campaign.id} "${name}" queued for ${contacts.length} recipients.`);
    return this.getOneDto(campaign.id);
  }

  private async requireServerCampaign(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    if (!(c.segmentJson as any)?.serverSend) {
      throw new BadRequestException('This campaign was sent from a browser session and cannot be controlled from the server.');
    }
    return c;
  }

  async pause(id: string) {
    const c = await this.requireServerCampaign(id);
    if (c.status !== 'SENDING') throw new BadRequestException(`Only a sending campaign can be paused (this one is ${c.status}).`);
    await this.prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
    return this.getOneDto(id);
  }

  async resume(id: string) {
    const c = await this.requireServerCampaign(id);
    if (c.status !== 'PAUSED') throw new BadRequestException(`Only a paused campaign can be resumed (this one is ${c.status}).`);
    await this.prisma.campaign.update({ where: { id }, data: { status: 'SENDING', pauseReason: null } });
    return this.getOneDto(id);
  }

  /** Stops sending. Anything already handed to Meta stays as it is; unsent recipients are cancelled. */
  async cancel(id: string) {
    const c = await this.requireServerCampaign(id);
    if (c.status !== 'SENDING' && c.status !== 'PAUSED') {
      throw new BadRequestException(`Only a sending or paused campaign can be cancelled (this one is ${c.status}).`);
    }
    await this.prisma.$transaction([
      this.prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: 'QUEUED' }, data: { status: 'CANCELLED' } }),
      this.prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date(), pauseReason: null } }),
    ]);
    return this.getOneDto(id);
  }

  /** Explicit, admin-triggered retry of failed recipients (including interrupted ones). */
  async retryFailed(id: string) {
    const c = await this.requireServerCampaign(id);
    if (c.status === 'CANCELLED') throw new BadRequestException('A cancelled campaign cannot be retried.');
    const r = await this.prisma.campaignRecipient.updateMany({
      where: { campaignId: id, status: 'FAILED' },
      data: { status: 'QUEUED', errorCode: null, errorMessage: null },
    });
    if (r.count === 0) throw new BadRequestException('There are no failed recipients to retry.');
    if (c.status !== 'PAUSED') {
      await this.prisma.campaign.update({ where: { id }, data: { status: 'SENDING', completedAt: null, pauseReason: null } });
    }
    return this.getOneDto(id);
  }

  async getProgress(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    const counts = await loadCounts(this.prisma, [id]);
    const progress: CampaignProgress = summarize(counts.get(id) ?? {});

    let etaSeconds: number | null = null;
    if (c.status === 'SENDING' && c.startedAt && progress.processed > 0) {
      const elapsed = (Date.now() - c.startedAt.getTime()) / 1000;
      const rate = elapsed > 0 ? progress.processed / elapsed : 0;
      if (rate > 0) etaSeconds = Math.round((progress.queued + progress.sending) / rate);
    }

    return {
      id: c.id,
      status: c.status,
      pauseReason: c.pauseReason,
      startedAt: c.startedAt ? c.startedAt.toISOString() : null,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      progress,
      etaSeconds,
    };
  }

  async getRecipients(id: string, opts: { status?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const offset = Math.max(Number(opts.offset) || 0, 0);
    const status = opts.status && (Object.values(RecipientStatus) as string[]).includes(opts.status.toUpperCase())
      ? (opts.status.toUpperCase() as RecipientStatus)
      : undefined;

    const where: Prisma.CampaignRecipientWhereInput = { campaignId: id, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.campaignRecipient.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
        select: { id: true, phone: true, displayName: true, status: true, errorCode: true, errorMessage: true, attempts: true, sentAt: true, deliveredAt: true, readAt: true },
      }),
      this.prisma.campaignRecipient.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  // ---------------------------------------------------------------- delivery receipts from Meta

  /**
   * Called from the WhatsApp webhook for every status update. Advances a recipient only forwards
   * (SENT -> DELIVERED -> READ) so late or out-of-order receipts can never move it backwards.
   * Returns how many campaign recipients matched (0 for ordinary chat messages).
   */
  async applyDeliveryStatus(
    metaMessageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    error?: { code?: string | number; message?: string },
  ): Promise<number> {
    if (!metaMessageId) return 0;
    const now = new Date();

    if (status === 'delivered') {
      const r = await this.prisma.campaignRecipient.updateMany({
        where: { metaMessageId, status: { in: ['SENDING', 'SENT'] } },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
      return r.count;
    }
    if (status === 'read') {
      const r = await this.prisma.campaignRecipient.updateMany({
        where: { metaMessageId, status: { in: ['SENDING', 'SENT', 'DELIVERED'] } },
        data: { status: 'READ', readAt: now },
      });
      return r.count;
    }
    if (status === 'failed') {
      const r = await this.prisma.campaignRecipient.updateMany({
        where: { metaMessageId, status: { in: ['SENDING', 'SENT', 'DELIVERED'] } },
        data: {
          status: 'FAILED',
          errorCode: error?.code != null ? String(error.code) : 'DELIVERY_FAILED',
          errorMessage: String(error?.message ?? 'Meta reported the message as failed').slice(0, 500),
        },
      });
      return r.count;
    }
    // 'sent': the worker already records SENT when Meta accepts the request.
    return 0;
  }
}
