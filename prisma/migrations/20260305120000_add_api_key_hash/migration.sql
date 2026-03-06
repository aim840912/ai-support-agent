-- Migration: add apiKeyHash to Organization (applied manually)
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;

UPDATE "Organization"
SET "apiKeyHash" = encode(sha256("apiKey"::bytea), 'hex')
WHERE "apiKeyHash" IS NULL;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_apiKeyHash_key" UNIQUE ("apiKeyHash");
