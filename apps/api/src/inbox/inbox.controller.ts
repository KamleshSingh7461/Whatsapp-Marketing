import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InboxService } from './inbox.service';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private inboxService: InboxService) {}

  @Get('conversations')
  getConversations() {
    return this.inboxService.getConversations();
  }

  @Get('messages/:conversationId')
  getMessages(@Param('conversationId') conversationId: string) {
    return this.inboxService.getMessages(conversationId);
  }

  @Post('messages')
  recordMessage(
    @Body()
    dto: {
      conversationId: string;
      direction: 'INBOUND' | 'OUTBOUND';
      text: string;
      isInternalNote?: boolean;
      authorName?: string;
      metaMessageId?: string;
      templateId?: string;
      phone?: string;
      name?: string;
    },
  ) {
    return this.inboxService.recordMessage(dto);
  }
}
