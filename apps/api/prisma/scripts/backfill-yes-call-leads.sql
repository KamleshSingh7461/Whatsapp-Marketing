-- One-off: put people who said "Yes" BEFORE reply rules existed onto the "Yes reply (default)" call sheet.
--
-- Why: before reply rules, a "Yes" only tagged the contact "Hot Lead - Yes Opt-In"; nobody was recorded for follow-up.
-- Who:  every contact carrying that tag. (The old rule also matched typed "yes", so it is not limited to button taps.)
-- When: first/last "Yes" times come from their stored inbound messages, using the same wording the old rule matched
--       (yes, yes ..., ... yes, yes!, yess, yeah). If none is found (for example the tag was added by hand), the
--       contact's last-updated time is used and the tap count is 1.
-- Status: everyone starts as "Call pending". Template is unknown for old replies, so it stays empty ("Any template").
--
-- SAFE TO RUN MORE THAN ONCE: anyone already on the sheet (with any status or remarks) is left exactly as they are.
-- It only ADDS rows to "CallLead". It changes nothing else.
--
-- Run:  psql "$URL" -v ON_ERROR_STOP=1 --single-transaction -f prisma/scripts/backfill-yes-call-leads.sql

INSERT INTO "CallLead" ("id", "ruleId", "contactId", "templateName", "buttonText", "firstTapAt", "lastTapAt", "tapCount", "updatedAt")
SELECT
    'cl_' || md5('rule_default_yes' || ':' || c."id"),
    'rule_default_yes',
    c."id",
    NULL,
    'Yes',
    COALESCE(y.first_at, c."updatedAt"),
    COALESCE(y.last_at, c."updatedAt"),
    GREATEST(COALESCE(y.n, 0), 1),
    CURRENT_TIMESTAMP
FROM "Contact" c
LEFT JOIN LATERAL (
    SELECT MIN(m."createdAt") AS first_at, MAX(m."createdAt") AS last_at, COUNT(*)::int AS n
    FROM "Message" m
    JOIN "Conversation" v ON v."id" = m."conversationId"
    WHERE v."contactId" = c."id"
      AND m."direction" = 'INBOUND'
      AND (
            lower(btrim(m."payloadJson"->>'body')) = 'yes'
         OR lower(btrim(m."payloadJson"->>'body')) LIKE 'yes %'
         OR lower(btrim(m."payloadJson"->>'body')) LIKE '% yes'
         OR lower(btrim(m."payloadJson"->>'body')) IN ('yes!', 'yess', 'yeah')
      )
) y ON true
WHERE 'Hot Lead - Yes Opt-In' = ANY(c."tags")
  AND EXISTS (SELECT 1 FROM "ReplyRule" r WHERE r."id" = 'rule_default_yes')
ON CONFLICT DO NOTHING;
