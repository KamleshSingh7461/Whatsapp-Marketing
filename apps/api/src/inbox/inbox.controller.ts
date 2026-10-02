import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
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

  @Post('conversations/:id/read')
  markAsRead(@Param('id') id: string) {
    return this.inboxService.markConversationRead(id);
  }

  @Patch('conversations/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: 'OPEN' | 'RESOLVED' }) {
    return this.inboxService.updateConversationStatus(id, body.status);
  }

  @Patch('conversations/:id/assign')
  assignAgent(@Param('id') id: string, @Body() body: { agent: string }) {
    return this.inboxService.updateConversationAgent(id, body.agent);
  }

  @Post('messages')
  recordMessage(
    @CurrentUser() user: AuthenticatedUser,
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
      status?: 'SENT' | 'DELIVERED' | 'FAILED';
      errorCode?: string;
      mediaId?: string;
      mediaType?: string;
      mimeType?: string;
      fileName?: string;
      fileSize?: number;
      caption?: string;
    },
  ) {
    return this.inboxService.recordMessage(dto, user);
  }

  // Edit a message the team sent. See decideEdit in message-view.logic.ts for what is allowed.
  @Patch('messages/:id')
  editMessage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { text: string }) {
    return this.inboxService.editMessage(id, body?.text, user);
  }
}
