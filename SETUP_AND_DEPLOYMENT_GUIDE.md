# FGSN WhatsApp Enterprise ERP — Setup & Deployment Guide

> **Official Enterprise Operations Platform for FGSN**  
> Complete technical documentation, local office setup, architecture overview, and production deployment guide.

---

## 1. Executive Overview & Architecture

**FGSN WhatsApp Enterprise ERP** is a full-stack, single-organization operations platform tailored for high-throughput WhatsApp Cloud API marketing, customer support automation, broadcast campaigns, and direct revenue attribution.

### Monorepo Structure

```
Whatsapp Marketing/
├── apps/
│   ├── web/                    # React 18 + Vite + TypeScript Frontend
│   │   ├── src/
│   │   │   ├── assets/         # Official FGSN branding assets (logo.png)
│   │   │   ├── components/     # UI modules (Analytics, Inbox, Templates, Campaigns, etc.)
│   │   │   ├── lib/            # Utilities (Currency conversion, API client)
│   │   │   ├── Dashboard.tsx   # Core Master Operations Controller
│   │   │   ├── styles.css      # Corporate Bright Theme & Responsive Design System
│   │   │   └── types.ts        # Shared TypeScript data models
│   │   └── package.json
│   │
│   └── api/                    # NestJS + Prisma + PostgreSQL + Redis Backend
│       ├── prisma/             # Schema definitions, migrations, and seed scripts
│       ├── src/                # Modules (Auth, WhatsApp Cloud API, Webhooks, Templates)
│       └── package.json
│
├── .env.example                # Template for environment variables & Meta API keys
├── docker-compose.yml          # Local PostgreSQL (port 5433) & Redis (port 6379)
├── package.json                # Root workspace configuration & scripts
└── SETUP_AND_DEPLOYMENT_GUIDE.md
```

---

## 2. Core Functional Modules

### 📊 1. Sales Performance & Financial Analytics (`AnalyticsView.tsx`)
- **Universal Multi-Currency Engine**: Instant live switching between **USD ($)**, **EUR (€)**, **INR (₹)**, and **GBP (£)** with automatic rate conversion.
- **Conversion Funnel Metrics**: Sent $\rightarrow$ Delivered $\rightarrow$ Read $\rightarrow$ Engaged $\rightarrow$ Converted tracking.
- **Financial Attribution**: Attributed Revenue, Return on Ad Spend (ROAS Multiplier), Average Order Value (AOV), and Meta conversation costs.
- **Regional Rate Comparison**: Country-level breakdown (US, India, UK, EU, Latin America) across Marketing, Utility, Authentication, and Service tiers.

### 💬 2. Live Shared Inbox & Omnichannel Helpdesk (`InboxView.tsx`)
- **Meta 24-Hour Session Care Window**: Real-time visual indicator and expiration timer.
- **Single-Pane Mobile Workflow**: Fluid switching between Queue, Live Chat, and Customer CRM on mobile/tablet viewports.
- **Canned Responses & Internal Team Notes**: One-click predefined corporate replies and secure internal team notes.
- **Inbound Reply Simulator**: Built-in test sandbox to simulate customer replies and verify 24h window refresh without live WhatsApp spend.
- **Agent Assignment & Ticket Resolution**: Assign conversations to support agents or automated bots.

### 📱 3. Template Studio & Compliance Sandbox (`TemplatesView.tsx`)
- **Realistic iPhone 16 Pro Mockup**:
  - Dynamic Island with camera lens reflection.
  - Authentic iOS status bar (time, cellular, Wi-Fi, battery).
  - WhatsApp iOS navigation header with official **FGSN verified shield logo**.
  - Authentic chat wallpaper canvas, message bubble with timestamp (`✓✓`), and interactive action buttons (`Shop Now`).
- **Meta Compliance Heuristic**: Automatic detection of promotional keywords inside Utility templates to prevent Meta miscategorization rejections.

### 🚀 4. Broadcast Marketing Campaigns (`CampaignsView.tsx`)
- High-throughput outbound marketing broadcast creator.
- Target audience segmentation by tags (e.g., *VIP Champions*, *Cart Abandoners*).
- Live financial estimators for Meta Cloud API cost vs. expected revenue.

### ⚡ 5. Automated Customer Workflows (`AutomationsView.tsx`)
- Visual automation builder for event-triggered flows:
  - Abandoned Cart Recovery (1hr & 24hr triggers).
  - Post-Purchase Onboarding & Review Collection.
  - VIP Loyalty Tier Milestones.
  - Inactive Customer Reactivation.

### 👥 6. Customer CRM & Audience Segmentation (`ContactsView.tsx`)
- RFM segmentation (*Champions*, *Frequent Buyers*, *At Risk*).
- Lifetime Value (LTV) and total order history.
- Add contact modal and tag management.

### ⚙️ 7. WABA Settings & Team Administration (`SettingsView.tsx` & `AuthModal.tsx`)
- Role-based access control (**Super Admin**, **Admin**, **Marketer**, **Agent**).
- WABA connection status, Meta webhook verify token, and System User API token configuration.
- Team member invitations and role management.

---

## 3. Step-by-Step Setup on Any New PC (e.g. Office PC)

Follow these exact steps when cloning this repository onto your office machine:

### Step 1: System Prerequisites
Ensure your office computer has the following installed:
1. **Node.js** (Version `20.x` or `22.x` recommended — minimum `18.x`)
   - Check with: `node -v`
2. **Git**
   - Check with: `git -v`
3. **Docker Desktop** *(Optional: only needed if running local PostgreSQL & Redis databases)*
   - Check with: `docker -v`

---

### Step 2: Clone & Install Dependencies

Open PowerShell, Command Prompt, or your Terminal:

```bash
# 1. Clone the repository
git clone <your-git-repo-url>

# 2. Enter project folder
cd "Whatsapp Marketing"

# 3. Install all monorepo dependencies (Frontend + Backend)
npm install
```

---

### Step 3: Configure Environment Variables

Create the backend environment file from the provided template:

```bash
# Windows PowerShell
copy .env.example apps\api\.env

# macOS / Linux
cp .env.example apps/api/.env
```

If connecting to your live Meta Cloud API, open `apps/api/.env` and insert your credentials:
```env
# Meta Cloud API Configuration
META_APP_ID="your_meta_app_id"
META_APP_SECRET="your_meta_app_secret"
META_WEBHOOK_VERIFY_TOKEN="fgsn_secure_webhook_token_2026"
META_SYSTEM_USER_TOKEN="EAAB..."
META_GRAPH_API_VERSION="v21.0"

# JWT Auth Secret (Generate via `openssl rand -base64 32`)
JWT_SECRET="fgsn_enterprise_jwt_super_secret_key_2026"
ENCRYPTION_KEY="fgsn_aes256_encryption_key_32bytes"
```

---

### Step 4: Run the Application

#### Option A: Run the Frontend Web Application (Instant)
```bash
npm run dev:web
```
- Open browser at: **`http://localhost:5173/`**
- The web app runs in full interactive mode with responsive layout, FGSN branding, iPhone preview, and currency switching.

#### Option B: Run Full Stack (Frontend + Backend Database)
```bash
# 1. Start local Postgres & Redis containers
docker compose up -d

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Apply Database Migrations
npm run prisma:migrate

# 4. Seed Initial Super Admin & Team Accounts
npm run db:seed

# 5. Start API Server (in a separate terminal)
npm run dev:api
```
- Frontend: **`http://localhost:5173/`**
- Backend API: **`http://localhost:3000/`**
- API Health Check: **`http://localhost:3000/api/health`**

---

## 4. Production Build & Verification Commands

To verify that the entire codebase compiles cleanly with 0 TypeScript and packaging errors:

```bash
# Test Frontend Build
npm run build:web

# Test Backend API Build
npm run build:api
```

Both commands will exit with code `0`.

---

## 5. Pre-Seeded Default Super Admin Credentials

When running with the backend database, the initial seeded administrator account is:

- **Email**: `superadmin@fgsn.com`
- **Password**: `FGSN@Admin2026!`
- **Role**: `SUPER_ADMIN` / `ADMIN`

---

## 6. Git Commit & Push Instructions

Before leaving this PC, run:

```bash
git add .
git commit -m "feat: complete enterprise WhatsApp ERP for FGSN with responsive UI, iPhone 16 Pro preview, and setup guide"
git push origin master
```

---

*Documentation maintained by FGSN Core Engineering & Operations Team.*
