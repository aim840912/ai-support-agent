import { prisma } from "@/lib/db";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import type { UIMessage } from "ai";

export async function POST(request: Request) {
  // Widget auth: API key in header instead of session cookie
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return new Response("Missing x-api-key header", { status: 401 });
  }

  // Resolve organization from API key
  const org = await prisma.organization.findUnique({
    where: { apiKey },
    select: { id: true, plan: true },
  });

  if (!org) {
    return new Response("Invalid API key", { status: 401 });
  }

  const orgId = org.id;
  const plan = org.plan ?? "free";

  let body: { messages: UIMessage[]; visitorId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, visitorId, sessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  return createChatStream({
    orgId,
    messages,
    sessionId,
    visitorId,
    source: "widget",
    plan,
  });
}
