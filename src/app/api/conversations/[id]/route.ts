import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  const chatSession = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          toolCalls: true,
        },
      },
    },
  });

  if (!chatSession) {
    return new Response("Not found", { status: 404 });
  }

  // Verify ownership
  if (chatSession.orgId !== orgId) {
    return new Response("Forbidden", { status: 403 });
  }

  return Response.json({
    id: chatSession.id,
    source: chatSession.source,
    visitorId: chatSession.visitorId,
    createdAt: chatSession.createdAt.toISOString(),
    messages: chatSession.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
