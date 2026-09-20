import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WhatsappIntegrationModule } from '../whatsapp-integration/whatsapp-integration.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ReplyRulesModule } from '../reply-rules/reply-rules.module';

@Module({
  imports: [WhatsappIntegrationModule, CampaignsModule, ReplyRulesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
