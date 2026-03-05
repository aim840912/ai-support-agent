import { prisma } from "@/lib/db";
import { getPlanLimits } from "./limits";

type LimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; limit: number; current: number };

/** Check whether the org can upload another document */
export async function checkDocumentLimit(orgId: string): Promise<LimitResult> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const limits = getPlanLimits(org?.plan ?? "free");
  if (limits.documents === -1) return { allowed: true };

  const current = await prisma.document.count({ where: { orgId } });

  if (current >= limits.documents) {
    return {
      allowed: false,
      reason: `Document limit reached (${limits.documents} on ${org?.plan ?? "free"} plan)`,
      limit: limits.documents,
      current,
    };
  }

  return { allowed: true };
}

/** Check whether the org can start another conversation this month */
export async function checkConversationLimit(orgId: string): Promise<LimitResult> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const limits = getPlanLimits(org?.plan ?? "free");
  if (limits.conversationsPerMonth === -1) return { allowed: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const current = await prisma.chatSession.count({
    where: { orgId, createdAt: { gte: startOfMonth } },
  });

  if (current >= limits.conversationsPerMonth) {
    return {
      allowed: false,
      reason: `Monthly conversation limit reached (${limits.conversationsPerMonth} on ${org?.plan ?? "free"} plan)`,
      limit: limits.conversationsPerMonth,
      current,
    };
  }

  return { allowed: true };
}

/** Check whether a conversation has exceeded its message limit */
export async function checkMessageLimit(
  orgId: string,
  sessionId: string
): Promise<LimitResult> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const limits = getPlanLimits(org?.plan ?? "free");
  if (limits.messagesPerConversation === -1) return { allowed: true };

  const current = await prisma.chatMessage.count({ where: { sessionId } });

  if (current >= limits.messagesPerConversation) {
    return {
      allowed: false,
      reason: `Message limit per conversation reached (${limits.messagesPerConversation} on ${org?.plan ?? "free"} plan)`,
      limit: limits.messagesPerConversation,
      current,
    };
  }

  return { allowed: true };
}

/**
 * Returns the org's plan and current usage statistics for the settings page.
 */
export async function getOrgUsage(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const plan = org?.plan ?? "free";
  const limits = getPlanLimits(plan);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [documentCount, conversationCount, productCount, ticketCount] =
    await Promise.all([
      prisma.document.count({ where: { orgId } }),
      prisma.chatSession.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
      prisma.product.count({ where: { orgId } }),
      prisma.ticket.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
    ]);

  return {
    plan,
    limits,
    usage: {
      documents: documentCount,
      conversationsThisMonth: conversationCount,
      products: productCount,
      ticketsThisMonth: ticketCount,
    },
  };
}
