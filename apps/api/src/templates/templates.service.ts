import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateCategory, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';
import { parseDataUrl } from '../inbox/message-view.logic';
import { mediaHeaderOf } from '../whatsapp-integration/template-header.logic';
import { decryptToken } from '../common/crypto/token-cipher';

// The template list comes from Meta; every open tab asks for it every few seconds, and it changes rarely.
const TEMPLATES_TTL_MS = 60 * 1000;

// What Meta accepts as a template header sample.
const HEADER_MEDIA_RULES: Record<string, { types: string[]; label: string; maxBytes: number }> = {
  IMAGE: { types: ['image/jpeg', 'image/png'], label: 'a JPG or PNG image', maxBytes: 5 * 1024 * 1024 },
  VIDEO: { types: ['video/mp4', 'video/3gpp'], label: 'an MP4 video', maxBytes: 16 * 1024 * 1024 },
  DOCUMENT: { types: ['application/pdf'], label: 'a PDF', maxBytes: 100 * 1024 * 1024 },
};

/** Meta's own explanation of an error when it gives one (error_user_msg is written for people). */
function metaError(data: any, fallback: string): string {
  const e = data?.error;
  return e?.error_user_msg || e?.error_user_title || e?.message || fallback;
}

const PROMOTIONAL_KEYWORDS = ['sale', 'discount', 'offer', 'deal', 'buy now', 'coupon', '% off'];

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateTemplateDto) {
    this.templatesCache = null;
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

    this.templatesCache = null; // again, in case a refresh cached the list while this one was being submitted
    return {
      ...template,
      metaResponse: metaResult,
      warning: this.checkLikelyMiscategorized(dto),
    };
  }

  private templatesCache: { at: number; value: Promise<any[]> } | null = null;

  /** Every template, reused for a minute (see TEMPLATES_TTL_MS). Creating a template refreshes it straight away. */
  findAll(): Promise<any[]> {
    if (!this.templatesCache || Date.now() - this.templatesCache.at > TEMPLATES_TTL_MS) {
      const value = this.readAll();
      this.templatesCache = { at: Date.now(), value };
      value.catch(() => (this.templatesCache = null));
    }
    return this.templatesCache.value;
  }

  private async readAll() {
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

  /** The token and WABA to call Meta with: the connected account's own token when there is one, else the system user's. */
  private async metaAuth(): Promise<{ token?: string; wabaId: string; apiVersion: string }> {
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
    return { token: token && !token.includes('...') ? token : undefined, wabaId, apiVersion };
  }

  /**
   * A template's image / video / document must reach Meta through its upload API: the "handle" it returns goes in the
   * template, not a web link. `source` is a file chosen in the editor (data: URL) or a web link to download.
   */
  private async uploadHeaderSample(source: string, format: string, auth: { token?: string; apiVersion: string }): Promise<string> {
    const appId = this.config.get<string>('META_APP_ID');
    if (!appId) throw new Error('META_APP_ID is not set on the server, so the template media cannot be uploaded to Meta.');

    let bytes: Buffer;
    let mime: string;
    const file = parseDataUrl(source);
    if (file) {
      bytes = file.bytes;
      mime = file.mime;
    } else if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source);
      if (!res.ok) throw new Error(`The ${format.toLowerCase()} link could not be downloaded (${res.status}).`);
      bytes = Buffer.from(await res.arrayBuffer());
      mime = (res.headers.get('content-type') || '').split(';')[0].trim();
    } else {
      throw new Error(`Choose the ${format.toLowerCase()} for the template header.`);
    }

    const rule = HEADER_MEDIA_RULES[format];
    if (!rule || !rule.types.includes(mime)) {
      throw new Error(`A ${format.toLowerCase()} header must be ${rule?.label || 'a supported file'} (this file is ${mime || 'unknown'}).`);
    }
    if (bytes.length === 0 || bytes.length > rule.maxBytes) {
      throw new Error(`The ${format.toLowerCase()} must be under ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`);
    }

    const oauth = { Authorization: `OAuth ${auth.token}` };
    const fileName = `template-header.${mime.split('/')[1] || 'bin'}`;
    const startRes = await fetch(
      `https://graph.facebook.com/${auth.apiVersion}/${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${bytes.length}&file_type=${encodeURIComponent(mime)}`,
      { method: 'POST', headers: oauth },
    );
    const session: any = await startRes.json().catch(() => ({}));
    if (!startRes.ok || !session.id) throw new Error(metaError(session, 'Meta did not accept the upload'));

    const upRes = await fetch(`https://graph.facebook.com/${auth.apiVersion}/${session.id}`, {
      method: 'POST',
      headers: { ...oauth, file_offset: '0' },
      body: new Uint8Array(bytes),
    });
    const uploaded: any = await upRes.json().catch(() => ({}));
    if (!upRes.ok || !uploaded.h) throw new Error(metaError(uploaded, 'Meta did not accept the upload'));
    return String(uploaded.h);
  }

  /**
   * Meta's template components from the editor's bodyJson. For a media header, `keepHeaderFrom` is the template's
   * current sample (when editing), used when no new file or link was chosen.
   */
  private async buildComponents(
    dto: { bodyJson: any; sampleVariables?: Record<string, string> },
    auth: { token?: string; apiVersion: string },
    keepHeaderFrom?: string | null,
  ) {
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
        const source = String(bodyObj.header.url || '').trim() || keepHeaderFrom || '';
        const handle = await this.uploadHeaderSample(source, hType, auth);
        components.push({ type: 'HEADER', format: hType, example: { header_handle: [handle] } });
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
      const footerClean = typeof bodyObj.footer === 'string' ? bodyObj.footer.trim().slice(0, 60) : '';
      if (footerClean) {
        components.push({
          type: 'FOOTER',
          text: footerClean,
        });
      }
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
            example: b.code || b.example || 'FGSN20',
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
    return components;
  }

  private async submitToMetaGraphApi(dto: CreateTemplateDto): Promise<{ id?: string; status?: string; error?: string } | null> {
    const auth = await this.metaAuth();
    if (!auth.token) {
      this.logger.warn('Meta System User Token not configured. Template saved locally.');
      return { error: 'Meta System User Token not configured in .env' };
    }

    let components: any[];
    try {
      components = await this.buildComponents(dto, auth);
    } catch (e: any) {
      return { error: e.message };
    }

    const payload = {
      name: dto.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language: dto.language || 'en_US',
      category: dto.category,
      components,
    };

    const url = `https://graph.facebook.com/${auth.apiVersion}/${auth.wabaId}/message_templates`;
    this.logger.log(`Submitting template '${payload.name}' to Meta Graph API: ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`Meta Template Submission Error: ${JSON.stringify(data)}`);
      return { error: metaError(data, 'Meta API Submission Failed') };
    }

    this.logger.log(`Meta Template Successfully Created! ID: ${data.id}, Status: ${data.status}`);
    return { id: data.id, status: data.status };
  }

  /**
   * Edits a template on Meta. The name and language cannot change (Meta's rule). An edited template goes back to
   * review; an approved one can be edited once a day and 10 times a month. A media header keeps its current file unless
   * a new one is chosen.
   */
  async update(id: string, dto: UpdateTemplateDto): Promise<{ success: boolean; status?: string; error?: string }> {
    if (!/^\d{1,30}$/.test(id)) return { success: false, error: 'Only templates that are on Meta can be edited.' };
    const auth = await this.metaAuth();
    if (!auth.token) return { success: false, error: 'Meta System User Token not configured in .env' };
    const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };

    try {
      const curRes = await fetch(`https://graph.facebook.com/${auth.apiVersion}/${id}?fields=name,status,category,components`, { headers });
      const current: any = await curRes.json().catch(() => ({}));
      if (!curRes.ok) return { success: false, error: metaError(current, 'This template could not be read from Meta') };
      const status = String(current.status || '').toUpperCase();
      if (status === 'PENDING' || status === 'IN_APPEAL') {
        return { success: false, error: 'This template is still in review at Meta. It can be edited once Meta has decided.' };
      }

      const keep = mediaHeaderOf(current.components)?.exampleUrl ?? null;
      const components = await this.buildComponents(dto, auth, keep);
      const payload: any = { components };
      // An approved template's category cannot be changed.
      if (dto.category && dto.category !== current.category && status !== 'APPROVED') {
        payload.category = dto.category;
      }

      const res = await fetch(`https://graph.facebook.com/${auth.apiVersion}/${id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        this.logger.error(`Meta template edit failed for ${current.name}: ${JSON.stringify(data)}`);
        return { success: false, error: metaError(data, 'Meta did not accept the edit') };
      }

      this.logger.log(`Template '${current.name}' edited and sent back to Meta for review.`);
      this.templatesCache = null;
      await this.prisma.template
        .updateMany({ where: { metaTemplateId: id }, data: { bodyJson: dto.bodyJson as any, status: TemplateStatus.PENDING } })
        .catch(() => null);
      return { success: true, status: 'PENDING' };
    } catch (e: any) {
      this.logger.error(`Template edit failed: ${e.message}`);
      return { success: false, error: e.message || 'The template could not be edited' };
    }
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
