import { resolveOrgByWidgetKey } from "@/lib/org-auth";
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

  // Hash-based lookup, with a fallback for organizations created before the
  // hash migration. Shared with the MCP server's credential resolution so the
  // two cannot drift — see src/lib/org-auth.ts.
  let org: Awaited<ReturnType<typeof resolveOrgByWidgetKey>>;
  try {
    org = await resolveOrgByWidgetKey(apiKey);
  } catch (error) {
    logError("[WidgetChatAPI]", error);
    return new Response("Internal server error", { status: 500 });
  }

  if (!org) {
    return new Response("Invalid API key", { status: 401 });
  }

  const orgId = org.orgId;
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
    customSystemPrompt: org.customSystemPrompt,
  });
}
