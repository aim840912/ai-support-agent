/**
 * Per-plan feature limits.
 * All numeric limits: -1 means unlimited.
 */
export type PlanKey = "free" | "pro";

export type PlanLimits = {
  /** Max documents in the knowledge base */
  documents: number;
  /** Max chat sessions per calendar month */
  conversationsPerMonth: number;
  /** Max messages per conversation */
  messagesPerConversation: number;
  /** Max products in inventory */
  products: number;
  /** Max support tickets per calendar month */
  ticketsPerMonth: number;
  /** Max team members (including owner) */
  teamMembers: number;
  /** Which AI tools are available */
  enabledTools: string[];
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    documents: 5,
    conversationsPerMonth: 50,
    messagesPerConversation: 20,
    products: 10,
    ticketsPerMonth: 10,
    teamMembers: 3,
    enabledTools: ["searchKnowledgeBase", "getOrderStatus"],
  },
  pro: {
    documents: 100,
    conversationsPerMonth: -1,
    messagesPerConversation: -1,
    products: 1000,
    ticketsPerMonth: -1,
    teamMembers: 20,
    enabledTools: ["searchKnowledgeBase", "getOrderStatus", "checkInventory", "createTicket"],
  },
};

/** Resolve limits for any plan string — defaults to free if unrecognised */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as PlanKey) in PLAN_LIMITS ? (plan as PlanKey) : "free"];
}
