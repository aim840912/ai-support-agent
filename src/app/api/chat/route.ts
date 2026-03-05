import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createChatStream } from "@/lib/chat/create-chat-stream";
import type { UIMessage } from "ai";

export async function POST(request: Request) {
  // Auth guard
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: userId, orgId } = session.user;

  let body: { messages: UIMessage[]; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, sessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  // Fetch plan for tool gating and limit checks
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const plan = org?.plan ?? "free";

  return createChatStream({
    orgId,
    messages,
    sessionId,
    userId,
    source: "dashboard",
    plan,
  });
}
