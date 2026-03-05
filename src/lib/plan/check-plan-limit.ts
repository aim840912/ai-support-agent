import { prisma } from "@/lib/db";
import { getPlanLimits } from "./limits";
import { getStartOfMonth } from "@/lib/utils";

type LimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; limit: number; current: number };

/**
 * Resolves the org's plan string from the DB.
 * Returns "free" if the org is not found (safe default).
 */
async function getOrgPlan(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  return org?.plan ?? "free";
}

/** Check whether the org can upload another document */
export async function checkDocumentLimit(orgId: string): Promise<LimitResult> {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  if (limits.documents === -1) return { allowed: true };

  const current = await prisma.document.count({ where: { orgId } });

  if (current >= limits.documents) {
    return {
      allowed: false,
      reason: `Document limit reached (${limits.documents} on ${plan} plan)`,
      limit: limits.documents,
      current,
    };
  }

  return { allowed: true };
}

/**
 * Check whether the org can start another conversation this month.
 * Pass `plan` to skip an extra DB round-trip when the caller already knows it.
 */
export async function checkConversationLimit(
  orgId: string,
  plan?: string
): Promise<LimitResult> {
  const resolvedPlan = plan ?? (await getOrgPlan(orgId));
  const limits = getPlanLimits(resolvedPlan);
  if (limits.conversationsPerMonth === -1) return { allowed: true };

  const current = await prisma.chatSession.count({
    where: { orgId, createdAt: { gte: getStartOfMonth() } },
  });

  if (current >= limits.conversationsPerMonth) {
    return {
      allowed: false,
      reason: `Monthly conversation limit reached (${limits.conversationsPerMonth} on ${resolvedPlan} plan)`,
      limit: limits.conversationsPerMonth,
      current,
    };
  }

  return { allowed: true };
}

/**
 * Check whether a conversation has exceeded its message limit.
 * Pass `plan` to skip an extra DB round-trip when the caller already knows it.
 */
export async function checkMessageLimit(
  orgId: string,
  sessionId: string,
  plan?: string
): Promise<LimitResult> {
  const resolvedPlan = plan ?? (await getOrgPlan(orgId));
  const limits = getPlanLimits(resolvedPlan);
  if (limits.messagesPerConversation === -1) return { allowed: true };

  const current = await prisma.chatMessage.count({ where: { sessionId } });

  if (current >= limits.messagesPerConversation) {
    return {
      allowed: false,
      reason: `Message limit per conversation reached (${limits.messagesPerConversation} on ${resolvedPlan} plan)`,
      limit: limits.messagesPerConversation,
      current,
    };
  }

  return { allowed: true };
}

/**
 * Returns the org's plan and current usage statistics for the settings page.
 * Accepts an optional pre-fetched `plan` to avoid a redundant DB query.
 */
export async function getOrgUsage(orgId: string, plan?: string) {
  const resolvedPlan = plan ?? (await getOrgPlan(orgId));
  const limits = getPlanLimits(resolvedPlan);

  const startOfMonth = getStartOfMonth();

  const [documentCount, conversationCount, productCount, ticketCount] =
    await Promise.all([
      prisma.document.count({ where: { orgId } }),
      prisma.chatSession.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
      prisma.product.count({ where: { orgId } }),
      prisma.ticket.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
    ]);

  return {
    plan: resolvedPlan,
    limits,
    usage: {
      documents: documentCount,
      conversationsThisMonth: conversationCount,
      products: productCount,
      ticketsThisMonth: ticketCount,
    },
  };
}
