import { Module } from '@nestjs/common';
import { WhatsappIntegrationController } from './whatsapp-integration.controller';
import { WhatsappIntegrationService } from './whatsapp-integration.service';

@Module({
  controllers: [WhatsappIntegrationController],
  providers: [WhatsappIntegrationService],
})
export class WhatsappIntegrationModule {}
