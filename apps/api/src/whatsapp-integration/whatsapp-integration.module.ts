import { Module } from '@nestjs/common';
import { WhatsappIntegrationController, WhatsappMediaController } from './whatsapp-integration.controller';
import { WhatsappIntegrationService } from './whatsapp-integration.service';

@Module({
  controllers: [WhatsappIntegrationController, WhatsappMediaController],
  providers: [WhatsappIntegrationService],
  exports: [WhatsappIntegrationService],
})
export class WhatsappIntegrationModule {}
