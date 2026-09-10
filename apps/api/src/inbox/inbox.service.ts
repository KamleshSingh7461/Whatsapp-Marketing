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
          displayName: c.contact.displayName || `+${c.contact.phone}`,
          optedIn: c.contact.optedIn,
          tags: c.contact.tags || ['New Lead'],
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
          authorName: (c.messages[0].payloadJson as any)?.authorName,
          isInternalNote: (c.messages[0].payloadJson as any)?.isInternalNote,
        } : null,
      }));
    } catch (e: any) {
      this.logger.warn(`Could not query conversations from DB: ${e.message}`);
      return [];
    }
  }

  async getMessages(conversationId: string) {
    try {
      let messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      // If no messages found directly and conversationId has conv_ prefix, search via Contact
      if (messages.length === 0 && conversationId.startsWith('conv_')) {
        const phone = conversationId.replace('conv_', '').replace(/[^0-9]/g, '');
        if (phone) {
          const contact = await this.prisma.contact.findUnique({
            where: { phone },
            include: { conversations: true },
          });
          if (contact && contact.conversations.length > 0) {
            const convIds = contact.conversations.map((c) => c.id);
            messages = await this.prisma.message.findMany({
              where: { conversationId: { in: convIds } },
              orderBy: { createdAt: 'asc' },
            });
          }
        }
      }

      return messages.map((m) => ({
        id: m.id,
        conversationId: conversationId,
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
    phone?: string;
    name?: string;
  }) {
    try {
      let conv = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
      });

      if (!conv) {
        let phone = dto.phone;
        if (!phone && dto.conversationId.startsWith('conv_')) {
          phone = dto.conversationId.replace('conv_', '').replace(/[^0-9]/g, '');
        }

        if (phone) {
          const contact = await this.prisma.contact.upsert({
            where: { phone },
            update: {
              optedIn: true,
              displayName: dto.name || undefined,
            },
            create: {
              phone,
              displayName: dto.name || `+${phone}`,
              optedIn: true,
              tags: ['New Lead'],
            },
          });

          const existingConv = await this.prisma.conversation.findFirst({
            where: {
              OR: [{ contactId: contact.id }, { id: dto.conversationId }],
            },
          });

          if (existingConv) {
            conv = existingConv;
          } else {
            conv = await this.prisma.conversation.create({
              data: {
                id: dto.conversationId,
                contactId: contact.id,
                windowExpiresAt: new Date(Date.now() + 24 * 3600000),
              },
            });
          }
        }
      }

      if (!conv) {
        this.logger.warn(`Could not find or create conversation for ID: ${dto.conversationId}`);
        return {
          id: `msg_${Date.now()}`,
          conversationId: dto.conversationId,
          direction: dto.direction,
          status: 'DELIVERED',
          content: dto.text,
          timestamp: new Date().toISOString(),
        };
      }

      const msg = await this.prisma.message.create({
        data: {
          conversationId: conv.id,
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
        where: { id: conv.id },
        data: {
          updatedAt: new Date(),
          windowExpiresAt: new Date(Date.now() + 24 * 3600000),
        },
      }).catch(() => null);

      return {
        id: msg.id,
        conversationId: conv.id,
        direction: msg.direction,
        status: msg.status,
        content: dto.text,
        timestamp: msg.createdAt.toISOString(),
        authorName: dto.authorName,
        isInternalNote: dto.isInternalNote,
      };
    } catch (e: any) {
      this.logger.error(`Could not persist message to database: ${e.message}`);
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
