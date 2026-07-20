import type { UIMessage } from "ai";

/**
 * Heuristic model router for the model-routing experiment.
 *
 * Pure functions only — no Prisma, no env reads — so everything here is
 * directly unit-testable. The router looks at the LAST user message text
 * plus the total user-turn count. It deliberately does NOT scan historical
 * message text, so an old keyword (e.g. a refund mentioned 10 turns ago)
 * cannot permanently pin the conversation to the complex tier.
 */

export type ComplexityTier = "simple" | "complex";

export interface RouteDecision {
  tier: ComplexityTier;
  /** Accumulated score; >= COMPLEX_THRESHOLD routes to "complex". */
  score: number;
  /** Names of the rules that fired — for dev logs and test assertions. */
  reasons: string[];
}

export const COMPLEX_THRESHOLD = 2;

/**
 * OpenRouter model slugs — verified against https://openrouter.ai/api/v1/models
 * (all support the `tools` parameter, required by our 4 agent tools).
 * Centralised here so tuning the experiment is a one-line change.
 */
export const MODEL_SLUGS = {
  /** Cheap model for simple requests. */
  simple: "z-ai/glm-4.7",
  /** Strong model for complex requests (reliable tool-calling). */
  complex: "anthropic/claude-sonnet-4.5",
  /** Server-side fallback when the simple model fails (OpenRouter `models` array). */
  fallback: "anthropic/claude-sonnet-4.5",
} as const;

/** Keyword rules — weight 2 fires the complex tier on its own. */
export const COMPLEX_KEYWORDS: { pattern: RegExp; reason: string; weight: number }[] = [
  { pattern: /退款|退貨|refund|return my/i, reason: "refund", weight: 2 },
  { pattern: /投訴|客訴|申訴|complaint|complain/i, reason: "complaint", weight: 2 },
  { pattern: /賠償|compensat/i, reason: "compensation", weight: 2 },
  { pattern: /取消訂單|cancel (my )?(order|subscription)/i, reason: "cancellation", weight: 2 },
  { pattern: /緊急|急件|生氣|不滿|urgent|angry|frustrat/i, reason: "escalation", weight: 2 },
  {
    pattern: /比較|差異|差別|compare|difference|versus|\bvs\.?\b/i,
    reason: "comparison",
    weight: 1,
  },
];

/** Multi-step signals: numbered lists or sequencing connectives. */
const MULTI_STEP_PATTERNS = [
  /^\s*\d+[.、)]/m, // numbered list item
  /然後|接著|另外|還有|and also|as well as/i,
];

/** Extracts the text of the last user message (empty string if none). */
function lastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return (
    lastUser?.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

/**
 * Classifies request complexity from the conversation.
 * Score-based so tests (and dev logs) can assert WHY a tier was chosen.
 */
export function classifyComplexity(messages: UIMessage[]): RouteDecision {
  const text = lastUserText(messages);
  const reasons: string[] = [];
  let score = 0;

  // Rule 1: message length
  if (text.length > 400) {
    score += 2;
    reasons.push("length>400");
  } else if (text.length > 150) {
    score += 1;
    reasons.push("length>150");
  }

  // Rule 2: conversation depth — long threads need a stronger model for coherence
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns >= 6) {
    score += 1;
    reasons.push("turns>=6");
  }

  // Rule 3: keywords
  for (const kw of COMPLEX_KEYWORDS) {
    if (kw.pattern.test(text)) {
      score += kw.weight;
      reasons.push(`kw:${kw.reason}`);
    }
  }

  // Rule 4: multi-step / multi-question signals
  if (MULTI_STEP_PATTERNS.some((p) => p.test(text))) {
    score += 1;
    reasons.push("multi-step");
  }
  if ((text.match(/[?？]/g) ?? []).length >= 2) {
    score += 1;
    reasons.push("multi-question");
  }

  return {
    tier: score >= COMPLEX_THRESHOLD ? "complex" : "simple",
    score,
    reasons,
  };
}
