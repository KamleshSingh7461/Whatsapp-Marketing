import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
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
  async receive(@Body() body: any) {
    await this.webhooks.handleIncoming(body);
    return { received: true };
  }
}
