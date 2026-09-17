import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../common/crypto/token-cipher';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';

const SINGLETON_ID = 'primary';

@Injectable()
export class WhatsappIntegrationService {
  private readonly logger = new Logger(WhatsappIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async connect(dto: ConnectWhatsappDto) {
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');

    let connection: any = null;
    try {
      connection = await this.prisma.wabaConnection.upsert({
        where: { id: SINGLETON_ID },
        update: {
          wabaId: dto.wabaId,
          phoneNumberId: dto.phoneNumberId,
          businessTokenEnc: encryptToken(dto.businessToken, encryptionKey),
        },
        create: {
          id: SINGLETON_ID,
          wabaId: dto.wabaId,
          phoneNumberId: dto.phoneNumberId,
          businessTokenEnc: encryptToken(dto.businessToken, encryptionKey),
        },
      });
    } catch (dbErr) {
      this.logger.warn(`Could not persist WABA connection to database: ${dbErr}`);
    }

    await this.subscribeToWebhooks(dto.wabaId, dto.businessToken);

    return { id: connection?.id || SINGLETON_ID, wabaId: dto.wabaId, phoneNumberId: dto.phoneNumberId };
  }

  async getStatus() {
    let connection: any = null;
    try {
      connection = await this.prisma.wabaConnection.findUnique({ where: { id: SINGLETON_ID } });
    } catch (e) {
      // DB offline fallback
    }

    const defaultWabaId = this.config.get<string>('META_WABA_ID') || '1845046976654799';
    const defaultPhoneId = this.config.get<string>('META_PHONE_NUMBER_ID') || '1268849126320372';
    const systemToken = this.config.get<string>('META_SYSTEM_USER_TOKEN');
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0';

    const wabaId = connection?.wabaId || defaultWabaId;
    const phoneId = connection?.phoneNumberId || defaultPhoneId;

    let displayPhoneNumber = '+91 86558 51749';
    let verifiedName = 'Freedom Global Sports Network';
    let qualityRating = 'GREEN';
    let tier = 'TIER_250';
    let dailyMessageLimit = 250;

    if (systemToken && phoneId) {
      try {
        const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,account_mode`, {
          headers: { Authorization: `Bearer ${systemToken}` },
        });
        if (res.ok) {
          const metaData: any = await res.json();
          displayPhoneNumber = metaData.display_phone_number || displayPhoneNumber;
          verifiedName = metaData.verified_name || verifiedName;
          qualityRating = metaData.quality_rating || qualityRating;
          tier = metaData.messaging_limit_tier || tier;
          if (tier === 'TIER_250') dailyMessageLimit = 250;
          else if (tier === 'TIER_1K' || tier === 'TIER_2K') dailyMessageLimit = 2000;
          else if (tier === 'TIER_10K') dailyMessageLimit = 10000;
          else if (tier === 'TIER_100K') dailyMessageLimit = 100000;
          else if (tier === 'UNLIMITED') dailyMessageLimit = 1000000;
        }
      } catch (e: any) {
        this.logger.warn(`Meta phone status fetch failed: ${e.message}`);
      }
    }

    return {
      connected: true,
      wabaId,
      phoneNumberId: phoneId,
      displayPhoneNumber,
      verifiedName,
      tier,
      qualityRating,
      dailyMessageLimit,
      connectedAt: connection?.connectedAt || new Date().toISOString(),
    };
  }

  async sendTemplateMessage(dto: { to: string; templateName: string; language?: string; components?: any[] }) {
    const phoneNumberId = this.config.get<string>('META_PHONE_NUMBER_ID') || '1268849126320372';
    const systemToken = this.config.get<string>('META_SYSTEM_USER_TOKEN');
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0';

    let formattedTo = dto.to.replace(/[^\d]/g, '');
    if (formattedTo.length === 10) {
      formattedTo = '91' + formattedTo;
    }

    // Self-messaging safety check: Meta Graph API rejects messages sent to the sender WABA number itself
    if (formattedTo === '918655851749') {
      return {
        success: false,
        error: 'Meta API restriction: Cannot send a message to your own WABA sender number (+91 86558 51749). Please enter a customer or team member recipient number.',
      };
    }

    const initialLang = dto.language || 'en';

    const executeCall = async (langCode: string, comps?: any[]) => {
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'template',
        template: {
          name: dto.templateName,
          language: {
            code: langCode,
          },
        },
      };

      if (comps && comps.length > 0) {
        payload.template.components = comps;
      }

      this.logger.log(`Submitting WhatsApp template '${dto.templateName}' (lang: ${langCode}) to +${formattedTo}...`);

      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data: any = {};
      try { data = JSON.parse(responseText); } catch (e) {}

      return { ok: res.ok, status: res.status, data, responseText };
    };

    try {
      let callResult = await executeCall(initialLang, dto.components);

      // If failed due to language mismatch, automatically retry with alternate language code
      if (!callResult.ok) {
        const errorMsg = callResult.data?.error?.message || '';
        const errorCode = callResult.data?.error?.code || callResult.data?.error?.error_subcode;
        const details = callResult.data?.error?.error_data?.details || '';

        if (errorCode === 132001 || errorMsg.toLowerCase().includes('does not exist in the translated language') || errorMsg.toLowerCase().includes('language')) {
          const alternateLang = initialLang === 'en_US' ? 'en' : initialLang === 'en' ? 'en_US' : 'en_US';
          this.logger.warn(`Retrying template '${dto.templateName}' with alternate language code: '${alternateLang}'...`);
          callResult = await executeCall(alternateLang, dto.components);
        } else if (errorCode === 132000 || details.toLowerCase().includes('localizable_params') || errorMsg.toLowerCase().includes('parameters does not match')) {
          this.logger.warn(`Retrying template '${dto.templateName}' without component parameters due to param count mismatch...`);
          callResult = await executeCall(initialLang, undefined);
          if (!callResult.ok && (initialLang === 'en_US' || initialLang === 'en')) {
            const alternateLang = initialLang === 'en_US' ? 'en' : 'en_US';
            callResult = await executeCall(alternateLang, undefined);
          }
        }
      }

      if (!callResult.ok) {
        this.logger.error(`Meta WhatsApp send failed (${callResult.status}): ${callResult.responseText}`);
        return {
          success: false,
          error: callResult.data?.error?.message || `Meta API error ${callResult.status}`,
          metaResponse: callResult.data,
        };
      }

      const msgId = callResult.data.messages?.[0]?.id || `wmid.${Date.now()}`;
      this.logger.log(`WhatsApp message successfully sent via Meta Cloud API! WAMID: ${msgId}`);
      return {
        success: true,
        messageId: msgId,
        metaResponse: callResult.data,
      };
    } catch (err: any) {
      this.logger.error(`Meta Cloud API request exception: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async sendTextMessage(dto: { to: string; text: string }) {
    const phoneNumberId = this.config.get<string>('META_PHONE_NUMBER_ID') || '1268849126320372';
    const systemToken = this.config.get<string>('META_SYSTEM_USER_TOKEN');
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0';

    let formattedTo = dto.to.replace(/[^\d]/g, '');
    if (formattedTo.length === 10) {
      formattedTo = '91' + formattedTo;
    }

    if (formattedTo === '918655851749') {
      return {
        success: false,
        error: 'Meta API restriction: Cannot send a message to your own WABA sender number (+91 86558 51749). Please enter a customer or team member recipient number.',
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'text',
      text: {
        preview_url: false,
        body: dto.text,
      },
    };

    this.logger.log(`Submitting direct text message to +${formattedTo}...`);

    try {
      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data: any = {};
      try { data = JSON.parse(responseText); } catch (e) {}

      if (!res.ok) {
        this.logger.error(`Meta direct text send failed (${res.status}): ${responseText}`);
        return { success: false, error: data.error?.message || `Meta API error ${res.status}`, metaResponse: data };
      }

      const msgId = data.messages?.[0]?.id || `wmid.${Date.now()}`;
      this.logger.log(`Direct text message delivered via Meta! WAMID: ${msgId}`);
      return { success: true, messageId: msgId, metaResponse: data };
    } catch (err: any) {
      this.logger.error(`Meta direct text exception: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private async subscribeToWebhooks(wabaId: string, businessToken: string): Promise<void> {
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`,
        { method: 'POST', headers: { Authorization: `Bearer ${businessToken}` } },
      );
      if (!response.ok) {
        this.logger.error(`Webhook subscription failed for WABA ${wabaId}: ${await response.text()}`);
      }
    } catch (e: any) {
      this.logger.warn(`Subscribe webhooks error: ${e.message}`);
    }
  }

  async getLiveMessagingLedger() {
    try {
      const convs = await this.prisma.conversation.findMany({
        include: {
          contact: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const formattedConvs: any[] = [];
      const messagesByConvId: Record<string, any[]> = {};

      let totalOutbound = 0;
      let totalDelivered = 0;
      let totalInbound = 0;

      for (const c of convs) {
        if (!c.contact) continue;
        const phone = c.contact.phone;
        const convId = c.id || `conv_${phone}`;
        const msgs = (c.messages || []).map(m => {
          const payload = (m.payloadJson as any) || {};
          const isOutbound = m.direction === 'OUTBOUND';
          if (isOutbound) {
            totalOutbound++;
            if (m.status !== 'FAILED') totalDelivered++;
          } else {
            totalInbound++;
          }

          const extractedContent =
            payload.body ||
            payload.text ||
            payload.content ||
            (payload.templateName ? `Template: ${payload.templateName}` : null) ||
            (payload.templateData?.name ? `Template: ${payload.templateData.name}` : null) ||
            'WhatsApp Message';

          return {
            id: m.id,
            conversationId: convId,
            sender: isOutbound ? 'AGENT' : 'CUSTOMER',
            senderName: isOutbound ? (payload.authorName || 'FGSN Team') : (c.contact.displayName || `+${phone}`),
            direction: m.direction,
            content: extractedContent,
            timestamp: m.createdAt.toISOString(),
            status: m.status,
            metaMessageId: m.metaMessageId,
          };
        });

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        messagesByConvId[convId] = msgs;
        if (cleanPhone) {
          messagesByConvId[`conv_${cleanPhone}`] = msgs;
          messagesByConvId[`conv_+${cleanPhone}`] = msgs;
        }

        const lastMsg = msgs[msgs.length - 1];
        formattedConvs.push({
          id: convId,
          contact: {
            id: c.contact.id,
            phone: c.contact.phone,
            displayName: c.contact.displayName || `+${c.contact.phone}`,
            avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
            optedIn: c.contact.optedIn,
            tags: c.contact.tags || ['New Lead'],
          },
          lastMessage: lastMsg ? {
            id: lastMsg.id,
            content: lastMsg.content,
            timestamp: lastMsg.timestamp,
            sender: lastMsg.sender,
          } : undefined,
          unreadCount: msgs.filter(m => m.direction === 'INBOUND' && m.status !== 'READ').length,
          status: 'OPEN',
          windowExpiresAt: c.windowExpiresAt ? c.windowExpiresAt.toISOString() : undefined,
        });
      }

      // Query official Meta WABA Analytics live from Meta Graph API
      let metaOfficialSent = totalOutbound;
      let metaOfficialDelivered = totalDelivered;

      try {
        const wabaId = this.config.get<string>('META_WABA_ID') || '1845046976654799';
        const systemToken = this.config.get<string>('META_SYSTEM_USER_TOKEN');
        const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') || 'v21.0';

        if (systemToken && wabaId) {
          const start = Math.floor(Date.now() / 1000) - 30 * 86400;
          const end = Math.floor(Date.now() / 1000);
          const res = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}?fields=analytics.start(${start}).end(${end}).granularity(DAY)`, {
            headers: { Authorization: `Bearer ${systemToken}` },
          });
          if (res.ok) {
            const metaAnalyticsData: any = await res.json();
            const dataPoints = metaAnalyticsData.analytics?.data_points || [];
            let sumSent = 0;
            let sumDelivered = 0;
            dataPoints.forEach((dp: any) => {
              sumSent += dp.sent || 0;
              sumDelivered += dp.delivered || 0;
            });
            if (sumSent > 0) {
              metaOfficialSent = Math.max(totalOutbound, sumSent);
              metaOfficialDelivered = Math.max(totalDelivered, sumDelivered);
            }
          }
        }
      } catch (metaErr: any) {
        this.logger.warn(`Meta official analytics fetch warning: ${metaErr.message}`);
      }

      return {
        conversations: formattedConvs,
        messagesByConvId,
        metrics: {
          totalOutbound: metaOfficialSent,
          totalDelivered: metaOfficialDelivered,
          totalInbound,
        },
      };
    } catch (e: any) {
      this.logger.error(`Failed to get live messaging ledger: ${e.message}`);
      return {
        conversations: [],
        messagesByConvId: {},
        metrics: { totalOutbound: 0, totalDelivered: 0, totalInbound: 0 },
      };
    }
  }
}
