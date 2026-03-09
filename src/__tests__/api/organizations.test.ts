import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userOrganization: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/api-key", () => ({
  generateApiKey: vi.fn().mockReturnValue("raw-api-key-123"),
  hashApiKey: vi.fn().mockReturnValue("hashed-api-key-123"),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { GET as getOrganizations } from "@/app/api/organizations/route";
import { POST as switchOrg } from "@/app/api/organizations/switch/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const mockAuth = vi.mocked(auth);
const mockMembershipFindMany = vi.mocked(prisma.userOrganization.findMany);
const mockMembershipFindUnique = vi.mocked(prisma.userOrganization.findUnique);
const mockUserUpdate = vi.mocked(prisma.user.update);

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRequest(body?: object) {
  return new NextRequest("http://localhost/api/organizations/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockSession(overrides?: object) {
  mockAuth.mockResolvedValue({
    user: { id: "user-1", orgId: "org-1", email: "test@example.com", ...overrides },
  } as any);
}

// ── GET /api/organizations ────────────────────────────────────────────────────

describe("GET /api/organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(undefined as any);

    const res = await getOrganizations();
    expect(res.status).toBe(401);
  });

  it("returns list of orgs with isActive flag", async () => {
    mockSession();
    mockMembershipFindMany.mockResolvedValue([
      {
        userId: "user-1",
        orgId: "org-1",
        role: "owner",
        org: { id: "org-1", name: "Haude Tea", plan: "pro" },
      },
      {
        userId: "user-1",
        orgId: "org-2",
        role: "admin",
        org: { id: "org-2", name: "Other Client", plan: "free" },
      },
    ] as any);

    const res = await getOrganizations();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0]).toMatchObject({
      id: "org-1",
      name: "Haude Tea",
      role: "owner",
      isActive: true,
    });
    expect(json[1]).toMatchObject({
      id: "org-2",
      name: "Other Client",
      role: "admin",
      isActive: false,
    });
  });
});

// ── POST /api/organizations/switch ────────────────────────────────────────────

describe("POST /api/organizations/switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(undefined as any);

    const res = await switchOrg(buildRequest({ orgId: "org-2" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing orgId", async () => {
    mockSession();

    const res = await switchOrg(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a member of target org", async () => {
    mockSession();
    mockMembershipFindUnique.mockResolvedValue(null); // not a member

    const res = await switchOrg(buildRequest({ orgId: "org-99" }));
    expect(res.status).toBe(403);
  });

  it("switches active org and returns success", async () => {
    mockSession();
    mockMembershipFindUnique.mockResolvedValue({ role: "admin" } as any);
    mockUserUpdate.mockResolvedValue({} as any);

    const res = await switchOrg(buildRequest({ orgId: "org-2" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toMatchObject({ success: true, orgId: "org-2", role: "admin" });

    // Verify the DB was updated
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { activeOrgId: "org-2" },
    });
  });

  it("validates membership before switching — prevents cross-tenant escalation", async () => {
    mockSession();
    // Simulate a user trying to switch to an org they don't belong to
    mockMembershipFindUnique.mockResolvedValue(null);

    const res = await switchOrg(buildRequest({ orgId: "attacker-org" }));
    expect(res.status).toBe(403);
    // User.update should NOT have been called
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
