import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: {
    chatMessage: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { loadRecentMessages } from "@/lib/chat/load-recent-messages";

const mockFindMany = vi.mocked(prisma.chatMessage.findMany);

type Row = { id: string; role: string; content: string };

function rowsNewestFirst(...rows: Row[]) {
  // The query orders by createdAt desc, so the mock returns newest-first.
  mockFindMany.mockResolvedValue(rows as never);
}

function textOf(message: { parts: unknown[] }): string {
  return (message.parts as { type: string; text: string }[])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

describe("loadRecentMessages", () => {
  beforeEach(() => vi.resetAllMocks());

  it("queries newest-first and returns messages in chronological order", async () => {
    rowsNewestFirst(
      { id: "m3", role: "assistant", content: "third" },
      { id: "m2", role: "user", content: "second" },
      { id: "m1", role: "assistant", content: "first" }
    );

    const result = await loadRecentMessages("s1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s1" },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    );
    expect(result.map(textOf)).toEqual(["first", "second", "third"]);
    expect(result.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
  });

  it("drops rows with empty content", async () => {
    // A real product of persistence: an assistant turn that only called tools
    // is stored with content "". Replaying it as an empty text part makes most
    // providers return 400.
    rowsNewestFirst(
      { id: "m3", role: "assistant", content: "answer" },
      { id: "m2", role: "assistant", content: "" },
      { id: "m1", role: "user", content: "question" }
    );

    const result = await loadRecentMessages("s1");

    expect(result.map(textOf)).toEqual(["question", "answer"]);
  });

  it('drops rows with role "tool"', async () => {
    rowsNewestFirst(
      { id: "m3", role: "assistant", content: "answer" },
      { id: "m2", role: "tool", content: "tool output" },
      { id: "m1", role: "user", content: "question" }
    );

    const result = await loadRecentMessages("s1");

    expect(result.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("stops accumulating once the character budget is exceeded", async () => {
    rowsNewestFirst(
      { id: "m3", role: "assistant", content: "c".repeat(60) },
      { id: "m2", role: "user", content: "b".repeat(60) },
      { id: "m1", role: "assistant", content: "a".repeat(60) }
    );

    const result = await loadRecentMessages("s1", 10, 100);

    // 60 fits, 60 + 60 does not — so only the newest row survives.
    expect(result).toHaveLength(1);
    expect(textOf(result[0])).toBe("c".repeat(60));
  });

  it("keeps the newest row even when it alone exceeds the budget", async () => {
    // Returning nothing would silently drop all context.
    rowsNewestFirst({ id: "m1", role: "user", content: "x".repeat(500) });

    const result = await loadRecentMessages("s1", 10, 100);

    expect(result).toHaveLength(1);
  });

  it("returns an empty array for a session with no messages", async () => {
    rowsNewestFirst();

    await expect(loadRecentMessages("s1")).resolves.toEqual([]);
  });

  it("honours a custom limit", async () => {
    rowsNewestFirst({ id: "m1", role: "user", content: "only" });

    await loadRecentMessages("s1", 4);

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }));
  });
});
