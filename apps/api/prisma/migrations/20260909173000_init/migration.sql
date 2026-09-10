-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AGENT', 'MARKETER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED');

-- CreateEnum
CREATE TYPE "QualityRating" AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessagingTier" AS ENUM ('TIER_250', 'TIER_2K', 'TIER_10K', 'TIER_100K', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WabaConnection" (
    "id" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "businessTokenEnc" TEXT NOT NULL,
    "tier" "MessagingTier" NOT NULL DEFAULT 'TIER_250',
    "qualityRating" "QualityRating" NOT NULL DEFAULT 'UNKNOWN',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WabaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "metaTemplateId" TEXT,
    "bodyJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "optedInAt" TIMESTAMP(3),
    "tags" TEXT[],
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "windowExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "metaMessageId" TEXT,
    "templateId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "segmentJson" JSONB NOT NULL,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WabaConnection_wabaId_key" ON "WabaConnection"("wabaId");

-- CreateIndex
CREATE UNIQUE INDEX "WabaConnection_phoneNumberId_key" ON "WabaConnection"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_language_key" ON "Template"("name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_metaMessageId_idx" ON "Message"("metaMessageId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_actorId_idx" ON "AuditLogEntry"("actorId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

