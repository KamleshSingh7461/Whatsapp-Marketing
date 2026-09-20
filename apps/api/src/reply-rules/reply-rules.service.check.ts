// Run with: npx tsx src/reply-rules/reply-rules.service.check.ts
// End-to-end check of the rules engine against an in-memory fake database and a fake WhatsApp sender.
// (A real Meta button tap cannot be produced from a test, so the tap payload below is Meta's documented shape.)
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReplyRulesService } from './reply-rules.service';
import { CallLeadsService } from './call-leads.service';

let seq = 0;
const id = (p: string) => `${p}_${++seq}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

// ---- a tiny fake of the parts of Prisma the service uses
const match = (row: any, where: any = {}): boolean =>
  Object.entries(where).every(([k, cond]: [string, any]) => {
    const v = row[k];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(v);
      if ('not' in cond) return v !== cond.not;
      if ('gte' in cond || 'lte' in cond) return (!cond.gte || v >= cond.gte) && (!cond.lte || v <= cond.lte);
    }
    return v === cond;
  });

function makeWorld() {
  const db = {
    rules: [] as any[], leads: [] as any[], contacts: [] as any[], recipients: [] as any[], messages: [] as any[], templates: [] as any[],
    callLeads: [] as any[], callUpdates: [] as any[],
    users: [
      { id: 'u_admin', name: 'Asha Verma', role: 'ADMIN' },
      { id: 'u_mkt', name: 'Ravi Nair', role: 'MARKETER' },
    ] as any[],
  };
  let useq = 0;
  const bySeq = (a: any, b: any) => b.createdAt - a.createdAt || b._seq - a._seq;
  const prisma: any = {
    replyRule: {
      findMany: async ({ where, orderBy }: any = {}) => db.rules.filter(r => match(r, where)).sort((a, b) => (orderBy ? a.createdAt - b.createdAt : 0)),
      findUnique: async ({ where }: any) => db.rules.find(r => r.id === where.id) ?? null,
      create: async ({ data }: any) => { const r = { id: id('rule'), createdAt: new Date(), updatedAt: new Date(), ...data }; db.rules.push(r); return r; },
      update: async ({ where, data }: any) => Object.assign(db.rules.find(r => r.id === where.id), data),
      delete: async ({ where }: any) => { db.rules = db.rules.filter(r => r.id !== where.id); },
    },
    replyLead: {
      create: async ({ data }: any) => {
        if (db.leads.some(l => l.metaMessageId === data.metaMessageId && l.ruleId === data.ruleId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const l = { id: id('lead'), repliedAt: new Date(), ...data }; db.leads.push(l); return l;
      },
      count: async ({ where }: any) => db.leads.filter(l => match(l, where)).length,
      groupBy: async () => {
        const ids = [...new Set(db.leads.map(l => l.ruleId))];
        return ids.map(ruleId => ({ ruleId, _count: { _all: db.leads.filter(l => l.ruleId === ruleId).length }, _max: { repliedAt: new Date() } }));
      },
      findMany: async ({ where, include }: any) =>
        db.leads.filter(l => match(l, where)).sort((a, b) => b.repliedAt - a.repliedAt).map(l => ({ ...l, contact: include ? db.contacts.find(c => c.id === l.contactId) : undefined })),
    },
    contact: {
      findUnique: async ({ where }: any) => db.contacts.find(c => c.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(db.contacts.find(c => c.id === where.id), data),
    },
    campaignRecipient: {
      findFirst: async ({ where, orderBy }: any) => db.recipients.filter(r => match(r, where)).sort((a, b) => (orderBy ? b.sentAt - a.sentAt : 0))[0] ?? null,
    },
    message: {
      findFirst: async ({ where, orderBy }: any) => db.messages.filter(m => match(m, where)).sort((a, b) => (orderBy ? b.createdAt - a.createdAt : 0))[0] ?? null,
      create: async ({ data }: any) => { const m = { id: id('msg'), createdAt: new Date(), ...data }; db.messages.push(m); return m; },
    },
    template: { findUnique: async ({ where }: any) => db.templates.find(t => t.id === where.id) ?? null },
    user: { findUnique: async ({ where }: any) => db.users.find(u => u.id === where.id) ?? null },
    callLead: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.ruleId_contactId;
        const found = db.callLeads.find(c => c.ruleId === key.ruleId && c.contactId === key.contactId);
        if (found) {
          const { tapCount, ...rest } = update;
          Object.assign(found, rest, { tapCount: found.tapCount + (tapCount?.increment ?? 0) });
          return found;
        }
        const row = { id: id('cl'), callStatus: 'CALL_PENDING', remarks: null, tapCount: 1, firstTapAt: new Date(), lastTapAt: new Date(), statusUpdatedAt: null, statusUpdatedById: null, statusUpdatedByName: null, ...create };
        db.callLeads.push(row); return row;
      },
      findUnique: async ({ where }: any) => db.callLeads.find(c => c.id === where.id) ?? null,
      findMany: async ({ where, include }: any) =>
        db.callLeads.filter(c => match(c, where)).sort((a, b) => a.firstTapAt - b.firstTapAt).map(c => ({ ...c, contact: include ? db.contacts.find(x => x.id === c.contactId) : undefined })),
      update: async ({ where, data }: any) => Object.assign(db.callLeads.find(c => c.id === where.id), data),
      groupBy: async ({ by }: any) => {
        const keyOf = (c: any) => by.map((k: string) => c[k]).join('|');
        const groups = new Map<string, any[]>();
        for (const c of db.callLeads) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
        return [...groups.values()].map(g => ({ ...Object.fromEntries(by.map((k: string) => [k, g[0][k]])), _count: { _all: g.length }, _max: { lastTapAt: new Date(Math.max(...g.map(x => +x.lastTapAt))) } }));
      },
    },
    callLeadUpdate: {
      create: async ({ data }: any) => { const u = { id: id('upd'), createdAt: new Date(), _seq: ++useq, ...data }; db.callUpdates.push(u); return u; },
      findMany: async ({ where, orderBy, take, include }: any) => {
        let rows = db.callUpdates.filter(u => match(u, where));
        if (orderBy) rows = rows.sort(bySeq);
        if (take) rows = rows.slice(0, take);
        return rows.map(u => {
          if (!include) return u;
          const lead = db.callLeads.find(c => c.id === u.leadId);
          return { ...u, lead: { id: lead.id, rule: db.rules.find(r => r.id === lead.ruleId) ?? { id: lead.ruleId, name: '' }, contact: db.contacts.find(c => c.id === lead.contactId) } };
        });
      },
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  };
  const sent: Array<{ to: string; text: string }> = [];
  const whatsapp = { fail: false, sendTextMessage: async (dto: any) => { sent.push(dto); return whatsapp.fail ? { success: false, error: 'boom' } : { success: true, messageId: id('wamid.reply') }; } };
  const callLeads = new CallLeadsService(prisma);
  const service = new ReplyRulesService(prisma, whatsapp as any, callLeads);
  return { db, sent, whatsapp, service, callLeads, prisma };
}

// ---- helpers to build the world
const addContact = (w: any, tags: string[] = ['WhatsApp Inbound']) => { const c = { id: id('c'), phone: '919876543210', tags }; w.db.contacts.push(c); return c; };
const addRule = (w: any, over: any) => { const r = { id: id('rule'), name: 'r', templateName: null, buttonText: 'Yes', tags: [], replyText: null, active: true, createdAt: new Date(2026, 8, 1 + w.db.rules.length), updatedAt: new Date(), ...over }; w.db.rules.push(r); return r; };
const addBroadcast = (w: any, wamid: string, templateName: string, phone = '919876543210', sentAt = new Date()) =>
  w.db.recipients.push({ id: id('rcp'), metaMessageId: wamid, phone, status: 'DELIVERED', sentAt, campaign: { segmentJson: { templateName }, template: { name: templateName } } });
const tap = (wamid: string, label: string, contextId?: string, extra: any = {}) => ({
  from: '919876543210', id: wamid, type: 'button', button: { payload: label, text: label },
  ...(contextId ? { context: { from: '918655851749', id: contextId } } : {}), ...extra,
});
const run = (w: any, contact: any, message: any) => w.service.handleInbound({ message, contactId: contact.id, phone: contact.phone, conversationId: 'conv_1' });

(async () => {
  // 1. Day one: the seeded default (any template, "Yes"). Same result as the old behaviour: tags + reply.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'Yes reply (default)', tags: ['Hot Lead - Yes Opt-In', 'Hot Lead'], replyText: 'Expert will call you.' });
    addBroadcast(w, 'wamid.T1', 'summer_sale');
    await run(w, c, tap('wamid.IN1', 'Yes', 'wamid.T1'));
    assert.equal(w.db.leads.length, 1);
    assert.equal(w.db.leads[0].templateName, 'summer_sale');
    assert.deepEqual(c.tags, ['WhatsApp Inbound', 'Hot Lead - Yes Opt-In', 'Hot Lead']);
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].text, 'Expert will call you.');
    assert.equal(w.db.messages.filter(m => m.direction === 'OUTBOUND').length, 1);
    assert.equal(w.db.messages[0].payloadJson.authorName, 'FGSN Auto-Reply Bot');

    // 2. Meta retries the same webhook: nothing is duplicated, no second reply to the customer.
    await run(w, c, tap('wamid.IN1', 'Yes', 'wamid.T1'));
    assert.equal(w.db.leads.length, 1);
    assert.equal(w.sent.length, 1);
    assert.equal(w.db.messages.length, 1);
  }

  // 3. The decision: a typed "yes" (not a button tap) does nothing, even with a matching rule.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { tags: ['Hot Lead'], replyText: 'hi' });
    await run(w, c, { from: '919876543210', id: 'wamid.IN2', type: 'text', text: { body: 'yes' } });
    assert.equal(w.db.leads.length, 0);
    assert.equal(w.sent.length, 0);
    assert.deepEqual(c.tags, ['WhatsApp Inbound']);
  }

  // 4. THE CASE YOU ASKED ABOUT: the template changes to a different button ("Interested"). A new rule for that
  //    template works, with its own tag and no automatic reply; the old "Yes" rule is not involved.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'Yes reply (default)', tags: ['Hot Lead'], replyText: 'Expert will call you.' });
    addRule(w, { name: 'Tournament interest', templateName: 'tournament_promo', buttonText: 'Interested', tags: ['Tournament lead'], replyText: null });
    addBroadcast(w, 'wamid.T2', 'tournament_promo');
    await run(w, c, tap('wamid.IN3', 'Interested', 'wamid.T2'));
    assert.equal(w.db.leads.length, 1);
    assert.equal(w.db.leads[0].buttonText, 'Interested');
    assert.deepEqual(c.tags, ['WhatsApp Inbound', 'Tournament lead']);
    assert.equal(w.sent.length, 0); // this rule has no reply
    // ...and a customer who replies "Interested" to some OTHER template is not picked up by that rule.
    addBroadcast(w, 'wamid.T3', 'other_template');
    await run(w, c, tap('wamid.IN4', 'Interested', 'wamid.T3'));
    assert.equal(w.db.leads.length, 1);
  }

  // 5. Specific beats general: a rule for this template replaces the "any template" Yes rule for the same button.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'general', tags: ['Hot Lead'], replyText: 'general reply' });
    addRule(w, { name: 'course', templateName: 'course_offer', tags: ['Course lead'], replyText: 'course reply' });
    addBroadcast(w, 'wamid.T4', 'course_offer');
    await run(w, c, tap('wamid.IN5', 'yes', 'wamid.T4')); // note: lower case, still matches
    assert.equal(w.db.leads.length, 1);
    assert.deepEqual(c.tags, ['WhatsApp Inbound', 'Course lead']);
    assert.deepEqual(w.sent.map(s => s.text), ['course reply']);
  }

  // 6. Paused rules never fire.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { active: false, tags: ['Hot Lead'], replyText: 'hi' });
    addBroadcast(w, 'wamid.T5', 'summer_sale');
    await run(w, c, tap('wamid.IN6', 'Yes', 'wamid.T5'));
    assert.equal(w.db.leads.length, 0);
    assert.equal(w.sent.length, 0);
  }

  // 7. Meta names a message we cannot find (sent from WhatsApp Manager): template unknown, so only "any template"
  //    rules apply; a rule tied to a named template must NOT fire on a guess.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'named', templateName: 'course_offer', tags: ['Course lead'] });
    await run(w, c, tap('wamid.IN7', 'Yes', 'wamid.UNKNOWN'));
    assert.equal(w.db.leads.length, 0);
    addRule(w, { name: 'any', tags: ['Hot Lead'] });
    await run(w, c, tap('wamid.IN8', 'Yes', 'wamid.UNKNOWN'));
    assert.equal(w.db.leads.length, 1);
    assert.equal(w.db.leads[0].templateName, null);
  }

  // 8. No context at all: use the template most recently sent to this person (last 14 days), not an old one.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'course', templateName: 'course_offer', tags: ['Course lead'] });
    addBroadcast(w, 'wamid.OLD', 'course_offer', '919876543210', daysAgo(40)); // too old
    await run(w, c, tap('wamid.IN9', 'Yes'));
    assert.equal(w.db.leads.length, 0);
    addBroadcast(w, 'wamid.NEW', 'course_offer', '919876543210', daysAgo(2));
    await run(w, c, tap('wamid.IN10', 'Yes'));
    assert.equal(w.db.leads.length, 1);
  }

  // 9. The template was sent from a chat (a stored message, not a broadcast): found through the message row.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'course', templateName: 'course_offer', tags: ['Course lead'] });
    w.db.messages.push({ id: id('msg'), conversationId: 'conv_1', direction: 'OUTBOUND', metaMessageId: 'wamid.CHAT', templateId: 'tpl_1', createdAt: new Date(), payloadJson: { templateData: { name: 'course_offer' } } });
    await run(w, c, tap('wamid.IN11', 'Yes', 'wamid.CHAT'));
    assert.equal(w.db.leads.length, 1);
    // older rows only stored a template id: resolved through the templates table
    w.db.templates.push({ id: 'tpl_2', name: 'course_offer' });
    w.db.messages.push({ id: id('msg'), conversationId: 'conv_1', direction: 'OUTBOUND', metaMessageId: 'wamid.CHAT2', templateId: 'tpl_2', createdAt: new Date(), payloadJson: {} });
    await run(w, c, tap('wamid.IN12', 'Yes', 'wamid.CHAT2'));
    assert.equal(w.db.leads.length, 2);
  }

  // 10. WhatsApp refuses the reply: the tap is still recorded and tagged, nothing throws, no fake "sent" message.
  {
    const w = makeWorld(); const c = addContact(w); w.whatsapp.fail = true;
    addRule(w, { tags: ['Hot Lead'], replyText: 'hi' });
    addBroadcast(w, 'wamid.T6', 'summer_sale');
    await run(w, c, tap('wamid.IN13', 'Yes', 'wamid.T6'));
    assert.equal(w.db.leads.length, 1);
    assert.ok(c.tags.includes('Hot Lead'));
    assert.equal(w.db.messages.length, 0);
  }

  // 11. Two rules on the same template and button: both record the person, but only ONE reply goes out.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'a', templateName: 't', tags: ['A'], replyText: 'reply A' });
    addRule(w, { name: 'b', templateName: 't', tags: ['B'], replyText: 'reply B' });
    addBroadcast(w, 'wamid.T7', 't');
    await run(w, c, tap('wamid.IN14', 'Yes', 'wamid.T7'));
    assert.equal(w.db.leads.length, 2);
    assert.deepEqual(c.tags, ['WhatsApp Inbound', 'A', 'B']);
    assert.deepEqual(w.sent.map(s => s.text), ['reply A']);
  }

  // 12. Managing rules through the service.
  {
    const w = makeWorld(); const c = addContact(w);
    const created: any = await w.service.create({ name: 'Tournament interest', templateName: 'tournament_promo', buttonText: 'Interested', tags: 'Hot Lead, Tournament' });
    assert.deepEqual(created.tags, ['Hot Lead', 'Tournament']);
    await assert.rejects(() => w.service.create({ name: '', buttonText: 'Yes' }), /name/i);
    const paused: any = await w.service.update(created.id, { active: false });
    assert.equal(paused.active, false);
    assert.equal(paused.buttonText, 'Interested'); // pausing does not wipe other fields
    await assert.rejects(() => w.service.update('nope', { active: true }), /not found/i);
    // a rule with leads cannot be deleted; one without can
    addBroadcast(w, 'wamid.T8', 'tournament_promo');
    await w.service.update(created.id, { active: true });
    await run(w, c, tap('wamid.IN15', 'Interested', 'wamid.T8'));
    await assert.rejects(() => w.service.remove(created.id), ConflictException);
    const empty: any = await w.service.create({ name: 'Unused', buttonText: 'Nope' });
    assert.deepEqual(await w.service.remove(empty.id), { ok: true });
    // listing includes counts; leads come back with contact details
    const listed: any[] = await w.service.list();
    assert.equal(listed.find(r => r.id === created.id).leadCount, 1);
    const leads: any[] = await w.service.leads(created.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].contact.phone, '919876543210');
    assert.equal((await w.service.leads(created.id, '2999-01-01')).length, 0); // date filter
    await assert.rejects(() => w.service.leads(created.id, 'not-a-date'), /not valid/i);
  }

  // 13. THE CALL SHEET. The first tap puts the person on the rule's sheet as "Call pending". The same person tapping
  //     again (another broadcast, or the button twice) is still ONE row: the count goes up, nothing else changes.
  {
    const w = makeWorld(); const c = addContact(w);
    const admin = { userId: 'u_admin', role: 'ADMIN' as any };
    const mkt = { userId: 'u_mkt', role: 'MARKETER' as any };
    const rule = addRule(w, { name: 'Tournament interest', templateName: 't', buttonText: 'Yes', tags: ['Hot Lead'] });
    addBroadcast(w, 'wamid.C1', 't'); addBroadcast(w, 'wamid.C2', 't');
    await run(w, c, tap('wamid.IN20', 'Yes', 'wamid.C1'));
    assert.equal(w.db.callLeads.length, 1);
    assert.equal(w.db.callLeads[0].callStatus, 'CALL_PENDING');
    assert.equal(w.db.callLeads[0].tapCount, 1);
    await run(w, c, tap('wamid.IN20', 'Yes', 'wamid.C1')); // the same webhook again (retry): nothing changes
    assert.equal(w.db.callLeads[0].tapCount, 1);
    const leadId = w.db.callLeads[0].id;

    // 13a. Ravi (Marketing Manager) marks it called, not picked, with a remark. The change and the remark are logged.
    const r1: any = await w.callLeads.update(leadId, { status: 'CALLED_NOT_PICKED', remarks: '  Phone   switched off, retry after 6pm ' }, mkt);
    assert.equal(r1.status, 'CALLED_NOT_PICKED');
    assert.equal(r1.remarks, 'Phone switched off, retry after 6pm'); // spaces tidied
    assert.equal(r1.updatedBy, 'Ravi Nair');
    assert.equal(w.db.callUpdates.length, 1);
    assert.equal(w.db.callUpdates[0].byName, 'Ravi Nair');
    assert.equal(w.db.callUpdates[0].byRole, 'MARKETER');

    // 13b. The customer taps again on a different broadcast: still one row, count 2, and Ravi's status and remark stay.
    await run(w, c, tap('wamid.IN21', 'Yes', 'wamid.C2'));
    assert.equal(w.db.callLeads.length, 1);
    assert.equal(w.db.callLeads[0].tapCount, 2);
    assert.equal(w.db.callLeads[0].callStatus, 'CALLED_NOT_PICKED');
    assert.equal(w.db.callLeads[0].remarks, 'Phone switched off, retry after 6pm');

    // 13c. Asha (Operations Admin) updates the same lead. Both people's work is in the log, newest first.
    await w.callLeads.update(leadId, { status: 'CALL_DONE', remarks: 'Spoke to the parent. Wants a demo on Friday.' }, admin);
    const hist: any[] = await w.callLeads.history(leadId);
    assert.deepEqual(hist.map(h => [h.byName, h.status]), [['Asha Verma', 'CALL_DONE'], ['Ravi Nair', 'CALLED_NOT_PICKED']]);
    assert.equal(w.db.callLeads[0].statusUpdatedByName, 'Asha Verma');

    // 13d. The rule list counts people and shows how far the calls are.
    const listed: any[] = await w.service.list();
    const row = listed.find(r => r.id === rule.id);
    assert.equal(row.leadCount, 1);
    assert.deepEqual(row.callStatusCounts, { CALL_PENDING: 0, CALLED_NOT_PICKED: 0, CALL_DONE: 1, FOLLOW_UP_PENDING: 0 });

    // 13e. The sheet itself: one row per person with status, remarks and who last updated it.
    const sheet: any[] = await w.service.leads(rule.id);
    assert.equal(sheet.length, 1);
    assert.deepEqual([sheet[0].status, sheet[0].updatedBy, sheet[0].tapCount], ['CALL_DONE', 'Asha Verma', 2]);
    assert.equal(sheet[0].contact.phone, '919876543210');

    // 13f. Managers' overview: who did what in the period, where every lead stands, and the latest updates.
    const ov: any = await w.callLeads.overview(7);
    assert.equal(ov.people.length, 2);
    assert.deepEqual(ov.people.map((p: any) => p.name).sort(), ['Asha Verma', 'Ravi Nair']);
    assert.equal(ov.people.find((p: any) => p.name === 'Ravi Nair').byStatus.CALLED_NOT_PICKED, 1);
    assert.equal(ov.pipeline.CALL_DONE, 1);
    assert.equal(ov.recent.length, 2);
    assert.deepEqual([ov.recent[0].byName, ov.recent[0].contactName, ov.recent[0].ruleName], ['Asha Verma', '', 'Tournament interest']);
    assert.equal(ov.days, 7);
    assert.equal((await w.callLeads.overview('garbage') as any).days, 7);
    assert.equal((await w.callLeads.overview(1) as any).days, 1);

    // 13g. Refused updates: nothing changes and nothing is logged.
    const logged = w.db.callUpdates.length;
    await assert.rejects(() => w.callLeads.update(leadId, { status: 'CALL_DONE' }, admin), BadRequestException); // same status, no remark
    await assert.rejects(() => w.callLeads.update(leadId, { status: 'SOLD' }, admin), /Choose a call status/);
    await assert.rejects(() => w.callLeads.update(leadId, { status: 'CALL_DONE', remarks: 'x'.repeat(501) }, admin), /at most 500/);
    await assert.rejects(() => w.callLeads.update('missing', { status: 'CALL_DONE', remarks: 'x' }, admin), NotFoundException);
    assert.equal(w.db.callUpdates.length, logged);
    // the same status WITH a remark is allowed (adding a note)
    await w.callLeads.update(leadId, { status: 'CALL_DONE', remarks: 'Demo booked for Friday 4pm' }, admin);
    assert.equal(w.db.callLeads[0].remarks, 'Demo booked for Friday 4pm');
    // moving on to follow-up with no remark clears the old remark from the sheet (it stays in the history)
    await w.callLeads.update(leadId, { status: 'FOLLOW_UP_PENDING' }, mkt);
    assert.equal(w.db.callLeads[0].remarks, null);
    assert.equal((await w.callLeads.history(leadId) as any[]).length, logged + 2);
  }

  // 14. A team member who has since been removed: the update is still recorded, under a safe fallback name, and their
  //     earlier history is untouched.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { name: 'r', tags: [] }); addBroadcast(w, 'wamid.C3', 'x');
    await run(w, c, tap('wamid.IN22', 'Yes', 'wamid.C3'));
    const id0 = w.db.callLeads[0].id;
    await w.callLeads.update(id0, { status: 'CALL_DONE', remarks: 'done' }, { userId: 'u_mkt', role: 'MARKETER' as any });
    w.db.users = w.db.users.filter((u: any) => u.id !== 'u_mkt');
    await w.callLeads.update(id0, { status: 'FOLLOW_UP_PENDING', remarks: 'call again' }, { userId: 'u_mkt', role: 'MARKETER' as any });
    const h: any[] = await w.callLeads.history(id0);
    assert.deepEqual(h.map(x => x.byName), ['Unknown user', 'Ravi Nair']);
  }

  // 15. If adding someone to the call sheet fails, the tap is still recorded, the contact is still tagged and the reply
  //     still goes out.
  {
    const w = makeWorld(); const c = addContact(w);
    addRule(w, { tags: ['Hot Lead'], replyText: 'hi' }); addBroadcast(w, 'wamid.C4', 'x');
    (w.callLeads as any).recordTap = async () => { throw new Error('db hiccup'); };
    await run(w, c, tap('wamid.IN23', 'Yes', 'wamid.C4'));
    assert.equal(w.db.leads.length, 1);
    assert.ok(c.tags.includes('Hot Lead'));
    assert.equal(w.sent.length, 1);
  }

  console.log('reply-rules service: all scenarios passed');
})().catch(e => { console.error(e); process.exit(1); });
