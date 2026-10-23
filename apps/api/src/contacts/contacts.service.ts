import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Contact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyTagEdit, batchNumberOf, batchTag, isBatchLikeTag, needsBatch, planBatches } from './contact-batches.logic';

// Cohorts the Contacts page can set (kept in contact.attributes.rfmSegment).
const RFM_SEGMENTS = ['NEW_LEADS', 'CHAMPIONS', 'LOYAL_CUSTOMERS', 'POTENTIAL_LOYALIST', 'AT_RISK'];

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

  /** Changes whenever a contact is added, removed or changed (tags, name, opt-in, Meta delivery mark). */
  async contactsVersion(): Promise<string> {
    const a = await this.prisma.contact.aggregate({ _count: { _all: true }, _max: { updatedAt: true } });
    return `${a._count._all}.${a._max.updatedAt?.getTime() ?? 0}`;
  }

  /**
   * For tabs that refresh every few seconds: `unchanged` when the tab already has this version, otherwise every
   * contact with the new version. New contacts change the version, so they are still put into batches here.
   */
  async getContactsSince(since: string) {
    const version = await this.contactsVersion();
    if (since && since === version) return { unchanged: true, version };
    // The version read BEFORE the list: if anything changes meanwhile, the next refresh sees a newer version.
    return { version, contacts: await this.getAllContacts() };
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

      return contacts.map(c => this.toDto(c));
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
    if (!contactsList || contactsList.length === 0) return { received: 0, saved: 0, created: 0 };

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
      if (normalizedList.length === 0) return { received: contactsList.length, saved: 0, created: 0 };

      // Which of these numbers we already have, in one query (their names may need updating below).
      const existing = await this.prisma.contact.findMany({
        where: { phone: { in: normalizedList.map(c => c.phone) } },
        select: { phone: true, displayName: true },
      });
      const existingName = new Map(existing.map(e => [e.phone, e.displayName]));

      // 2. Fast createMany in DB with skipDuplicates
      const created = await this.prisma.contact.createMany({
        data: normalizedList.map(c => ({
          phone: c.phone,
          displayName: c.displayName,
          tags: c.tags,
          optedIn: true,
        })),
        skipDuplicates: true,
      });

      // 3. Existing contacts: update the name only where a real, different name was given (one query each, and only
      // for those; new contacts already have theirs).
      const renames = normalizedList.filter(
        c => existingName.has(c.phone) && c.displayName && !c.displayName.startsWith('+') && existingName.get(c.phone) !== c.displayName,
      );
      if (renames.length > 0) {
        await this.prisma
          .$transaction(renames.map(c => this.prisma.contact.update({ where: { phone: c.phone }, data: { displayName: c.displayName } })))
          .catch((e: any) => this.logger.warn(`Could not update names during import: ${e.message}`));
      }

      // New contacts get their batch now rather than on the next page load.
      if (created.count > 0) await this.ensureBatches().catch((e: any) => this.logger.warn(`Could not batch new contacts: ${e.message}`));

      // A summary, not the whole list: the importer loads the list once at the end (it used to come back with every chunk).
      return { received: contactsList.length, saved: normalizedList.length, created: created.count };
    } catch (e: any) {
      this.logger.error(`Failed to bulk save contacts: ${e.message}`);
      return { received: contactsList.length, saved: 0, created: 0, error: e.message };
    }
  }

  private toDto(c: Contact) {
    const attrs = (c.attributes as any) || {};
    return {
      id: c.id,
      phone: c.phone,
      displayName: c.displayName || `+${c.phone}`,
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
      optedIn: c.optedIn,
      optedInAt: c.optedInAt ? c.optedInAt.toISOString() : null,
      tags: c.tags || ['New Lead'],
      rfmSegment: attrs.rfmSegment || undefined,
      lifetimeValue: attrs.lifetimeValue || 0,
      attributes: c.attributes,
      createdAt: c.createdAt.toISOString(),
    };
  }

  /**
   * An edit from the Contacts page: name, cohort, opt-in, and the tags the person added or removed. Tags are applied to
   * what the contact has now (see applyTagEdit), batch tags are never touched, and the phone number is not editable
   * here because chats are linked to it. The row is locked while it is changed, so a concurrent update is not lost.
   */
  async updateContact(
    id: string,
    dto: { displayName?: string; optedIn?: boolean; rfmSegment?: string; addTags?: unknown[]; removeTags?: unknown[] },
  ) {
    const name = dto.displayName === undefined ? undefined : String(dto.displayName).trim().slice(0, 100);
    if (name !== undefined && !name) throw new BadRequestException('The name cannot be empty.');
    if (dto.rfmSegment !== undefined && !RFM_SEGMENTS.includes(dto.rfmSegment)) {
      throw new BadRequestException('Unknown cohort.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT 1 FROM "Contact" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.contact.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('That contact no longer exists.');

      const attrs = ((current.attributes as any) || {}) as Record<string, any>;
      const turningOn = dto.optedIn === true && !current.optedIn;
      return tx.contact.update({
        where: { id },
        data: {
          ...(name !== undefined ? { displayName: name } : {}),
          ...(dto.optedIn !== undefined ? { optedIn: !!dto.optedIn } : {}),
          ...(turningOn ? { optedInAt: new Date() } : {}),
          ...(dto.rfmSegment !== undefined ? { attributes: { ...attrs, rfmSegment: dto.rfmSegment } } : {}),
          tags: applyTagEdit(current.tags || [], Array.isArray(dto.addTags) ? dto.addTags : [], Array.isArray(dto.removeTags) ? dto.removeTags : []),
        },
      });
    });
    return this.toDto(updated);
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

  /** True when someone still needs a batch (see needsBatch). Cheap when everyone already has one. */
  private async needsBatching(contacts: Array<{ tags: string[] }>) {
    const unbatched = contacts.filter(c => !(c.tags || []).some(t => batchNumberOf(t) !== null));
    if (unbatched.length === 0) return false;
    if (unbatched.some(c => !(c.tags || []).some(isBatchLikeTag))) return true;
    // Only people with an old wide batch tag are left: they need a batch unless a broadcast used that old tag.
    const campaigns = await this.prisma.campaign.findMany({ where: { status: { not: 'DRAFT' } }, select: { segmentJson: true } });
    const sent = new Set(campaigns.flatMap(c => ((c.segmentJson as any)?.targetTags || []) as string[]));
    return unbatched.some(c => needsBatch(c.tags || [], sent));
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

        // The only write: append one batch tag to each contact that needs one. Nothing is removed or overwritten.
        const plan = planBatches(contacts, sentTags, recovered);
        let placed = 0;
        for (const [n, ids] of plan.add) {
          for (let i = 0; i < ids.length; i += 1000) {
            const chunk = ids.slice(i, i + 1000);
            await tx.contact.updateMany({ where: { id: { in: chunk } }, data: { tags: { push: batchTag(n) } } });
          }
          placed += ids.length;
        }
        if (placed > 0) {
          const where = [...plan.add.entries()].map(([n, ids]) => `Batch ${n} +${ids.length}`).join(', ');
          this.logger.log(`Batches: placed ${placed} contact(s) (${where})`);
        }
      },
      { maxWait: 30_000, timeout: 120_000 },
    );
  }
}
