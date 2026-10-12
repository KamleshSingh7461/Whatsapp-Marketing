// Run with: npx tsx src/contacts/contact-batches.logic.check.ts
import assert from 'node:assert/strict';
import { BATCH_SIZE, BatchContact, batchNumberOf, batchTag, isBatchLikeTag, planBatches } from './contact-batches.logic';

const B = batchTag;
const people = (n: number, from = 0, tags: string[] = []): BatchContact[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${from + i}`, tags: [...tags] }));
const sizes = (plan: ReturnType<typeof planBatches>) =>
  Object.fromEntries([...plan.add.entries()].map(([n, ids]) => [n, ids.length]));

// ---- tag names: Batch 1 and 2 keep their old names; later batches are 500 wide
assert.equal(B(1), 'Batch 1: Contacts 1 - 500');
assert.equal(B(2), 'Batch 2: Contacts 501 - 1000');
assert.equal(B(3), 'Batch 3: Contacts 1001 - 1500');
assert.equal(B(12), 'Batch 12: Contacts 5501 - 6000');
assert.equal(batchNumberOf(B(7)), 7);
assert.equal(batchNumberOf('Batch 3: Contacts 1001 - 2000'), null, 'old wide batch is not a current batch');
assert.equal(isBatchLikeTag('Batch 3: Contacts 1001 - 2000'), true);
assert.equal(isBatchLikeTag('VIP Customers'), false);
console.log('ok  batch names: 500 each, Batch 1 and 2 unchanged');

// ---- nobody batched yet: 1,234 contacts -> 500 / 500 / 234
{
  const plan = planBatches(people(1234), new Set());
  assert.deepEqual(sizes(plan), { 1: 500, 2: 500, 3: 234 });
  assert.equal(plan.add.get(1)![0], 'c0', 'oldest contact first');
  assert.equal(plan.add.get(3)![0], 'c1000');
  console.log('ok  fresh contacts are split 500 / 500 / rest, oldest first');
}

// ---- the live case: Batch 1 and 2 were broadcast to; 1,200 new contacts -> Batch 3, 4, 5
{
  const contacts = [...people(500, 0, [B(1)]), ...people(500, 500, [B(2)]), ...people(1200, 1000)];
  const plan = planBatches(contacts, new Set([B(1), B(2)]));
  assert.deepEqual(sizes(plan), { 3: 500, 4: 500, 5: 200 });
  assert.equal(plan.replaceTags.length, 0);
  console.log('ok  after Batch 1 and 2 were sent, new contacts fill Batch 3, 4, 5');
}

// ---- already batched: nothing to do
{
  const contacts = [...people(500, 0, [B(1)]), ...people(120, 500, [B(2)])];
  const plan = planBatches(contacts, new Set());
  assert.equal(plan.add.size, 0);
  console.log('ok  nothing changes when everyone already has a batch');
}

// ---- the newest batch is topped up while it has room and was not sent; earlier gaps are never filled
{
  const contacts = [...people(480, 0, [B(1)]), ...people(300, 480, [B(2)]), ...people(250, 780)];
  const plan = planBatches(contacts, new Set());
  assert.deepEqual(sizes(plan), { 2: 200, 3: 50 }, 'Batch 1 (480 after deletions) is not topped up');
  console.log('ok  only the newest batch is topped up; gaps in earlier batches stay');
}

// ---- once the newest batch was broadcast to, it takes nobody new, even with room
{
  const contacts = [...people(500, 0, [B(1)]), ...people(300, 500, [B(2)]), ...people(10, 800)];
  const plan = planBatches(contacts, new Set([B(2)]));
  assert.deepEqual(sizes(plan), { 3: 10 });
  console.log('ok  a batch that was sent never gets new members');
}

// ---- old wide batches: unused ones are replaced by 500-size batches; sent ones are left alone
{
  const old3 = 'Batch 3: Contacts 1001 - 2000';
  const contacts = [...people(500, 0, [B(1)]), ...people(500, 500, [B(2)]), ...people(700, 1000, [old3, 'VIP'])];
  const unused = planBatches(contacts, new Set([B(1), B(2)]));
  assert.deepEqual(sizes(unused), { 3: 500, 4: 200 });
  assert.equal(unused.replaceTags.length, 700);
  assert.deepEqual(unused.replaceTags[0].tags, ['VIP'], 'old tag removed, other tags kept');

  const sent = planBatches(contacts, new Set([B(1), B(2), old3]));
  assert.equal(sent.add.size, 0, 'people in a sent old batch stay where they are');
  assert.equal(sent.replaceTags.length, 0);
  console.log('ok  old wide batches are re-split unless a broadcast already went to them');
}

// ---- contacts recovered from send records go back to their batch, not a new one
{
  const contacts = [...people(499, 0, [B(1)]), { id: 'lost', tags: [] }, ...people(3, 600)];
  const plan = planBatches(contacts, new Set([B(1)]), new Map([['lost', 1]]));
  assert.deepEqual(plan.add.get(1), ['lost']);
  assert.deepEqual(sizes(plan), { 1: 1, 2: 3 });
  console.log('ok  someone who received a batch broadcast but lost the tag is put back in that batch');
}

// ---- large import keeps every batch at exactly 500
{
  const plan = planBatches(people(5 * BATCH_SIZE + 1), new Set());
  assert.deepEqual(sizes(plan), { 1: 500, 2: 500, 3: 500, 4: 500, 5: 500, 6: 1 });
  console.log('ok  2,501 contacts -> five batches of 500 and one of 1');
}
