import { prisma } from "@/lib/db";
import { hashApiKey } from "@/lib/api-key";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import { validateAndSanitizeMessages } from "@/lib/chat/validate-messages";
import type { UIMessage } from "ai";
import {
  createRateLimiter,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { logError } from "@/lib/error-logger";

// 20 widget messages per API key + IP per minute
const widgetChatLimiter = createRateLimiter({ limit: 20, window: "1m" });

export async function POST(request: Request) {
  // Widget auth: API key in header instead of session cookie
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return new Response("Missing x-api-key header", { status: 401 });
  }

  // Resolve organization via SHA-256 hash of the incoming API key.
  // Hashing prevents SQL-injection attacks from obtaining usable plaintext keys
  // (attacker retrieves hash, not the original key).
  // Fallback to plaintext lookup for orgs created before the hash migration —
  // remove the fallback once all records have been backfilled.
  const keyHash = hashApiKey(apiKey);
  let org: {
    id: string;
    plan: string;
    agentSettings: { systemPrompt: string | null } | null;
  } | null;
  try {
    org = await prisma.organization.findFirst({
      where: {
        OR: [
          { apiKeyHash: keyHash }, // preferred — hash-based lookup
          { apiKeyHash: null, apiKey: apiKey }, // migration fallback for pre-hash orgs
        ],
      },
      select: {
        id: true,
        plan: true,
        agentSettings: { select: { systemPrompt: true } },
      },
    });
  } catch (error) {
    logError("[WidgetChatAPI]", error);
    return new Response("Internal server error", { status: 500 });
  }

  if (!org) {
    return new Response("Invalid API key", { status: 401 });
  }

  const orgId = org.id;
  const plan = org.plan ?? "free";

  // Rate limit by org ID + IP — isolates widget tenants while protecting per-visitor.
  // Using org.id (not apiKey) avoids storing the raw API key in the rate-limit store.
  const ip = getClientIp(request);
  const rl = await checkRateLimit(widgetChatLimiter, `widget:${orgId}:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  let body: { messages: UIMessage[]; visitorId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Validate visitorId to prevent injection via this field
  const visitorId =
    typeof body.visitorId === "string" && body.visitorId.length <= 100 ? body.visitorId : undefined;
  // Validate sessionId: same pattern as visitorId — Prisma parameterized queries prevent
  // SQL injection, but an unbounded string wastes DB index space and query parsing time.
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length <= 100 ? body.sessionId : undefined;
  const validation = validateAndSanitizeMessages(body.messages);
  if (!validation.ok) {
    return new Response(validation.error, { status: validation.status });
  }
  const sanitizedMessages = validation.messages;

  return createChatStream({
    orgId,
    messages: sanitizedMessages,
    sessionId,
    visitorId,
    source: "widget",
    plan,
    customSystemPrompt: org.agentSettings?.systemPrompt ?? null,
  });
}
