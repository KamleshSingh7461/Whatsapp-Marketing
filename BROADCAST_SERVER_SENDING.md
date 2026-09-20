# Server-side broadcast sending

Broadcasts used to be sent by a loop running **in the browser tab**: closing the tab stopped the send,
and the delivered / read numbers on the Broadcasts page were estimates written once at launch.

With server-side sending, the **API owns the send**. Every recipient becomes a row in the database, a
background worker sends them at a safe pace, Meta's delivery receipts advance each row, and the
Broadcasts page shows real, live progress.

It is **OFF by default**. Deploying this code changes nothing until you switch it on.

## How it works

1. **Launch.** The ERP calls `POST /api/campaigns/launch`. The server checks the template, resolves the
   audience (opted-in contacts only), creates the campaign and one `CampaignRecipient` row per contact
   (`QUEUED`), and returns immediately. The browser can be closed.
2. **Worker.** Inside the API, a loop claims small batches of `QUEUED` rows (`FOR UPDATE SKIP LOCKED`),
   marks them `SENDING`, calls Meta at up to `BROADCAST_MSGS_PER_SEC`, then records `SENT` (with the
   Meta message id) or `FAILED` (with Meta's error code and message).
3. **Receipts.** Meta's webhook already arrives at `/api/webhooks/whatsapp`. Each `delivered` / `read` /
   `failed` receipt is matched on the message id and advances that recipient **forwards only**
   (`SENT → DELIVERED → READ`), so a late or out-of-order receipt can never move it backwards.
4. **Progress.** The Broadcasts page shows sent / delivered / read / failed per campaign, refreshed every
   2 s while something is sending. **Details** lists each failed recipient with the Meta error, and has
   **Retry failed**. **Pause / Resume / Cancel** act on the whole campaign.

All state is in Postgres, so a restart or crash loses nothing.

## Safeguards

- **At-most-once.** A row is marked `SENDING` before Meta is called. If the server dies in that window the
  outcome is unknown, so on restart the row becomes `FAILED` / `INTERRUPTED` and is **not** retried
  automatically. A duplicate marketing message is worse than a missed one. An admin can press
  **Retry failed**.
- **No duplicates.** One row per contact per campaign (unique constraint).
- **Opt-in only.** An audience that matches nobody sends to nobody, never to everybody.
- **Meta limits.** Sending is paced. If Meta throttles (codes 4, 17, 80007, 130429) the worker backs off
  30 s and the unsent recipients stay queued. If your rolling-24h messaging tier is reached the campaign
  waits (`Waiting: daily limit`) and resumes on its own.
- **Templates it will accept:** `APPROVED`, body only, at most `{{1}}`. `{{1}}` is filled with the
  contact's name (or "there" if the contact only has a phone number). Media headers and variables in the
  header or a button URL are rejected at launch with a clear message.
- **Double-click guard.** A second launch with the same name within 2 minutes is refused.
- **Stub mode** (`BROADCAST_SENDER=stub`) simulates sending with no network call. The API refuses to
  start with it when `NODE_ENV=production`.

## Settings (`apps/api/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `BROADCAST_WORKER` | unset (off) | Set to `on` to enable server-side sending. |
| `BROADCAST_MSGS_PER_SEC` | `10` | Max messages per second (capped at 40). |
| `BROADCAST_DAILY_LIMIT` | from Meta tier | Override the rolling-24h recipient cap. |
| `BROADCAST_SENDER` | unset (real) | `stub` = simulate, never contact Meta (not allowed in production). |

Assumes **one** API instance.

## Rolling it out to the live server

Do these in order. Nothing here deletes or rewrites existing rows.

1. **Back up first.** `pg_dump` the live database and copy it off the server.
2. **Apply the database change.** It adds one table, three nullable columns and two enum values, and is
   safe to run twice. Use the connection string without the `?schema=public` suffix:

   ```bash
   psql "$DATABASE_URL_WITHOUT_SCHEMA_PARAM" -v ON_ERROR_STOP=1 \
     -f apps/api/prisma/migrations/20260919120000_campaign_server_sending/migration.sql
   ```

   Requires PostgreSQL 12+ (check with `SHOW server_version;`). If your database tracks migrations in
   `_prisma_migrations`, also run
   `npx prisma migrate resolve --applied 20260919120000_campaign_server_sending`.
3. **Deploy the code** (worker still off). Behaviour is unchanged: launches still send from the browser.
4. **Turn it on.** Add `BROADCAST_WORKER=on` to the server's `.env`, then `pm2 restart fgsn-api --update-env`.
   The log should say `Broadcast worker started`. The broadcast modal now says *"Sending runs on the server."*
5. **First real broadcast:** send to the **Internal team test group** and check it on your own phone.

**Rollback:** remove `BROADCAST_WORKER` and restart. The ERP falls back to browser sending. Pause or cancel
any campaign still in progress first, because a worker that is off does not send. The new table and columns
can safely stay.

## What is and is not measured

Measured from Meta: **sent, delivered, read, failed**, and the Meta spend estimate.
Not connected yet: **replies per broadcast** and **orders / sales attribution**. Those show
"not tracked yet" on server-sent campaigns instead of an invented number. Campaigns sent before this
change keep their stored numbers and are labelled **Estimated**.

## Tests

The pipeline was tested end to end against a scratch database with the stub sender: pause / resume, a
hard kill mid-send, crash recovery, cancel, retry, delivery receipts (including out-of-order), the daily
limit, validation, the flag-off default and the production guard. No real message was sent.
