import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { batchNumberOf, batchTag, isBatchLikeTag, planBatches } from './contact-batches.logic';

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
      let contacts = await this.prisma.contact.findMany({
        orderBy: { createdAt: 'desc' },
      });

      // New contacts (uploads, manual adds, people who message in) get their batch here, so batches are always
      // up to date without anyone pressing a button. Only does work when someone has no batch yet.
      if (await this.needsBatching(contacts)) {
        try {
          await this.ensureBatches();
          contacts = await this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
        } catch (e: any) {
          this.logger.warn(`Could not sort new contacts into batches: ${e.message}`);
        }
      }

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

  /** The "Sort contacts into batches" action: batching is automatic now, this just runs it straight away. */
  async autoCategorizeContacts() {
    try {
      await this.ensureBatches();
      return this.getAllContacts();
    } catch (e: any) {
      this.logger.error(`Failed to sort contacts into batches: ${e.message}`);
      throw e;
    }
  }

  /** True when someone has no batch, or still has an old wide batch tag that no broadcast used. */
  private async needsBatching(contacts: Array<{ tags: string[] }>) {
    if (contacts.some(c => !(c.tags || []).some(isBatchLikeTag))) return true;
    const oldTags = new Set(contacts.flatMap(c => (c.tags || []).filter(t => isBatchLikeTag(t) && batchNumberOf(t) === null)));
    if (oldTags.size === 0) return false;
    const campaigns = await this.prisma.campaign.findMany({ where: { status: { not: 'DRAFT' } }, select: { segmentJson: true } });
    const sent = new Set(campaigns.flatMap(c => ((c.segmentJson as any)?.targetTags || []) as string[]));
    return [...oldTags].some(t => !sent.has(t));
  }

  private batching: Promise<void> | null = null;

  /**
   * Puts every contact without a batch into one (500 per batch, see contact-batches.logic.ts). Runs one at a time, and
   * under a database lock so two API processes can never hand out the same places.
   */
  ensureBatches(): Promise<void> {
    if (!this.batching) {
      this.batching = this.assignBatches().finally(() => {
        this.batching = null;
      });
    }
    return this.batching;
  }

  private async assignBatches() {
    await this.prisma.$transaction(
      async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4815162342)`;

        const contacts = await tx.contact.findMany({
          select: { id: true, phone: true, tags: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        // Batches a broadcast already went to: they keep exactly the people they were sent to.
        const campaigns = await tx.campaign.findMany({ select: { id: true, status: true, segmentJson: true } });
        const sentTags = new Set<string>();
        const serverSentByBatch = new Map<string, number>();
        for (const c of campaigns) {
          if (c.status === 'DRAFT') continue;
          const seg = (c.segmentJson as any) || {};
          for (const tag of (seg.targetTags || []) as string[]) {
            if (!isBatchLikeTag(tag)) continue;
            sentTags.add(tag);
            const n = batchNumberOf(tag);
            if (n !== null && seg.serverSend) serverSentByBatch.set(c.id, n);
          }
        }

        // People the server's send records show received a batch broadcast, in case their batch tag went missing.
        const recovered = new Map<string, number>();
        if (serverSentByBatch.size > 0) {
          const idByPhone = new Map(contacts.map(c => [c.phone, c.id]));
          const rows = await tx.campaignRecipient.findMany({
            where: { campaignId: { in: [...serverSentByBatch.keys()] } },
            select: { campaignId: true, contactId: true, phone: true },
          });
          for (const r of rows) {
            const id = r.contactId || idByPhone.get(r.phone);
            const n = serverSentByBatch.get(r.campaignId)!;
            if (id && !(recovered.get(id)! <= n)) recovered.set(id, n);
          }
        }

        const plan = planBatches(contacts, sentTags, recovered);
        for (const r of plan.replaceTags) {
          await tx.contact.update({ where: { id: r.id }, data: { tags: r.tags } });
        }
        let placed = 0;
        for (const [n, ids] of plan.add) {
          for (let i = 0; i < ids.length; i += 1000) {
            const chunk = ids.slice(i, i + 1000);
            await tx.contact.updateMany({ where: { id: { in: chunk } }, data: { tags: { push: batchTag(n) } } });
          }
          placed += ids.length;
        }
        if (placed > 0 || plan.replaceTags.length > 0) {
          const where = [...plan.add.entries()].map(([n, ids]) => `Batch ${n} +${ids.length}`).join(', ');
          this.logger.log(`Batches: placed ${placed} contact(s) (${where || 'none'}); old batch tags replaced on ${plan.replaceTags.length}`);
        }
      },
      { maxWait: 30_000, timeout: 120_000 },
    );
  }
}
