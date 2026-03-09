import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import { validateAndSanitizeMessages } from "@/lib/chat/validate-messages";
import type { UIMessage } from "ai";
import { createRateLimiter, checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/error-logger";

// 30 messages per user per minute
const chatLimiter = createRateLimiter({ limit: 30, window: "1m" });

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

  // Validate sessionId: same pattern as widget — prevents unbounded strings
  // from wasting DB index space while Prisma parameterized queries already
  // prevent SQL injection.
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length <= 100 ? body.sessionId : undefined;

  const validation = validateAndSanitizeMessages(body.messages);
  if (!validation.ok) {
    return new Response(validation.error, { status: validation.status });
  }
  const sanitizedMessages = validation.messages;

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
