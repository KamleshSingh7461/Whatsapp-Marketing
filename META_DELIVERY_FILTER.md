# Meta "not delivering" filter

Meta sometimes refuses to deliver a message to a particular person. Sending them more marketing messages only piles up
refusals, so the app remembers each refusal on the contact and leaves that person out of broadcasts for a rest period.

## What is remembered

When Meta's delivery-status webhook reports a refusal, the contact gets `attributes.metaDelivery`:

| Meta code | Meaning | Rest period |
|---|---|---|
| 131049 | Meta held back a marketing message to protect the person's experience | 14 days |
| 130472 | The person is in a Meta test group that gets no marketing | 14 days |
| 131050 | The person chose to stop marketing messages from us | 180 days |
| 131026 | Undeliverable: not on WhatsApp, old app, or terms not accepted | 30 days |

Every other code is ignored, because it says nothing about the person: 131042 (payment), 131047 (24-hour window),
rate limits and so on.

- A new refusal restarts the rest period. A longer rest already running is never shortened by a milder refusal.
- The same notice delivered twice is counted once.
- A delivered message clears a 131026 mark (the number works). It does **not** clear a marketing hold-back or an opt-out;
  those run out on their own.
- When the rest period ends the person is included in broadcasts again automatically.

## Where it applies

- **Broadcasts** (browser-sent and server-sent): resting people are left out and counted. The launch dialog says how many
  were left out. If everyone in the audience is resting, nothing is sent.
- **Contacts:** a "Meta not delivering until <date>" badge with the reason on hover.
- **Chats:** a note in the contact panel, and a warning in the "send template" dialog. Normal replies still work; a
  person who messages the business first opens a 24-hour window.
- It does **not** stop a person being messaged one-to-one from Chats. That stays your team's choice.

## Settings

`META_REST_DAYS` (1 to 365) in `apps/api/.env` changes the rest after 131049 and 130472. Default 14. Restart the API
after changing it.

## Releasing someone by hand

To let a person back into broadcasts before their rest ends (for example they have re-engaged):

```sql
UPDATE "Contact" SET "attributes" = "attributes" - 'metaDelivery' WHERE "phone" LIKE '%9167529242';
```

## No database change needed

The mark lives inside the existing `attributes` JSON column of `Contact`. There is no migration.

## Code

- Rules: `apps/api/src/delivery-blocks/delivery-blocks.logic.ts` (the only place that decides `until`)
- Recording: `apps/api/src/delivery-blocks/delivery-blocks.service.ts`, called from the webhook status handler
- Server broadcasts: `resolveRecipients` in `apps/api/src/campaigns/campaigns.service.ts`
- Browser: `apps/web/src/lib/metaDelivery.ts` (reads `until`) and `resolveCampaignAudience` in `apps/web/src/lib/campaignAudience.ts`

## Tests

```
cd apps/api
npx tsx src/delivery-blocks/delivery-blocks.logic.check.ts
npx tsx ../web/scripts/metaDelivery.check.ts
```
