import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../common/crypto/token-cipher';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';

// WabaConnection is a singleton table (§06 of the plan) — this app manages
// exactly one WhatsApp Business Account, so there's exactly one row, always
// addressed by this fixed id rather than a per-tenant lookup.
const SINGLETON_ID = 'primary';

/**
 * Server side of connecting the company's own WhatsApp number (§03 of the plan):
 * the Admin generates a System User permanent token by hand in Business Manager
 * and submits it here once, alongside the WABA id and phone number id. No
 * Embedded Signup, no OAuth code exchange, no per-client onboarding.
 */
@Injectable()
export class WhatsappIntegrationService {
  private readonly logger = new Logger(WhatsappIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async connect(dto: ConnectWhatsappDto) {
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');

    const connection = await this.prisma.wabaConnection.upsert({
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

    await this.subscribeToWebhooks(dto.wabaId, dto.businessToken);

    return { id: connection.id, wabaId: connection.wabaId, phoneNumberId: connection.phoneNumberId };
  }

  async getStatus() {
    const connection = await this.prisma.wabaConnection.findUnique({ where: { id: SINGLETON_ID } });
    if (!connection) return { connected: false };
    return {
      connected: true,
      wabaId: connection.wabaId,
      phoneNumberId: connection.phoneNumberId,
      displayPhoneNumber: connection.displayPhoneNumber,
      tier: connection.tier,
      qualityRating: connection.qualityRating,
      connectedAt: connection.connectedAt,
    };
  }

  private async subscribeToWebhooks(wabaId: string, businessToken: string): Promise<void> {
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${businessToken}` } },
    );
    if (!response.ok) {
      this.logger.error(`Webhook subscription failed for WABA ${wabaId}: ${await response.text()}`);
    }
  }
}
