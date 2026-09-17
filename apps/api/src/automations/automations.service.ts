import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(private prisma: PrismaService) {}

  async getAllFlows() {
    try {
      const flows = await this.prisma.automationFlow.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return flows.map(f => ({
        id: f.id,
        name: f.name,
        trigger: f.trigger,
        status: f.status as 'ACTIVE' | 'PAUSED',
        stats: (f.stats as any) || { triggered: 0, converted: 0, revenue: 0 },
        createdAt: f.createdAt.toISOString(),
      }));
    } catch (e: any) {
      this.logger.error(`Failed to get flows: ${e.message}`);
      return [];
    }
  }

  async updateFlowStatus(id: string, status: 'ACTIVE' | 'PAUSED') {
    try {
      const updated = await this.prisma.automationFlow.update({
        where: { id },
        data: { status },
      });
      return {
        id: updated.id,
        name: updated.name,
        trigger: updated.trigger,
        status: updated.status as 'ACTIVE' | 'PAUSED',
        stats: updated.stats,
        createdAt: updated.createdAt.toISOString(),
      };
    } catch (e: any) {
      this.logger.error(`Failed to update flow ${id}: ${e.message}`);
      return null;
    }
  }
}
