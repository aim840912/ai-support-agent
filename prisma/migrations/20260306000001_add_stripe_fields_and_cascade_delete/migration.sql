-- Add Stripe customer and subscription IDs to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_stripeCustomerId_key" UNIQUE ("stripeCustomerId");

-- Add cascade delete to ChatMessage → ChatSession
ALTER TABLE "ChatMessage" DROP CONSTRAINT IF EXISTS "ChatMessage_sessionId_fkey";
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
