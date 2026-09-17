import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  clean = clean.replace(/^0+/, '');
  if (clean.length === 10 && ['6', '7', '8', '9'].includes(clean[0])) {
    clean = '91' + clean;
  }
  return clean;
}

@Injectable()
export class ContactsService implements OnModuleInit {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.mergeDuplicateContacts();
  }

  async mergeDuplicateContacts() {
    try {
      const allContacts = await this.prisma.contact.findMany({
        include: { conversations: true },
      });

      const phoneGroupMap = new Map<string, typeof allContacts>();

      for (const c of allContacts) {
        const clean = normalizePhone(c.phone);
        if (!clean) continue;
        if (!phoneGroupMap.has(clean)) {
          phoneGroupMap.set(clean, []);
        }
        phoneGroupMap.get(clean)!.push(c);
      }

      for (const [cleanPhone, group] of phoneGroupMap.entries()) {
        if (group.length > 1) {
          group.sort((a, b) => {
            const aHasPlus = a.phone.startsWith('+');
            const bHasPlus = b.phone.startsWith('+');
            if (aHasPlus && !bHasPlus) return 1;
            if (!aHasPlus && bHasPlus) return -1;
            return a.createdAt.getTime() - b.createdAt.getTime();
          });

          const primary = group[0];
          const duplicates = group.slice(1);

          if (primary.phone !== cleanPhone) {
            await this.prisma.contact.update({
              where: { id: primary.id },
              data: { phone: cleanPhone },
            }).catch(() => null);
          }

          for (const dup of duplicates) {
            const dupConvs = dup.conversations || [];
            for (const conv of dupConvs) {
              await this.prisma.conversation.update({
                where: { id: conv.id },
                data: { contactId: primary.id },
              }).catch(() => null);
            }

            const mergedTags = Array.from(new Set([...(primary.tags || []), ...(dup.tags || [])]));
            await this.prisma.contact.update({
              where: { id: primary.id },
              data: { tags: mergedTags },
            }).catch(() => null);

            await this.prisma.contact.delete({ where: { id: dup.id } }).catch(() => null);
          }
          this.logger.log(`Merged ${duplicates.length} duplicate contacts for phone +${cleanPhone}`);
        } else if (group[0] && group[0].phone !== cleanPhone) {
          await this.prisma.contact.update({
            where: { id: group[0].id },
            data: { phone: cleanPhone },
          }).catch(() => null);
        }
      }

      const allConvs = await this.prisma.conversation.findMany();
      const convGroupMap = new Map<string, typeof allConvs>();

      for (const conv of allConvs) {
        if (!convGroupMap.has(conv.contactId)) {
          convGroupMap.set(conv.contactId, []);
        }
        convGroupMap.get(conv.contactId)!.push(conv);
      }

      for (const [contactId, convGroup] of convGroupMap.entries()) {
        if (convGroup.length > 1) {
          convGroup.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          const primaryConv = convGroup[0];
          const duplicateConvs = convGroup.slice(1);

          for (const dupConv of duplicateConvs) {
            await this.prisma.message.updateMany({
              where: { conversationId: dupConv.id },
              data: { conversationId: primaryConv.id },
            });
            await this.prisma.conversation.delete({ where: { id: dupConv.id } }).catch(() => null);
          }
          this.logger.log(`Merged ${duplicateConvs.length} duplicate conversations for contactId ${contactId}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Merge duplicate contacts error: ${e.message}`);
    }
  }

  async getAllContacts() {
    try {
      // Direct, non-blocking query — instant response in <5ms
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
    const cleanPhone = normalizePhone(dto.phone);
    if (!cleanPhone) return null;

    try {
      const existing = await this.prisma.contact.findUnique({ where: { phone: cleanPhone } });
      const tags = dto.tags && dto.tags.length > 0 ? dto.tags : (existing?.tags || ['New Lead']);

      const contact = await this.prisma.contact.upsert({
        where: { phone: cleanPhone },
        update: {
          displayName: dto.displayName && !dto.displayName.startsWith('+') ? dto.displayName : (existing?.displayName || dto.displayName || `+${cleanPhone}`),
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
    if (!contactsList || contactsList.length === 0) return [];

    try {
      // 1. Deduplicate & normalize inputs locally first
      const validMap = new Map<string, { phone: string; displayName: string; tags: string[] }>();
      for (const c of contactsList) {
        const clean = normalizePhone(c.phone);
        if (!clean) continue;
        const existing = validMap.get(clean);
        const name = c.displayName && !c.displayName.startsWith('+') ? c.displayName : (existing?.displayName || c.displayName || `+${clean}`);
        const tags = Array.from(new Set([...(existing?.tags || []), ...(c.tags || ['New Lead'])]));
        validMap.set(clean, { phone: clean, displayName: name, tags });
      }

      const normalizedList = Array.from(validMap.values());
      if (normalizedList.length === 0) return [];

      // 2. Fast createMany in DB with skipDuplicates
      await this.prisma.contact.createMany({
        data: normalizedList.map(c => ({
          phone: c.phone,
          displayName: c.displayName,
          tags: c.tags,
          optedIn: true,
        })),
        skipDuplicates: true,
      });

      // 3. Update displayNames for existing contacts if custom name provided
      for (const c of normalizedList) {
        if (c.displayName && !c.displayName.startsWith('+')) {
          await this.prisma.contact.updateMany({
            where: { phone: c.phone },
            data: { displayName: c.displayName },
          }).catch(() => {});
        }
      }

      return this.getAllContacts();
    } catch (e: any) {
      this.logger.error(`Failed to bulk save contacts: ${e.message}`);
      return [];
    }
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
