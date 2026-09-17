import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private prisma: PrismaService) {}

  async getAllContacts() {
    try {
      const contacts = await this.prisma.contact.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return contacts.map(c => ({
        id: c.id,
        phone: c.phone,
        displayName: c.displayName || `+${c.phone}`,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
        optedIn: c.optedIn,
        tags: c.tags || ['New Lead'],
        lifetimeValue: (c.attributes as any)?.lifetimeValue || 0,
        attributes: c.attributes,
        createdAt: c.createdAt.toISOString(),
      }));
    } catch (e: any) {
      this.logger.error(`Failed to get contacts: ${e.message}`);
      return [];
    }
  }

  async saveContact(dto: { phone: string; displayName?: string; tags?: string[]; optedIn?: boolean }) {
    const cleanPhone = dto.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return null;

    try {
      const existing = await this.prisma.contact.findUnique({ where: { phone: cleanPhone } });
      const tags = dto.tags && dto.tags.length > 0 ? dto.tags : (existing?.tags || ['New Lead']);

      const contact = await this.prisma.contact.upsert({
        where: { phone: cleanPhone },
        update: {
          displayName: dto.displayName || existing?.displayName || `+${cleanPhone}`,
          tags: Array.from(new Set([...(existing?.tags || []), ...tags])),
          optedIn: dto.optedIn !== undefined ? dto.optedIn : true,
        },
        create: {
          phone: cleanPhone,
          displayName: dto.displayName || `+${cleanPhone}`,
          tags: tags,
          optedIn: dto.optedIn !== undefined ? dto.optedIn : true,
        },
      });

      return {
        id: contact.id,
        phone: contact.phone,
        displayName: contact.displayName,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
        optedIn: contact.optedIn,
        tags: contact.tags,
      };
    } catch (e: any) {
      this.logger.error(`Failed to save contact ${dto.phone}: ${e.message}`);
      throw e;
    }
  }

  async bulkSaveContacts(contactsList: Array<{ phone: string; displayName?: string; tags?: string[] }>) {
    const results = [];
    for (const c of contactsList) {
      try {
        const saved = await this.saveContact(c);
        if (saved) results.push(saved);
      } catch (e) {}
    }
    return results;
  }

  async autoCategorizeContacts() {
    try {
      const contacts = await this.prisma.contact.findMany({
        orderBy: { createdAt: 'asc' },
      });

      for (let index = 0; index < contacts.length; index++) {
        const c = contacts[index];
        let batchTag = 'Batch 1: Contacts 1 - 500';
        if (index >= 500 && index < 1000) batchTag = 'Batch 2: Contacts 501 - 1000';
        else if (index >= 1000 && index < 2000) batchTag = 'Batch 3: Contacts 1001 - 2000';
        else if (index >= 2000) batchTag = 'Batch 4: Contacts 2001 - 3000';

        const existingTags = c.tags || [];
        const newTags = Array.from(new Set([...existingTags, batchTag]));

        await this.prisma.contact.update({
          where: { id: c.id },
          data: { tags: newTags },
        });
      }

      return this.getAllContacts();
    } catch (e: any) {
      this.logger.error(`Failed to auto categorize contacts: ${e.message}`);
      throw e;
    }
  }
}
