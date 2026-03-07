import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import type { UIMessage } from "ai";
import { createRateLimiter, checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/error-logger";

// 30 messages per user per minute
const chatLimiter = createRateLimiter({ limit: 30, window: "1m" });

const MAX_MESSAGES = 50;          // max history depth sent per request
const MAX_MESSAGE_LENGTH = 4000;  // max characters per individual message

export async function POST(request: Request) {
  // Auth guard
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: userId, orgId } = session.user;

  // Rate limit by userId — each authenticated user has their own bucket
  const rl = await checkRateLimit(chatLimiter, `chat:${userId}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  let body: { messages: UIMessage[]; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages } = body;
  // Validate sessionId: same pattern as widget — prevents unbounded strings
  // from wasting DB index space while Prisma parameterized queries already
  // prevent SQL injection.
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length <= 100
      ? body.sessionId
      : undefined;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  if (messages.length > MAX_MESSAGES) {
    return new Response(`Too many messages (max ${MAX_MESSAGES})`, { status: 400 });
  }

  // Validate each message's text content length
  for (const msg of messages) {
    const text = msg.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
    if (text.length > MAX_MESSAGE_LENGTH) {
      return new Response(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, { status: 400 });
    }
  }

  // Strip any messages with disallowed roles — prevents a client from injecting
  // role:"system" messages that could override or bypass the server-side system prompt.
  // The DB persistence layer already hard-codes role:"user", but the AI stream
  // receives the raw uiMessages array which must be sanitised independently.
  const ALLOWED_ROLES = new Set(["user", "assistant"]);
  const sanitizedMessages = messages.filter((msg) => ALLOWED_ROLES.has(msg.role));
  if (sanitizedMessages.length === 0) {
    return new Response("No valid messages", { status: 400 });
  }

  // Fetch plan + custom system prompt in parallel
  let org: { plan: string } | null = null;
  let agentSettings: { systemPrompt: string | null } | null = null;
  try {
    [org, agentSettings] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      }),
      prisma.agentSettings.findUnique({
        where: { orgId },
        select: { systemPrompt: true },
      }),
    ]);
  } catch (error) {
    logError("[ChatAPI]", error);
    return new Response("Internal server error", { status: 500 });
  }
  const plan = org?.plan ?? "free";

  return createChatStream({
    orgId,
    messages: sanitizedMessages,
    sessionId,
    userId,
    source: "dashboard",
    plan,
    customSystemPrompt: agentSettings?.systemPrompt ?? null,
  });
}
