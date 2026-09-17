import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WhatsappIntegrationModule } from '../whatsapp-integration/whatsapp-integration.module';

@Module({
  imports: [WhatsappIntegrationModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
