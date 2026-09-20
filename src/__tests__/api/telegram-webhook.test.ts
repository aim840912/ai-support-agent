import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: { telegramChannel: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/channels/telegram/handle-message", () => ({
  handleTelegramMessage: vi.fn(),
}));

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

// after() keeps the function alive past the response. Running the callback
// inline here keeps the assertions simple; the route never awaits it either way.
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import { prisma } from "@/lib/db";
import { handleTelegramMessage } from "@/lib/channels/telegram/handle-message";
import { hashApiKey } from "@/lib/api-key";
import { POST as telegramWebhook } from "@/app/api/channels/telegram/[webhookId]/route";

const mockFindUnique = vi.mocked(prisma.telegramChannel.findUnique);
const mockHandle = vi.mocked(handleTelegramMessage);

const SECRET = "correct-secret-token";
const WEBHOOK_ID = "wh_abc";

function channelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ch1",
    orgId: "org1",
    botToken: "v1:iv:tag:ct",
    secretTokenHash: hashApiKey(SECRET),
    enabled: true,
    org: { plan: "pro", agentSettings: { systemPrompt: "be terse" } },
    ...overrides,
  };
}

function messageUpdate(updateId: number, text = "hello") {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1758000000,
      chat: { id: 555, type: "private" },
      text,
    },
  };
}

function buildRequest(body: unknown, secret?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-telegram-bot-api-secret-token"] = secret;
  return new Request(`http://localhost/api/channels/telegram/${WEBHOOK_ID}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ webhookId: WEBHOOK_ID }) };
}

// Each test needs its own update_id: the route's dedupe Set is module-level
// and therefore shared across cases in this file.
let nextUpdateId = 1000;
const freshId = () => ++nextUpdateId;

describe("POST /api/channels/telegram/[webhookId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 for an unknown webhookId", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await telegramWebhook(buildRequest(messageUpdate(freshId()), SECRET), params());

    expect(res.status).toBe(401);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret token header is missing", async () => {
    mockFindUnique.mockResolvedValue(channelRow() as never);

    const res = await telegramWebhook(buildRequest(messageUpdate(freshId())), params());

    expect(res.status).toBe(401);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret token does not match", async () => {
    mockFindUnique.mockResolvedValue(channelRow() as never);

    const res = await telegramWebhook(
      buildRequest(messageUpdate(freshId()), "wrong-secret"),
      params()
    );

    expect(res.status).toBe(401);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("does not distinguish an unknown id from a bad secret", async () => {
    // Telling an attacker which half they got right helps them forge a request.
    mockFindUnique.mockResolvedValue(null);
    const unknownId = await telegramWebhook(
      buildRequest(messageUpdate(freshId()), SECRET),
      params()
    );

    mockFindUnique.mockResolvedValue(channelRow() as never);
    const badSecret = await telegramWebhook(
      buildRequest(messageUpdate(freshId()), "nope"),
      params()
    );

    expect(unknownId.status).toBe(badSecret.status);
    expect(await unknownId.text()).toBe(await badSecret.text());
  });

  it("schedules the agent turn and answers 200 for a valid message", async () => {
    mockFindUnique.mockResolvedValue(channelRow() as never);

    const res = await telegramWebhook(buildRequest(messageUpdate(freshId()), SECRET), params());

    expect(res.status).toBe(200);
    expect(mockHandle).toHaveBeenCalledTimes(1);
    expect(mockHandle.mock.calls[0][0]).toEqual({
      id: "ch1",
      orgId: "org1",
      botToken: "v1:iv:tag:ct",
      plan: "pro",
      customSystemPrompt: "be terse",
    });
  });

  it("passes a null system prompt when the org has no agent settings", async () => {
    mockFindUnique.mockResolvedValue(
      channelRow({ org: { plan: "free", agentSettings: null } }) as never
    );

    await telegramWebhook(buildRequest(messageUpdate(freshId()), SECRET), params());

    expect(mockHandle.mock.calls[0][0].customSystemPrompt).toBeNull();
  });

  it("returns 200 and ignores a disabled channel", async () => {
    mockFindUnique.mockResolvedValue(channelRow({ enabled: false }) as never);

    const res = await telegramWebhook(buildRequest(messageUpdate(freshId()), SECRET), params());

    expect(res.status).toBe(200);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("returns 200 and ignores non-message updates", async () => {
    mockFindUnique.mockResolvedValue(channelRow() as never);

    const res = await telegramWebhook(
      buildRequest({ update_id: freshId(), edited_message: { message_id: 1 } }, SECRET),
      params()
    );

    expect(res.status).toBe(200);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("returns 200 for a malformed body instead of asking Telegram to resend", async () => {
    mockFindUnique.mockResolvedValue(channelRow() as never);

    const res = await telegramWebhook(buildRequest("not-json", SECRET), params());

    expect(res.status).toBe(200);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it("runs the turn only once when the same update_id arrives twice", async () => {
    // Telegram retries on any non-2xx, and the same update can also survive a
    // redeploy. Without this the user gets the answer twice.
    mockFindUnique.mockResolvedValue(channelRow() as never);
    const update = messageUpdate(freshId());

    const first = await telegramWebhook(buildRequest(update, SECRET), params());
    const second = await telegramWebhook(buildRequest(update, SECRET), params());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockHandle).toHaveBeenCalledTimes(1);
  });
});
