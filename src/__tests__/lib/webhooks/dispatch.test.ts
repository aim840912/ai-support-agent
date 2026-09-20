import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEndpoint: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    webhookDelivery: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import { prisma } from "@/lib/db";
import {
  deliverOnce,
  dispatchWebhooks,
  validateWebhookUrl,
  FAILURE_THRESHOLD,
} from "@/lib/webhooks/dispatch";
import {
  verifySignature,
  SIGNATURE_HEADER,
  ID_HEADER,
  EVENT_HEADER,
} from "@/lib/webhook-signature";
import type { WebhookEvent } from "@/lib/webhooks/events";

const mockFindMany = vi.mocked(prisma.webhookEndpoint.findMany);
const mockUpdate = vi.mocked(prisma.webhookEndpoint.update);
const mockUpdateMany = vi.mocked(prisma.webhookEndpoint.updateMany);
const mockDeliveryCreate = vi.mocked(prisma.webhookDelivery.create);
const mockDeliveryFindMany = vi.mocked(prisma.webhookDelivery.findMany);

const ENDPOINT = {
  id: "ep-1",
  url: "https://receiver.example/hook",
  secret: "whsec_shared_value",
  orgId: "org-1",
};

const EVENT: WebhookEvent = {
  id: "evt_abc",
  event: "ticket.created",
  createdAt: "2026-09-20T10:00:00.000Z",
  orgId: "org-1",
  data: { ticketNumber: "TKT-1001" },
};

function stubFetch(...responses: ({ status: number; body?: string } | Error)[]) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else
      fn.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        text: async () => r.body ?? "",
      });
  }
  fn.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function headersOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers as Record<string, string>;
}

describe("validateWebhookUrl", () => {
  it("accepts a public https URL", () => {
    expect(validateWebhookUrl("https://hooks.example.com/abc")).toEqual({ ok: true });
  });

  it("rejects a malformed URL", () => {
    expect(validateWebhookUrl("not a url").ok).toBe(false);
  });

  it.each([
    "https://10.0.0.5/hook",
    "https://192.168.1.10/hook",
    "https://172.16.4.2/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://internal-api.internal/hook",
    "https://printer.local/hook",
  ])("rejects the private address %s", (url) => {
    // 169.254.169.254 is the cloud metadata endpoint — the classic SSRF target.
    expect(validateWebhookUrl(url).ok).toBe(false);
  });

  it("allows loopback outside production, for local automation tools", () => {
    expect(validateWebhookUrl("http://localhost:5678/webhook").ok).toBe(true);
  });
});

describe("deliverOnce", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDeliveryFindMany.mockResolvedValue([] as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the identifying headers and a signature the receiver can verify", async () => {
    const fetchMock = stubFetch({ status: 200 });

    const result = await deliverOnce(ENDPOINT, EVENT);

    expect(result.ok).toBe(true);
    const headers = headersOf(fetchMock);
    expect(headers[ID_HEADER]).toBe("evt_abc");
    expect(headers[EVENT_HEADER]).toBe("ticket.created");

    // The point of the whole module: what was sent verifies against the
    // endpoint's secret, using the same function the docs hand to receivers.
    const body = fetchMock.mock.calls[0][1].body as string;
    expect(verifySignature(body, headers[SIGNATURE_HEADER], ENDPOINT.secret)).toEqual({
      valid: true,
    });
  });

  it("retries once on a 500 and records the attempt count", async () => {
    const fetchMock = stubFetch({ status: 500 }, { status: 200 });

    const result = await deliverOnce(ENDPOINT, EVENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(2);
  });

  it("does not retry a 400 — the receiver understood and refused", async () => {
    const fetchMock = stubFetch({ status: 400 });

    const result = await deliverOnce(ENDPOINT, EVENT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it("retries a 429", async () => {
    const fetchMock = stubFetch({ status: 429 }, { status: 200 });

    await deliverOnce(ENDPOINT, EVENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records a null status code when the request never completed", async () => {
    stubFetch(new Error("timeout"), new Error("timeout"));

    const result = await deliverOnce(ENDPOINT, EVENT);

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
  });

  it("treats a network failure as retryable and recovers on the second attempt", async () => {
    const fetchMock = stubFetch(new Error("ECONNREFUSED"), { status: 200 });

    const result = await deliverOnce(ENDPOINT, EVENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, attempt: 2 });
  });

  it("never throws when every attempt rejects", async () => {
    stubFetch(new Error("ECONNREFUSED"), new Error("ECONNREFUSED"));
    await expect(deliverOnce(ENDPOINT, EVENT)).resolves.toMatchObject({ ok: false });
  });

  it("refuses a private destination without making a request", async () => {
    const fetchMock = stubFetch({ status: 200 });

    const result = await deliverOnce({ ...ENDPOINT, url: "https://10.1.2.3/hook" }, EVENT);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(mockDeliveryCreate).toHaveBeenCalled();
  });

  it("resets the failure count after a success", async () => {
    stubFetch({ status: 200 });

    await deliverOnce(ENDPOINT, EVENT);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ep-1", orgId: "org-1" },
        data: expect.objectContaining({ failureCount: 0 }),
      })
    );
  });

  it("disables the endpoint once failures reach the threshold", async () => {
    stubFetch({ status: 400 });
    mockUpdate.mockResolvedValue({ failureCount: FAILURE_THRESHOLD } as never);

    await deliverOnce(ENDPOINT, EVENT);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enabled: false } })
    );
  });

  it("reports the delivery result even when recording it fails", async () => {
    stubFetch({ status: 200 });
    mockDeliveryCreate.mockRejectedValue(new Error("db down"));

    await expect(deliverOnce(ENDPOINT, EVENT)).resolves.toMatchObject({ ok: true });
  });
});

describe("dispatchWebhooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDeliveryFindMany.mockResolvedValue([] as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("queries only enabled endpoints subscribed to the event", async () => {
    mockFindMany.mockResolvedValue([] as never);

    await dispatchWebhooks("org-1", "ticket.created", () => EVENT);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1", enabled: true, events: { has: "ticket.created" } },
      })
    );
  });

  it("does not build a payload when nothing is subscribed", async () => {
    mockFindMany.mockResolvedValue([] as never);
    const build = vi.fn(() => EVENT);

    await dispatchWebhooks("org-1", "ticket.created", build);

    expect(build).not.toHaveBeenCalled();
  });

  it("delivers to every matching endpoint", async () => {
    mockFindMany.mockResolvedValue([ENDPOINT, { ...ENDPOINT, id: "ep-2" }] as never);
    const fetchMock = stubFetch({ status: 200 }, { status: 200 });

    await dispatchWebhooks("org-1", "ticket.created", () => EVENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never throws when the endpoint query fails", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));

    await expect(dispatchWebhooks("org-1", "ticket.created", () => EVENT)).resolves.toBeUndefined();
  });
});
