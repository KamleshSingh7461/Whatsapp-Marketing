import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection, MessageStatus } from '@prisma/client';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private prisma: PrismaService) {}

  async getConversations() {
    try {
      const conversations = await this.prisma.conversation.findMany({
        include: {
          contact: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return conversations.map((c) => ({
        id: c.id,
        contact: {
          id: c.contact.id,
          phone: c.contact.phone,
          displayName: c.contact.displayName || c.contact.phone,
          optedIn: c.contact.optedIn,
          tags: c.contact.tags,
        },
        windowExpiresAt: c.windowExpiresAt ? c.windowExpiresAt.toISOString() : new Date(Date.now() + 24 * 3600000).toISOString(),
        unreadCount: 0,
        status: 'OPEN',
        lastMessage: c.messages[0] ? {
          id: c.messages[0].id,
          conversationId: c.id,
          direction: c.messages[0].direction,
          status: c.messages[0].status,
          content: (c.messages[0].payloadJson as any)?.body || (c.messages[0].payloadJson as any)?.text || 'Message',
          timestamp: c.messages[0].createdAt.toISOString(),
        } : null,
      }));
    } catch (e: any) {
      this.logger.warn(`Could not query conversations from DB: ${e.message}`);
      return [];
    }
  }

  async getMessages(conversationId: string) {
    try {
      const messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      return messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        direction: m.direction,
        status: m.status,
        content: (m.payloadJson as any)?.body || (m.payloadJson as any)?.text || '',
        isInternalNote: (m.payloadJson as any)?.isInternalNote || false,
        authorName: (m.payloadJson as any)?.authorName,
        timestamp: m.createdAt.toISOString(),
      }));
    } catch (e: any) {
      this.logger.warn(`Could not query messages for conversation ${conversationId}: ${e.message}`);
      return [];
    }
  }

  async recordMessage(dto: {
    conversationId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    text: string;
    isInternalNote?: boolean;
    authorName?: string;
    metaMessageId?: string;
    templateId?: string;
  }) {
    try {
      const msg = await this.prisma.message.create({
        data: {
          conversationId: dto.conversationId,
          direction: dto.direction === 'INBOUND' ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
          status: MessageStatus.DELIVERED,
          metaMessageId: dto.metaMessageId,
          templateId: dto.templateId,
          payloadJson: {
            body: dto.text,
            isInternalNote: dto.isInternalNote,
            authorName: dto.authorName,
          },
        },
      });

      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { updatedAt: new Date() },
      }).catch(() => null);

      return {
        id: msg.id,
        conversationId: msg.conversationId,
        direction: msg.direction,
        status: msg.status,
        content: dto.text,
        timestamp: msg.createdAt.toISOString(),
      };
    } catch (e: any) {
      this.logger.warn(`Could not persist message to database: ${e.message}`);
      return {
        id: `msg_${Date.now()}`,
        conversationId: dto.conversationId,
        direction: dto.direction,
        status: 'DELIVERED',
        content: dto.text,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
