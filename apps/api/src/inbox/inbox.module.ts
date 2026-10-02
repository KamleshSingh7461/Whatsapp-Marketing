import { Module } from '@nestjs/common';
import { WhatsappIntegrationModule } from '../whatsapp-integration/whatsapp-integration.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [WhatsappIntegrationModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
