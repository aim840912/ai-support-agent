import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import {
  chunkForTelegram,
  sendMessage,
  sendChatAction,
  getMe,
  setWebhook,
  TELEGRAM_MESSAGE_LIMIT,
} from "@/lib/channels/telegram/client";

const TOKEN = "123456:TEST-TOKEN";

function mockFetchSequence(
  ...responses: { ok: boolean; result?: unknown; error_code?: number; description?: string }[]
) {
  const fn = vi.fn();
  for (const body of responses) {
    fn.mockResolvedValueOnce({ json: async () => body });
  }
  // Anything beyond the scripted responses succeeds, so a test that sends more
  // chunks than expected fails on its assertions rather than on a crash.
  fn.mockResolvedValue({ json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe("chunkForTelegram", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkForTelegram("hello")).toEqual(["hello"]);
  });

  it("returns nothing for empty text", () => {
    expect(chunkForTelegram("")).toEqual([]);
  });

  it("splits at a paragraph boundary rather than mid-word", () => {
    const first = "a".repeat(60);
    const second = "b".repeat(60);
    const chunks = chunkForTelegram(`${first}\n\n${second}`, 100);

    expect(chunks).toEqual([first, second]);
  });

  it("falls back to a line break when no paragraph break fits", () => {
    const first = "a".repeat(60);
    const second = "b".repeat(60);
    const chunks = chunkForTelegram(`${first}\n${second}`, 100);

    expect(chunks).toEqual([first, second]);
  });

  it("hard-splits text with no break characters", () => {
    const chunks = chunkForTelegram("x".repeat(250), 100);

    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join("")).toBe("x".repeat(250));
  });

  it("keeps every chunk within Telegram's limit by default", () => {
    const chunks = chunkForTelegram("word ".repeat(3000));
    expect(chunks.every((c) => c.length <= TELEGRAM_MESSAGE_LIMIT)).toBe(true);
  });
});

describe("telegram client", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the bot-token URL with chat_id and text", async () => {
    const fetchMock = mockFetchSequence({ ok: true });

    await sendMessage(TOKEN, 42, "hello");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(bodyOf(fetchMock, 0)).toEqual({ chat_id: 42, text: "hello" });
  });

  it("omits parse_mode unless one is given", async () => {
    const fetchMock = mockFetchSequence({ ok: true });

    await sendMessage(TOKEN, 42, "hello");

    expect(bodyOf(fetchMock, 0)).not.toHaveProperty("parse_mode");
  });

  it("resends as plain text when a formatted send is rejected", async () => {
    // Telegram refuses the whole message on an entity-parsing error, so without
    // the fallback the user would receive nothing at all.
    const fetchMock = mockFetchSequence(
      { ok: false, error_code: 400, description: "can't parse entities" },
      { ok: true }
    );

    const sent = await sendMessage(TOKEN, 42, "**bold*", "HTML");

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock, 0)).toHaveProperty("parse_mode", "HTML");
    expect(bodyOf(fetchMock, 1)).not.toHaveProperty("parse_mode");
  });

  it("does not retry when no parse mode was used", async () => {
    const fetchMock = mockFetchSequence({ ok: false, description: "chat not found" });

    const sent = await sendMessage(TOKEN, 42, "hello");

    expect(sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the network call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(sendMessage(TOKEN, 42, "hello")).resolves.toBe(false);
  });

  it("sends one request per chunk for a long reply", async () => {
    const fetchMock = mockFetchSequence({ ok: true }, { ok: true });

    await sendMessage(TOKEN, 42, "y".repeat(TELEGRAM_MESSAGE_LIMIT + 500));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sendChatAction posts the typing action", async () => {
    const fetchMock = mockFetchSequence({ ok: true });

    await sendChatAction(TOKEN, 42);

    expect(fetchMock.mock.calls[0][0]).toContain("/sendChatAction");
    expect(bodyOf(fetchMock, 0)).toEqual({ chat_id: 42, action: "typing" });
  });

  it("getMe surfaces the bot username", async () => {
    mockFetchSequence({
      ok: true,
      result: { id: 1, is_bot: true, first_name: "B", username: "my_bot" },
    });

    await expect(getMe(TOKEN)).resolves.toEqual({
      ok: true,
      username: "my_bot",
      description: undefined,
    });
  });

  it("getMe reports an invalid token without throwing", async () => {
    mockFetchSequence({ ok: false, error_code: 401, description: "Unauthorized" });

    const result = await getMe("bad-token");

    expect(result.ok).toBe(false);
    expect(result.description).toBe("Unauthorized");
  });

  it("setWebhook registers the secret token and limits updates to messages", async () => {
    const fetchMock = mockFetchSequence({ ok: true, result: true });

    await setWebhook(TOKEN, "https://example.com/api/channels/telegram/abc", "s3cret");

    expect(bodyOf(fetchMock, 0)).toMatchObject({
      url: "https://example.com/api/channels/telegram/abc",
      secret_token: "s3cret",
      allowed_updates: ["message"],
    });
  });
});
