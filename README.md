# WhatsApp ERP

Multi-tenant WhatsApp Business Platform ERP. Super Admin (you) onboards companies and appoints Company Admins; each company gets its own isolated WABA, contacts, templates, and team. Full context and rationale: see the **WhatsApp ERP Blueprint** plan (published as a Claude artifact — ask to have the link resent if you don't have it).

## Structure

```
apps/
  api/   NestJS backend — Prisma/PostgreSQL, Redis, WhatsApp Cloud API integration
  web/   React frontend — Super Admin console + Company portal
```

## Prerequisites

- Node.js 22+
- Docker (for local Postgres + Redis)
- A Meta Business Portfolio, Meta App, and completed Business Verification
  (see plan §02/§15 — this can't be automated, it's your own Meta account)

## First-time setup

```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env          # fill in META_* and JWT_SECRET / ENCRYPTION_KEY
npm install
npm run prisma:migrate --workspace=apps/api -- --name init
npm run db:seed --workspace=apps/api   # creates the first Super Admin login
```

Generate the two secrets `.env` needs:

```bash
openssl rand -base64 32   # ENCRYPTION_KEY
openssl rand -base64 48   # JWT_SECRET
```

## Running locally

```bash
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173 (proxies /api to the backend)
```

`GET /api/health` should return `{ status: "ok" }` once the API is up.

## Where things stand

This is the Phase 0/1 skeleton from the plan's roadmap (§13):

- ✅ Data model (§06) as a Prisma schema, with row-level tenant scoping via `companyId`
- ✅ Auth (JWT) + RBAC guards for the five roles in §04, plus a `TenantGuard` that hard-blocks cross-company access
- ✅ Embedded Signup v4 token-exchange endpoint (`POST /companies/:id/whatsapp/connect`) — **verify the exact request shape against Meta's current docs before using it live**, the flow has changed across versions
- ✅ Webhook receiver with `X-Hub-Signature-256` verification (§02) and basic inbound message / status recording
- ✅ Template create endpoint with a miscategorization warning heuristic (§02)
- ⬜ Company Admin / user invite flow, broadcast campaigns, shared inbox UI, chatbot/flows, billing, analytics — Phase 2/3 per the roadmap
- ⬜ Postgres row-level security *policies* (the schema has `companyId` on every tenant row; the actual `CREATE POLICY` statements still need to be added to a migration — see the note at the top of `schema.prisma`)

Still open before this goes further (plan §14): payment gateway/commission model, hosting region, exact ERP scope beyond WhatsApp marketing.
