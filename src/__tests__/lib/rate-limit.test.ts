import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRateLimiter,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

// Use a unique prefix per test to avoid cross-test pollution in the shared store
let testPrefix = 0;
function uid() {
  return `test-${testPrefix++}-${Math.random()}`;
}

describe("createRateLimiter", () => {
  it("parses seconds window", () => {
    const rl = createRateLimiter({ limit: 5, window: "30s" });
    expect(rl.windowMs).toBe(30_000);
    expect(rl.limit).toBe(5);
  });

  it("parses minutes window", () => {
    const rl = createRateLimiter({ limit: 10, window: "15m" });
    expect(rl.windowMs).toBe(900_000);
  });

  it("parses hours window", () => {
    const rl = createRateLimiter({ limit: 100, window: "1h" });
    expect(rl.windowMs).toBe(3_600_000);
  });

  it("throws on invalid window format", () => {
    expect(() => createRateLimiter({ limit: 5, window: "5d" })).toThrow();
  });
});

describe("checkRateLimit", () => {
  it("allows requests within limit", async () => {
    const limiter = createRateLimiter({ limit: 3, window: "1m" });
    const id = uid();

    const r1 = await checkRateLimit(limiter, id);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(limiter, id);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(limiter, id);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests beyond limit", async () => {
    const limiter = createRateLimiter({ limit: 2, window: "1m" });
    const id = uid();

    await checkRateLimit(limiter, id);
    await checkRateLimit(limiter, id);
    const blocked = await checkRateLimit(limiter, id);

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns a reset timestamp in the future", async () => {
    const limiter = createRateLimiter({ limit: 5, window: "1m" });
    const id = uid();

    const result = await checkRateLimit(limiter, id);
    expect(result.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("different identifiers are isolated", async () => {
    const limiter = createRateLimiter({ limit: 1, window: "1m" });

    const a = uid();
    const b = uid();

    await checkRateLimit(limiter, a); // exhaust a
    const resultB = await checkRateLimit(limiter, b);

    expect(resultB.success).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "1.2.3.4",
        "x-forwarded-for": "5.6.7.8",
      },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to unknown when no IP header", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });
});
