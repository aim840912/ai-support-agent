-- Telegram /reset closes the active session so the next message starts a new one.
ALTER TABLE "ChatSession" ADD COLUMN "closedAt" TIMESTAMP(3);
