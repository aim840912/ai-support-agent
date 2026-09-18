import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  classifyComplexity,
  COMPLEX_THRESHOLD,
  MODEL_SLUGS,
  resolveModelChoice,
} from "@/lib/ai/model-router";

/** Builds a UIMessage list of alternating user/assistant turns from user texts. */
function makeMessages(userTexts: string[]): UIMessage[] {
  const messages: UIMessage[] = [];
  userTexts.forEach((text, i) => {
    messages.push({
      id: `u${i}`,
      role: "user",
      parts: [{ type: "text", text }],
    } as UIMessage);
    // Interleave assistant replies except after the final user message
    if (i < userTexts.length - 1) {
      messages.push({
        id: `a${i}`,
        role: "assistant",
        parts: [{ type: "text", text: "OK" }],
      } as UIMessage);
    }
  });
  return messages;
}

describe("classifyComplexity", () => {
  describe("simple tier", () => {
    it("routes a short greeting to simple with score 0", () => {
      const d = classifyComplexity(makeMessages(["你好"]));
      expect(d.tier).toBe("simple");
      expect(d.score).toBe(0);
      expect(d.reasons).toEqual([]);
    });

    it("routes a plain short question to simple", () => {
      const d = classifyComplexity(makeMessages(["請問營業時間？"]));
      expect(d.tier).toBe("simple");
    });

    it("keeps a single weight-1 signal (comparison) below the threshold", () => {
      const d = classifyComplexity(makeMessages(["A 和 B 有什麼差異"]));
      expect(d.reasons).toContain("kw:comparison");
      expect(d.score).toBeLessThan(COMPLEX_THRESHOLD);
      expect(d.tier).toBe("simple");
    });

    it("keeps a medium-length message (150-400 chars) alone below the threshold", () => {
      const text = "我想了解你們的產品，".repeat(16); // 160 chars, no keywords
      const d = classifyComplexity(makeMessages([text]));
      expect(d.reasons).toContain("length>150");
      expect(d.tier).toBe("simple");
    });

    it("keeps 6 short user turns alone below the threshold", () => {
      const d = classifyComplexity(makeMessages(["嗨", "好", "喔", "嗯", "哦", "讚"]));
      expect(d.reasons).toContain("turns>=6");
      expect(d.tier).toBe("simple");
    });

    it("only scores the LAST user message — old keywords do not stick", () => {
      const d = classifyComplexity(makeMessages(["我要退款", "謝謝"]));
      expect(d.reasons).not.toContain("kw:refund");
      expect(d.tier).toBe("simple");
    });
  });

  describe("complex tier", () => {
    it("routes messages over 400 chars to complex", () => {
      const d = classifyComplexity(makeMessages(["很".repeat(401)]));
      expect(d.reasons).toContain("length>400");
      expect(d.tier).toBe("complex");
    });

    it.each([
      ["refund (zh)", "我要退款"],
      ["complaint (zh)", "我要投訴你們客服"],
      ["refund (EN uppercase)", "I want a REFUND"],
      ["compensation", "你們要賠償我的損失"],
      ["cancellation", "我要取消訂單"],
      ["escalation", "這很緊急請馬上處理"],
    ])("routes weight-2 keyword %s to complex", (_label, text) => {
      const d = classifyComplexity(makeMessages([text]));
      expect(d.tier).toBe("complex");
    });

    it("stacks weight-1 signals: comparison + medium length crosses the threshold", () => {
      const text = `幫我比較一下這兩個方案，${"包含各種細節說明，".repeat(16)}`;
      const d = classifyComplexity(makeMessages([text]));
      expect(d.reasons).toEqual(expect.arrayContaining(["kw:comparison", "length>150"]));
      expect(d.tier).toBe("complex");
    });

    it("detects numbered multi-step lists", () => {
      const d = classifyComplexity(makeMessages(["1. 查訂單 2. 改地址 3. 補開發票"]));
      expect(d.reasons).toContain("multi-step");
    });

    it("detects multiple questions", () => {
      const d = classifyComplexity(makeMessages(["訂單到哪了？可以改地址嗎？"]));
      expect(d.reasons).toContain("multi-question");
    });
  });

  describe("edge cases (must not throw)", () => {
    it("returns simple for an empty message array", () => {
      const d = classifyComplexity([]);
      expect(d.tier).toBe("simple");
      expect(d.score).toBe(0);
    });

    it("returns simple when the user message has no text parts", () => {
      const messages = [{ id: "u0", role: "user", parts: [] } as unknown as UIMessage];
      expect(classifyComplexity(messages).tier).toBe("simple");
    });

    it("scores the last USER message even when the final message is from the assistant", () => {
      const messages = [
        ...makeMessages(["我要退款"]),
        { id: "a-final", role: "assistant", parts: [{ type: "text", text: "好的" }] } as UIMessage,
      ];
      const d = classifyComplexity(messages);
      expect(d.reasons).toContain("kw:refund");
      expect(d.tier).toBe("complex");
    });
  });
});

describe("MODEL_SLUGS", () => {
  it("keeps simple and complex tiers on different models", () => {
    expect(MODEL_SLUGS.simple).not.toBe(MODEL_SLUGS.complex);
  });
});

describe("resolveModelChoice (cost guard)", () => {
  it.each(["simple", "complex"] as const)(
    "%s tier resolves to the cheap model with no fallbacks",
    (tier) => {
      const choice = resolveModelChoice(tier);
      expect(choice.primary).toBe(MODEL_SLUGS.simple);
      expect(choice.primary).not.toBe(MODEL_SLUGS.complex); // never Claude
      expect(choice.fallbacks).toEqual([]);
    }
  );
});
