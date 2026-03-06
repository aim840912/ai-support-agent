import { prisma } from "@/lib/db";
import { hashApiKey } from "@/lib/api-key";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import type { UIMessage } from "ai";
import { createRateLimiter, checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// 20 widget messages per API key + IP per minute
const widgetChatLimiter = createRateLimiter({ limit: 20, window: "1m" });

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;

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
  let org: { id: string; plan: string; agentSettings: { systemPrompt: string | null } | null } | null;
  try {
    org = await prisma.organization.findFirst({
      where: {
        OR: [
          { apiKeyHash: keyHash },  // preferred — hash-based lookup
          { apiKeyHash: null, apiKey: apiKey },  // migration fallback for pre-hash orgs
        ],
      },
      select: {
        id: true,
        plan: true,
        agentSettings: { select: { systemPrompt: true } },
      },
    });
  } catch (error) {
    console.error("[WidgetChatAPI]", error);
    return new Response("Internal server error", { status: 500 });
  }

  if (!org) {
    return new Response("Invalid API key", { status: 401 });
  }

  const orgId = org.id;
  const plan = org.plan ?? "free";

  // Rate limit by API key + IP — isolates widget tenants while protecting per-visitor
  const ip = getClientIp(request);
  const rl = await checkRateLimit(widgetChatLimiter, `widget:${apiKey}:${ip}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  let body: { messages: UIMessage[]; visitorId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Validate visitorId to prevent injection via this field
  const visitorId =
    typeof body.visitorId === "string" && body.visitorId.length <= 100
      ? body.visitorId
      : undefined;
  const { messages, sessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  if (messages.length > MAX_MESSAGES) {
    return new Response(`Too many messages (max ${MAX_MESSAGES})`, { status: 400 });
  }

  for (const msg of messages) {
    const text = msg.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
    if (text.length > MAX_MESSAGE_LENGTH) {
      return new Response(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, { status: 400 });
    }
  }

  return createChatStream({
    orgId,
    messages,
    sessionId,
    visitorId,
    source: "widget",
    plan,
    customSystemPrompt: org.agentSettings?.systemPrompt ?? null,
  });
}
