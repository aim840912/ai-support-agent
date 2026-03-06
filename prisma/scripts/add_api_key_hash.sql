-- Migration: add apiKeyHash to Organization
-- Run with: psql $DATABASE_URL -f prisma/migrations/manual/add_api_key_hash.sql
-- Or via Prisma: this file is NOT a managed Prisma migration (it contains data
-- manipulation). Apply it manually against your database, then run
-- `pnpm prisma migrate resolve --applied <migration_name>` if you wrap it
-- in a named migration folder.
--
-- What this does:
--   1. Adds nullable `apiKeyHash` column
--   2. Backfills all existing rows using PostgreSQL's built-in sha256()
--      (requires PostgreSQL 14+ — Neon uses PostgreSQL 16 by default)
--   3. Adds UNIQUE constraint after backfill

-- Step 1: add column (nullable so existing rows don't error)
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;

-- Step 2: backfill — sha256() is available in PostgreSQL 14+ without pgcrypto
UPDATE "Organization"
SET "apiKeyHash" = encode(sha256("apiKey"::bytea), 'hex')
WHERE "apiKeyHash" IS NULL;

-- Step 3: unique constraint (all rows are now populated)
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_apiKeyHash_key" UNIQUE ("apiKeyHash");

-- NOTE: The application code handles NULL apiKeyHash gracefully (falls back to
-- plaintext apiKey lookup) so the column intentionally stays nullable.
-- Once you've verified all rows are populated and the constraint is in place,
-- you may optionally enforce NOT NULL:
--   ALTER TABLE "Organization" ALTER COLUMN "apiKeyHash" SET NOT NULL;
