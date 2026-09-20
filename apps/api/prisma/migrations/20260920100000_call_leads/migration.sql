-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CALL_PENDING', 'CALLED_NOT_PICKED', 'CALL_DONE', 'FOLLOW_UP_PENDING');

-- CreateTable
CREATE TABLE "CallLead" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateName" TEXT,
    "buttonText" TEXT NOT NULL,
    "firstTapAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTapAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tapCount" INTEGER NOT NULL DEFAULT 1,
    "callStatus" "CallStatus" NOT NULL DEFAULT 'CALL_PENDING',
    "remarks" TEXT,
    "statusUpdatedAt" TIMESTAMP(3),
    "statusUpdatedById" TEXT,
    "statusUpdatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLeadUpdate" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL,
    "remarks" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "byRole" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLeadUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallLead_ruleId_callStatus_idx" ON "CallLead"("ruleId", "callStatus");

-- CreateIndex
CREATE INDEX "CallLead_contactId_idx" ON "CallLead"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CallLead_ruleId_contactId_key" ON "CallLead"("ruleId", "contactId");

-- CreateIndex
CREATE INDEX "CallLeadUpdate_leadId_createdAt_idx" ON "CallLeadUpdate"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "CallLeadUpdate_byUserId_createdAt_idx" ON "CallLeadUpdate"("byUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CallLeadUpdate_createdAt_idx" ON "CallLeadUpdate"("createdAt");

-- AddForeignKey
ALTER TABLE "CallLead" ADD CONSTRAINT "CallLead_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReplyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLead" ADD CONSTRAINT "CallLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLeadUpdate" ADD CONSTRAINT "CallLeadUpdate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CallLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- People already recorded by reply rules become call-sheet rows: one per person per rule, starting as "Call pending".
INSERT INTO "CallLead" ("id", "ruleId", "contactId", "templateName", "buttonText", "firstTapAt", "lastTapAt", "tapCount", "updatedAt")
SELECT
    'cl_' || md5(l."ruleId" || ':' || l."contactId"),
    l."ruleId",
    l."contactId",
    (array_agg(l."templateName" ORDER BY l."repliedAt" DESC))[1],
    (array_agg(l."buttonText" ORDER BY l."repliedAt" DESC))[1],
    MIN(l."repliedAt"),
    MAX(l."repliedAt"),
    COUNT(*)::int,
    CURRENT_TIMESTAMP
FROM "ReplyLead" l
GROUP BY l."ruleId", l."contactId";
