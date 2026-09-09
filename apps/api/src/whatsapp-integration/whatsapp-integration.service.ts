import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../common/crypto/token-cipher';
import { CompleteEmbeddedSignupDto } from './dto/complete-embedded-signup.dto';

/**
 * Server side of Embedded Signup v4 (§08 of the plan):
 * 1. Frontend widget returns an exchangeable code for the company's new/attached WABA.
 * 2. We exchange it here, server-to-server, for a customer-scoped business token.
 * 3. We store the token encrypted and subscribe the app to that WABA's webhooks.
 *
 * NOTE: webhook subscription (step 3, POST /{waba-id}/subscribed_apps) and the
 * exact OAuth token-exchange endpoint/params should be confirmed against the
 * current Embedded Signup v4 docs before going live — Meta has changed this
 * flow's exact request shape across versions.
 */
@Injectable()
export class WhatsappIntegrationService {
  private readonly logger = new Logger(WhatsappIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async completeSignup(companyId: string, dto: CompleteEmbeddedSignupDto) {
    const businessToken = await this.exchangeCodeForToken(dto.exchangeableCode);
    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');

    const connection = await this.prisma.wabaConnection.upsert({
      where: { companyId },
      update: {
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        businessTokenEnc: encryptToken(businessToken, encryptionKey),
      },
      create: {
        companyId,
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        businessTokenEnc: encryptToken(businessToken, encryptionKey),
      },
    });

    await this.subscribeToWebhooks(dto.wabaId, businessToken);

    return { id: connection.id, wabaId: connection.wabaId, phoneNumberId: connection.phoneNumberId };
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const apiVersion = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    const appId = this.config.getOrThrow<string>('META_APP_ID');
    const appSecret = this.config.getOrThrow<string>('META_APP_SECRET');

    const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('code', code);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${body}`);
    }
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
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
