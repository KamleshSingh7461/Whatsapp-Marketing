import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/whatsapp')
export class WebhooksController {
  constructor(
    private config: ConfigService,
    private webhooks: WebhooksService,
  ) {}

  // Meta's one-time verification handshake when you set the callback URL.
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.getOrThrow<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && verifyToken === expected) {
      return challenge;
    }
    throw new BadRequestException('Webhook verification failed');
  }

  @Post()
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async receive(@Req() req: any, @Body() body: any) {
    const payload = (req && req.body && Object.keys(req.body).length > 0) ? req.body : body;
    await this.webhooks.handleIncoming(payload);
    return { received: true };
  }

  @Get('status')
  getStatus() {
    const verifyToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN') || 'fgsn_secure_webhook_token_2026';
    return {
      webhookUrl: 'https://erp.fgsnlive.com/api/webhooks/whatsapp',
      verifyToken,
      status: 'VERIFIED_ACTIVE',
      mode: 'subscribe',
      events: ['messages', 'message_template_status_update', 'phone_number_quality_update'],
      lastVerifiedAt: new Date().toISOString(),
    };
  }

  @Post('test-ping')
  async testPing() {
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1845046976654799',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+91 86558 51749',
                  phone_number_id: '1268849126320372',
                },
                statuses: [
                  {
                    id: 'wamid.HBgLOTE3NDYxOTEzNDk1FQIAERgSRDFBNDExNjE1NzZDREY2NjQxAA==',
                    status: 'delivered',
                    timestamp: Math.floor(Date.now() / 1000),
                    recipient_id: '917461913495',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await this.webhooks.handleIncoming(samplePayload);
    return {
      success: true,
      message: 'Test webhook payload processed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
