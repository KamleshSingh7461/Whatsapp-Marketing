-- CreateTable
CREATE TABLE "ReplyRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateName" TEXT,
    "buttonText" TEXT NOT NULL,
    "tags" TEXT[],
    "replyText" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyLead" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "metaMessageId" TEXT NOT NULL,
    "templateName" TEXT,
    "buttonText" TEXT NOT NULL,
    "repliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplyRule_active_idx" ON "ReplyRule"("active");

-- CreateIndex
CREATE INDEX "ReplyLead_ruleId_repliedAt_idx" ON "ReplyLead"("ruleId", "repliedAt");

-- CreateIndex
CREATE INDEX "ReplyLead_contactId_idx" ON "ReplyLead"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyLead_metaMessageId_ruleId_key" ON "ReplyLead"("metaMessageId", "ruleId");

-- AddForeignKey
ALTER TABLE "ReplyLead" ADD CONSTRAINT "ReplyLead_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReplyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLead" ADD CONSTRAINT "ReplyLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: what the server did before, now as a rule you can edit or pause. A customer tapping a button that
-- says "Yes" on any template gets the two tags and this reply.
INSERT INTO "ReplyRule" ("id", "name", "templateName", "buttonText", "tags", "replyText", "active", "updatedAt")
VALUES (
    'rule_default_yes',
    'Yes reply (default)',
    NULL,
    'Yes',
    ARRAY['Hot Lead - Yes Opt-In', 'Hot Lead'],
    E'Alright, let’s say it’s time for you to get started. 
Our student subject matter expert will call you shortly do you have a preferred time that we can connect?',
    true,
    CURRENT_TIMESTAMP
);
