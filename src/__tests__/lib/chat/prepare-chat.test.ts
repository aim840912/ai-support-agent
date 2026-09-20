import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: {
    chatSession: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/plan/check-plan-limit", () => ({
  checkConversationLimit: vi.fn(),
  checkMessageLimit: vi.fn(),
}));

vi.mock("@/lib/ai/agent", () => ({
  createSupportAgent: vi.fn(() => ({ __agent: true })),
}));

vi.mock("@/lib/ai/model-router", () => ({
  classifyComplexity: vi.fn(() => ({ tier: "simple", score: 0, reasons: [] })),
}));

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import { prisma } from "@/lib/db";
import { checkConversationLimit, checkMessageLimit } from "@/lib/plan/check-plan-limit";
import { createSupportAgent } from "@/lib/ai/agent";
import { logError } from "@/lib/error-logger";
import { prepareChat } from "@/lib/chat/prepare-chat";
import type { UIMessage } from "ai";

const mockCreate = vi.mocked(prisma.chatSession.create);
const mockFindUnique = vi.mocked(prisma.chatSession.findUnique);
const mockConvLimit = vi.mocked(checkConversationLimit);
const mockMsgLimit = vi.mocked(checkMessageLimit);
const mockCreateAgent = vi.mocked(createSupportAgent);
const mockLogError = vi.mocked(logError);

const messages: UIMessage[] = [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }];

function allowAll() {
  mockConvLimit.mockResolvedValue({ allowed: true });
  mockMsgLimit.mockResolvedValue({ allowed: true });
}

describe("prepareChat", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a new ChatSession when no sessionId is given", async () => {
    allowAll();
    mockCreate.mockResolvedValue({ id: "new-session" } as never);

    const result = await prepareChat({ orgId: "org1", messages, source: "widget" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ctx.sessionId).toBe("new-session");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org1", source: "widget" }),
      })
    );
    expect(mockCreateAgent).toHaveBeenCalled();
  });

  it("still returns ok with an undefined sessionId when session creation throws", async () => {
    // Deliberate existing behaviour: the conversation runs, it just isn't
    // persisted. Turning this into a hard failure would be a regression.
    allowAll();
    mockCreate.mockRejectedValue(new Error("db down"));

    const result = await prepareChat({ orgId: "org1", messages });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ctx.sessionId).toBeUndefined();
    expect(result.ctx.agent).toBeDefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it("returns CONVERSATION_LIMIT with status 429 when the monthly limit is hit", async () => {
    mockConvLimit.mockResolvedValue({
      allowed: false,
      reason: "Monthly conversation limit reached",
      limit: 50,
      current: 50,
    });

    const result = await prepareChat({ orgId: "org1", messages });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONVERSATION_LIMIT");
    expect(result.error.status).toBe(429);
    expect(result.error.message).toBe("Monthly conversation limit reached");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns SESSION_NOT_FOUND when the session belongs to another org", async () => {
    allowAll();
    mockFindUnique.mockResolvedValue(null);

    const result = await prepareChat({ orgId: "org1", messages, sessionId: "other-org-session" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("SESSION_NOT_FOUND");
    expect(result.error.status).toBe(404);
    // The org must be part of the lookup — without it this is cross-tenant injection.
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "other-org-session", orgId: "org1" } })
    );
    expect(mockMsgLimit).not.toHaveBeenCalled();
  });

  it("returns MESSAGE_LIMIT with status 429 when the per-conversation limit is hit", async () => {
    mockFindUnique.mockResolvedValue({ id: "s1" } as never);
    mockMsgLimit.mockResolvedValue({
      allowed: false,
      reason: "Message limit per conversation reached",
      limit: 10,
      current: 10,
    });

    const result = await prepareChat({ orgId: "org1", messages, sessionId: "s1" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MESSAGE_LIMIT");
    expect(result.error.status).toBe(429);
  });

  it("passes the plan through so tool gating and limit checks agree", async () => {
    allowAll();
    mockCreate.mockResolvedValue({ id: "s1" } as never);

    await prepareChat({ orgId: "org1", messages, plan: "pro", customSystemPrompt: "be terse" });

    expect(mockConvLimit).toHaveBeenCalledWith("org1", "pro");
    expect(mockCreateAgent).toHaveBeenCalledWith("org1", "pro", "be terse", "simple");
  });
});
