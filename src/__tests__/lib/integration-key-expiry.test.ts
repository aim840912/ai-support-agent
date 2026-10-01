import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: { integrationKey: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import { prisma } from "@/lib/db";
import { resolveOrgByIntegrationKey } from "@/lib/org-auth";
import {
  KEY_EXPIRY_OPTIONS,
  computeExpiresAt,
  isKeyExpired,
  isKeyExpiryDays,
} from "@/lib/integration-key-expiry";

const mockFindUnique = vi.mocked(prisma.integrationKey.findUnique);
const DAY = 24 * 60 * 60 * 1000;

describe("integration key expiry", () => {
  it("computes an expiry the given number of days out", () => {
    const now = new Date("2026-10-01T00:00:00Z");

    expect(computeExpiresAt(30, now)?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("treats null as never expiring", () => {
    expect(computeExpiresAt(null)).toBeNull();
    expect(isKeyExpired(null)).toBe(false);
  });

  it("counts a key as expired from the exact expiry instant", () => {
    const at = new Date(1_000_000);

    expect(isKeyExpired(at, 999_999)).toBe(false);
    expect(isKeyExpired(at, 1_000_000)).toBe(true);
  });

  it("accepts only the offered choices", () => {
    for (const days of KEY_EXPIRY_OPTIONS) expect(isKeyExpiryDays(days)).toBe(true);
    expect(isKeyExpiryDays(7)).toBe(false);
    expect(isKeyExpiryDays("90")).toBe(false);
    expect(isKeyExpiryDays(undefined)).toBe(false);
  });
});

describe("resolveOrgByIntegrationKey expiry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.integrationKey.updateMany).mockResolvedValue({ count: 1 });
  });

  function keyRow(expiresAt: Date | null) {
    return {
      id: "key-1",
      orgId: "org-1",
      revokedAt: null,
      expiresAt,
      lastUsedAt: new Date(),
      org: { plan: "pro" },
    } as never;
  }

  it("rejects an expired key", async () => {
    mockFindUnique.mockResolvedValue(keyRow(new Date(Date.now() - DAY)));

    await expect(resolveOrgByIntegrationKey("mcp_x")).resolves.toBeNull();
  });

  it("accepts a key that has not expired yet", async () => {
    mockFindUnique.mockResolvedValue(keyRow(new Date(Date.now() + DAY)));

    await expect(resolveOrgByIntegrationKey("mcp_x")).resolves.toMatchObject({ orgId: "org-1" });
  });
});
