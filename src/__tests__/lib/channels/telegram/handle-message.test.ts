import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: {
    chatSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    telegramChannel: { update: vi.fn() },
  },
}));
vi.mock("@/lib/crypto/secrets", () => ({ decryptSecret: () => "bot-token" }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/chat/prepare-chat", () => ({ prepareChat: vi.fn() }));
vi.mock("@/lib/chat/drivers", () => ({ generateChatReply: vi.fn() }));
vi.mock("@/lib/chat/load-recent-messages", () => ({ loadRecentMessages: vi.fn() }));
vi.mock("@/lib/channels/telegram/client", () => ({
  sendMessage: vi.fn(),
  sendChatAction: vi.fn(),
}));
vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { prepareChat } from "@/lib/chat/prepare-chat";
import { generateChatReply } from "@/lib/chat/drivers";
import { loadRecentMessages } from "@/lib/chat/load-recent-messages";
import { sendMessage } from "@/lib/channels/telegram/client";
import { handleTelegramMessage } from "@/lib/channels/telegram/handle-message";
import type { TelegramMessage } from "@/lib/channels/telegram/types";

const mockFindFirst = vi.mocked(prisma.chatSession.findFirst);
const mockUpdateMany = vi.mocked(prisma.chatSession.updateMany);
const mockPrepare = vi.mocked(prepareChat);
const mockLoadHistory = vi.mocked(loadRecentMessages);

const channel = {
  id: "ch1",
  orgId: "org1",
  botToken: "encrypted",
  plan: "pro",
  customSystemPrompt: null,
};

function message(text: string): TelegramMessage {
  return {
    message_id: 1,
    date: 0,
    chat: { id: 42, type: "private" },
    text,
  } as TelegramMessage;
}

describe("handleTelegramMessage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
    vi.mocked(prisma.telegramChannel.update).mockResolvedValue({} as never);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockLoadHistory.mockResolvedValue([]);
    mockPrepare.mockResolvedValue({ ok: true, ctx: {} } as never);
    vi.mocked(generateChatReply).mockResolvedValue("hi");
  });

  it("/reset closes the chat's open sessions without starting a chat turn", async () => {
    await handleTelegramMessage(channel, message("/reset"));

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { orgId: "org1", source: "telegram", visitorId: "telegram:42", closedAt: null },
      data: { closedAt: expect.any(Date) },
    });
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      "bot-token",
      42,
      expect.stringContaining("new conversation")
    );
  });

  it("only resumes sessions that have not been closed", async () => {
    mockFindFirst.mockResolvedValue(null);

    await handleTelegramMessage(channel, message("where is my order?"));

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ closedAt: null }) })
    );
  });

  it("starts a fresh session with no history when no open session exists", async () => {
    mockFindFirst.mockResolvedValue(null);

    await handleTelegramMessage(channel, message("hello again"));

    expect(mockLoadHistory).not.toHaveBeenCalled();
    expect(mockPrepare).toHaveBeenCalledWith(expect.objectContaining({ sessionId: undefined }));
  });
});
