import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private prisma: PrismaService) {}

  async getAllCampaigns() {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return campaigns.map(c => {
        const seg = (c.segmentJson as any) || {};
        const stats = (c.stats as any) || {};
        return {
          id: c.id,
          name: c.name,
          templateName: seg.templateName || 'fgsn_learn_notification',
          targetTags: seg.targetTags || [],
          totalRecipients: seg.totalRecipients || 1000,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          stats: {
            sent: stats.sent || 0,
            delivered: stats.delivered || 0,
            read: stats.read || 0,
            clickedOrReplied: stats.clickedOrReplied || 0,
            converted: stats.converted || 0,
            revenue: stats.revenue || 0,
            cost: stats.cost || 0,
          },
        };
      });
    } catch (e: any) {
      this.logger.error(`Failed to get campaigns: ${e.message}`);
      return [];
    }
  }

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
          stats: dto.stats || {
            sent: 0,
            delivered: 0,
            read: 0,
            clickedOrReplied: 0,
            converted: 0,
            revenue: 0,
            cost: 0,
          },
        },
      });

      return {
        id: created.id,
        name: created.name,
        templateName: dto.templateName,
        targetTags: dto.targetTags || [],
        totalRecipients: dto.totalRecipients || 1000,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        stats: created.stats,
      };
    } catch (e: any) {
      this.logger.error(`Failed to create campaign ${dto.name}: ${e.message}`);
      throw e;
    }
  }

  async updateCampaign(id: string, dto: { status?: any; stats?: any }) {
    try {
      const existing = await this.prisma.campaign.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await this.prisma.campaign.update({
        where: { id },
        data: {
          status: dto.status || existing.status,
          stats: dto.stats ? { ...(existing.stats as any), ...dto.stats } : existing.stats,
        },
      });

      const seg = (updated.segmentJson as any) || {};
      return {
        id: updated.id,
        name: updated.name,
        templateName: seg.templateName || 'fgsn_learn_notification',
        targetTags: seg.targetTags || [],
        totalRecipients: seg.totalRecipients || 1000,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        stats: updated.stats,
      };
    } catch (e: any) {
      this.logger.error(`Failed to update campaign ${id}: ${e.message}`);
      return null;
    }
  }
}
