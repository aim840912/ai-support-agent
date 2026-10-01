import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import type { JWT } from "next-auth/jwt";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const DAY = 24 * 60 * 60;

type JwtParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>[0];

/** A remembered session whose last revalidation is older than the 24 h window. */
function staleToken(overrides: Partial<JWT> = {}): JWT {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "user-1",
    orgId: "org-1",
    role: "owner",
    rememberMe: true,
    loginAt: now - 2 * DAY,
    iat: now - 2 * DAY,
    passwordChangedAt: 0,
    passwordChangedAtCheckedAt: now - DAY - 60,
    ...overrides,
  } as JWT;
}

function runJwt(token: JWT) {
  return authConfig.callbacks!.jwt!({ token } as JwtParams);
}

describe("jwt revalidation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("invalidates the session of a deleted user", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(runJwt(staleToken())).resolves.toEqual({});
  });

  it("invalidates the session of a user removed from the org", async () => {
    mockFindUnique.mockResolvedValue({
      passwordChangedAt: null,
      activeOrgId: "org-1",
      organizations: [{ orgId: "org-2", role: "owner" }],
    } as never);

    await expect(runJwt(staleToken())).resolves.toEqual({});
  });

  it("refreshes the role from the current membership", async () => {
    mockFindUnique.mockResolvedValue({
      passwordChangedAt: null,
      activeOrgId: "org-1",
      organizations: [{ orgId: "org-1", role: "member" }],
    } as never);

    const result = await runJwt(staleToken());

    expect(result).toMatchObject({ orgId: "org-1", role: "member" });
  });

  it("skips the database inside the 24 h window", async () => {
    const now = Math.floor(Date.now() / 1000);

    await runJwt(staleToken({ passwordChangedAtCheckedAt: now - 60 }));

    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
