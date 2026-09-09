import { Injectable } from '@nestjs/common';
import { TemplateCategory, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

// Coarse heuristic only — Meta's own categorization model is the real gate
// (§02: a mis-tagged Utility template gets silently re-billed as Marketing).
// This just stops the most obvious mistakes before submission.
const PROMOTIONAL_KEYWORDS = ['sale', 'discount', 'offer', 'deal', 'buy now', 'coupon', '% off'];

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateTemplateDto) {
    const template = await this.prisma.template.create({
      data: {
        companyId,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        bodyJson: dto.bodyJson as any,
        status: TemplateStatus.DRAFT,
      },
    });

    return { ...template, warning: this.checkLikelyMiscategorized(dto) };
  }

  findAllForCompany(companyId: string) {
    return this.prisma.template.findMany({ where: { companyId } });
  }

  private checkLikelyMiscategorized(dto: CreateTemplateDto): string | null {
    if (dto.category !== TemplateCategory.UTILITY) return null;
    const text = JSON.stringify(dto.bodyJson).toLowerCase();
    const hit = PROMOTIONAL_KEYWORDS.find((kw) => text.includes(kw));
    return hit
      ? `Tagged Utility but contains "${hit}" — Meta may re-categorize this as Marketing and bill accordingly (§02).`
      : null;
  }
}
