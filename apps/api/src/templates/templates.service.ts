import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateCategory, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { decryptToken } from '../common/crypto/token-cipher';

const PROMOTIONAL_KEYWORDS = ['sale', 'discount', 'offer', 'deal', 'buy now', 'coupon', '% off'];

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateTemplateDto) {
    let metaResult: { id?: string; status?: string; error?: string } | null = null;

    try {
      metaResult = await this.submitToMetaGraphApi(dto);
    } catch (e: any) {
      this.logger.error(`Meta Template Submission Exception: ${e.message}`);
    }

    let status: TemplateStatus = TemplateStatus.DRAFT;
    if (metaResult?.status === 'APPROVED') {
      status = TemplateStatus.APPROVED;
    } else if (metaResult?.status === 'PENDING') {
      status = TemplateStatus.PENDING;
    } else if (metaResult?.status === 'REJECTED') {
      status = TemplateStatus.REJECTED;
    } else if (metaResult?.id) {
      status = TemplateStatus.PENDING;
    }

    let template: any = null;
    try {
      template = await this.prisma.template.create({
        data: {
          name: dto.name,
          language: dto.language,
          category: dto.category,
          bodyJson: dto.bodyJson as any,
          status,
          metaTemplateId: metaResult?.id || null,
        },
      });
    } catch (dbErr) {
      this.logger.warn(`Could not persist template to database: ${dbErr}`);
      template = {
        id: `tpl_${Date.now()}`,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        bodyJson: dto.bodyJson,
        status: status,
        metaTemplateId: metaResult?.id || null,
        createdAt: new Date(),
      };
    }

    return {
      ...template,
      metaResponse: metaResult,
      warning: this.checkLikelyMiscategorized(dto),
    };
  }

  async findAll() {
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    const token = this.config.get<string>('META_SYSTEM_USER_TOKEN');
    const wabaId = this.config.get<string>('META_WABA_ID') || '1845046976654799';

    let dbTemplates: any[] = [];
    try {
      dbTemplates = await this.prisma.template.findMany();
    } catch (e) {
      dbTemplates = [];
    }

    if (!token || token.includes('...')) {
      return dbTemplates;
    }

    // Live query Meta Graph API for all templates in this WABA account
    try {
      const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?limit=100`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data.data) && data.data.length > 0) {
        const liveMetaTemplates = data.data.map((t: any) => {
          const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
          const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
          const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
          const buttonsComp = t.components?.find((c: any) => c.type === 'BUTTONS');

          return {
            id: t.id || `tpl_meta_${t.name}`,
            name: t.name,
            language: t.language,
            category: t.category,
            status: t.status, // APPROVED, PENDING, REJECTED
            metaTemplateId: t.id,
            bodyJson: {
              body: bodyComp?.text || '',
              header: headerComp ? { type: headerComp.format, text: headerComp.text } : undefined,
              footer: footerComp?.text,
              buttons: buttonsComp?.buttons,
            },
            warning: t.rejected_reason ? `Meta Rejection Reason: ${t.rejected_reason}` : undefined,
            createdAt: t.created_at ? new Date(t.created_at * 1000).toISOString() : new Date().toISOString(),
          };
        });

        this.logger.log(`Fetched ${liveMetaTemplates.length} live templates directly from Meta Graph API!`);
        return liveMetaTemplates;
      }
    } catch (metaErr: any) {
      this.logger.warn(`Could not fetch live Meta templates: ${metaErr.message}`);
    }

    return dbTemplates;
  }

  private async submitToMetaGraphApi(dto: CreateTemplateDto): Promise<{ id?: string; status?: string; error?: string } | null> {
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    let token = this.config.get<string>('META_SYSTEM_USER_TOKEN');
    let wabaId = this.config.get<string>('META_WABA_ID') || '1845046976654799';

    try {
      const waba = await this.prisma.wabaConnection.findFirst();
      if (waba) {
        wabaId = waba.wabaId;
        const encryptionKey = this.config.get<string>('ENCRYPTION_KEY');
        if (waba.businessTokenEnc && encryptionKey) {
          try {
            token = decryptToken(waba.businessTokenEnc, encryptionKey);
          } catch (e) {
            // fallback to system user token
          }
        }
      }
    } catch (e) {
      // ignore DB connection error
    }

    if (!token || token.includes('...')) {
      this.logger.warn('Meta System User Token not configured. Template saved locally.');
      return { error: 'Meta System User Token not configured in .env' };
    }

    // Format Meta Graph API components array
    const bodyObj: any = dto.bodyJson || {};
    const components: any[] = [];

    if (bodyObj.header) {
      const hType = (bodyObj.header.type || 'TEXT').toUpperCase();
      if (hType === 'TEXT' && bodyObj.header.text) {
        const headerComp: any = {
          type: 'HEADER',
          format: 'TEXT',
          text: bodyObj.header.text,
        };
        const headerMatches = bodyObj.header.text.match(/\{\{\d+\}\}/g);
        if (headerMatches && headerMatches.length > 0) {
          const headerSamples = headerMatches.map((m: string) => {
            const num = m.replace(/\D/g, '');
            return dto.sampleVariables?.[`h_${num}`] || dto.sampleVariables?.[num] || 'VIP Pass';
          });
          headerComp.example = { header_text: headerSamples };
        }
        components.push(headerComp);
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
        const headerComp: any = {
          type: 'HEADER',
          format: hType,
        };
        const mediaUrl = bodyObj.header.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';
        headerComp.example = {
          header_handle: [mediaUrl],
        };
        components.push(headerComp);
      }
    }

    if (bodyObj.body) {
      const bodyComp: any = {
        type: 'BODY',
        text: bodyObj.body,
      };
      const bodyMatches = bodyObj.body.match(/\{\{\d+\}\}/g);
      if (bodyMatches && bodyMatches.length > 0) {
        // Meta REQUIRES example sample variables for {{1}}, {{2}} in BODY component
        const sampleValues = bodyMatches.map((m: string, idx: number) => {
          const num = m.replace(/\D/g, '');
          return dto.sampleVariables?.[num] || dto.sampleVariables?.[`${idx + 1}`] || `sample_${idx + 1}`;
        });
        bodyComp.example = {
          body_text: [sampleValues],
        };
      }
      components.push(bodyComp);
    }

    if (bodyObj.footer) {
      components.push({
        type: 'FOOTER',
        text: bodyObj.footer,
      });
    }

    if (Array.isArray(bodyObj.buttons) && bodyObj.buttons.length > 0) {
      const formattedButtons: any[] = [];
      for (const b of bodyObj.buttons) {
        if (!b.text && b.type !== 'OTP') continue;
        const bType = (b.type || 'QUICK_REPLY').toUpperCase();
        if (bType === 'QUICK_REPLY') {
          formattedButtons.push({
            type: 'QUICK_REPLY',
            text: b.text.slice(0, 25),
          });
        } else if (bType === 'URL') {
          const urlComp: any = {
            type: 'URL',
            text: b.text.slice(0, 25),
            url: b.url || 'https://fgsnlive.com',
          };
          if (b.url && b.url.includes('{{1}}')) {
            urlComp.example = ['https://fgsnlive.com/track/12345'];
          }
          formattedButtons.push(urlComp);
        } else if (bType === 'PHONE_NUMBER') {
          formattedButtons.push({
            type: 'PHONE_NUMBER',
            text: b.text.slice(0, 25),
            phone_number: b.phone || b.phone_number || '+918655851749',
          });
        } else if (bType === 'COPY_CODE') {
          formattedButtons.push({
            type: 'COPY_CODE',
            example: b.code || 'FGSN20',
          });
        }
      }

      if (formattedButtons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: formattedButtons,
        });
      }
    }

    const payload = {
      name: dto.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language: dto.language || 'en_US',
      category: dto.category,
      components,
    };

    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;
    this.logger.log(`Submitting template '${payload.name}' to Meta Graph API: ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`Meta Template Submission Error: ${JSON.stringify(data)}`);
      return { error: data.error?.message || 'Meta API Submission Failed' };
    }

    this.logger.log(`Meta Template Successfully Created! ID: ${data.id}, Status: ${data.status}`);
    return { id: data.id, status: data.status };
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
