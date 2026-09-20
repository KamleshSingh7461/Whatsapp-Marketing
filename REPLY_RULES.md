# Reply rules and call sheets

A **reply rule** says: *when a customer taps this button on this template, do this.* It replaces the old hard-coded "Yes"
detection. Rules are managed on the **Automations** page. Everyone who taps a rule's button lands on that rule's **call
sheet**, on the **Call sheets** page, where the team records the follow-up calls.

## What a rule does

| Part | Meaning |
|---|---|
| Template | The Meta template the button belongs to, or **Any template**. |
| Button | The button label the customer tapped. Case and extra spaces are ignored. |
| Tags | Added to the contact. Optional. |
| Automatic reply | Sent as a normal message (allowed because the tap opens the 24-hour window). Optional. |

## How a tap is decided

- Only a real tap on a template quick-reply button counts (`type: "button"` in Meta's webhook). A typed "yes" does nothing.
- Meta's `context.id` is the id of the message that held the button. It is looked up in broadcast recipients
  (`CampaignRecipient.metaMessageId`) and in stored chat messages (`Message.metaMessageId`) to find the template.
- A rule for a **named template** beats an **Any template** rule for the same button.
- If the template cannot be found (for example it was sent from WhatsApp Manager), only **Any template** rules apply.
- If Meta sends no `context` at all, the template most recently sent to that person in the last 14 days is used.
- The same webhook delivered twice is harmless: one record, one tag update, one reply.

## Call sheets

- **One row per person per rule.** The first tap adds the person as **Call pending**. Tapping again (another broadcast, or the
  button twice) only raises the tap count and shows a **Tapped again** flag; their status and remarks are never reset.
- **Statuses:** Call pending, Called, not picked, Call done, Follow up pending. Each update can carry a remark (up to 500 characters).
- **Every change is logged** (`CallLeadUpdate`) with who made it, their role and when. The log is append-only. It is not tied to
  the user account, so removing a team member never deletes or blocks their history.
- **Team activity** (second tab on the Call sheets page) shows, for the last 24 hours, 7 days or 30 days: where every lead stands,
  what each team member did (updates, leads worked, calls done, not picked, follow ups) and the latest updates with their remarks.
- The sheet refreshes every 30 seconds, so people working the same sheet see each other's updates. If two people update the same
  lead, the last save wins and both entries stay in the history.
- **Download** exports exactly the rows on screen (respecting the status, search and "updated by" filters).
- A rule that already has people cannot be deleted (pause it), so call sheets stay complete.

## Who can do what

| Role | Chats | Call sheets and rules |
|---|---|---|
| Marketing Manager (`MARKETER`) | yes | yes |
| Operations Admin and Super Admin (`ADMIN`) | yes | yes |
| Support Agent (`AGENT`) | yes, and nothing else is shown | no |
| Viewer (`VIEWER`) | yes | no |

## When you change a template

Add a new rule for the new template and button. Old rules keep collecting taps from old broadcasts, and each rule has its
own call sheet, so campaigns are never mixed.

## Deploying

1. Apply both migrations, in order (`npx prisma migrate deploy` in production, `npx prisma migrate dev` locally):
   - `20260919230000_reply_rules`: the rules, the per-tap record, and a starting rule
   - `20260920100000_call_leads`: the call sheet tables. It only adds tables and carries anyone already recorded onto the
     sheets as "Call pending". Nothing existing is changed.
2. Regenerate the Prisma client and restart the API (`npm run build` does the generate step).

Until the migrations are applied, the Automations and Call sheets pages show an error and taps are ignored. Inbound
messages are still saved normally.

The first migration adds one starting rule, **Yes reply (default)**: a tap on any button that says "Yes" adds the tags
`Hot Lead - Yes Opt-In` and `Hot Lead` and sends the same reply as before. Edit or pause it on the Automations page.

## Checking it with one real tap

Send the template to your own test number and tap the button. Expect: the tag on the contact, the automatic reply, the person
on the rule's call sheet as "Call pending", and an API log line like `Button "Yes" from +91… (template: …) handled by 1 rule(s).`

## Tests

```
cd apps/api
npx tsx src/reply-rules/reply-rules.logic.check.ts     # matching, using Meta's documented button payload
npx tsx src/reply-rules/call-leads.logic.check.ts      # statuses, validation, the per-person summary
npx tsx src/reply-rules/reply-rules.service.check.ts   # the whole flow, including the call sheet, against an in-memory database
```
