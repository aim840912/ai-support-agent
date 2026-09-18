import { describe, it, expect, vi, afterEach } from "vitest";
import { createSupportAgent } from "@/lib/ai/agent";

/**
 * Guards the mock-mode path after the LLM gate switched from GROQ_API_KEY
 * to OPENROUTER_API_KEY on the model-routing branch: with no valid key,
 * createSupportAgent must still build a working (mock-model) agent for
 * every tier without throwing.
 */
describe("createSupportAgent (mock mode)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["simple", "complex"] as const)(
    "builds an agent in mock mode for the %s tier without throwing",
    (tier) => {
      vi.stubEnv("OPENROUTER_API_KEY", "");
      const agent = createSupportAgent("org-test-id", "free", null, tier);
      expect(agent).toBeDefined();
    }
  );

  it("treats a placeholder key as mock mode", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "placeholder-key");
    expect(() => createSupportAgent("org-test-id", "pro", null)).not.toThrow();
  });
});
