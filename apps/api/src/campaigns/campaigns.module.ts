import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignSenderService } from './campaign-sender.service';
import { CampaignsController } from './campaigns.controller';
import { TemplatesModule } from '../templates/templates.module';
import { WhatsappIntegrationModule } from '../whatsapp-integration/whatsapp-integration.module';

@Module({
  imports: [TemplatesModule, WhatsappIntegrationModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignSenderService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
