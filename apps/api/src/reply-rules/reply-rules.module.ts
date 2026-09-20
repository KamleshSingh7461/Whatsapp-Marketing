import { Module } from '@nestjs/common';
import { WhatsappIntegrationModule } from '../whatsapp-integration/whatsapp-integration.module';
import { ReplyRulesController } from './reply-rules.controller';
import { ReplyRulesService } from './reply-rules.service';
import { CallLeadsController } from './call-leads.controller';
import { CallLeadsService } from './call-leads.service';

@Module({
  imports: [WhatsappIntegrationModule],
  controllers: [ReplyRulesController, CallLeadsController],
  providers: [ReplyRulesService, CallLeadsService],
  exports: [ReplyRulesService, CallLeadsService],
})
export class ReplyRulesModule {}
