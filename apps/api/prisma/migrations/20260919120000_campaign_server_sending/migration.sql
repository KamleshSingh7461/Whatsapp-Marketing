-- Server-side broadcast sending.
--
-- ADDITIVE and IDEMPOTENT: safe to run more than once, drops nothing, and does not modify or
-- delete any existing row. Generated with `prisma migrate diff` from the previous schema, then
-- wrapped in IF NOT EXISTS guards so it can also be applied by hand with `psql -f` to a database
-- whose migration history is out of sync (see BROADCAST_SERVER_SENDING.md).
--
-- Requires PostgreSQL 12+ (ALTER TYPE ... ADD VALUE inside a transaction).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecipientStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable
ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pauseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "metaMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignRecipient_metaMessageId_idx" ON "CampaignRecipient"("metaMessageId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_phone_key" ON "CampaignRecipient"("campaignId", "phone");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
