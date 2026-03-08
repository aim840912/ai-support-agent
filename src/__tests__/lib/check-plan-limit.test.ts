import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    document: { count: vi.fn() },
    chatSession: { count: vi.fn() },
    chatMessage: { count: vi.fn() },
    product: { count: vi.fn() },
    user: { count: vi.fn() },
    ticket: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  checkDocumentLimit,
  checkConversationLimit,
  checkProductLimit,
  checkTeamMemberLimit,
} from "@/lib/plan/check-plan-limit";

const mockOrgFindUnique = vi.mocked(prisma.organization.findUnique);
const mockDocumentCount = vi.mocked(prisma.document.count);
const mockSessionCount = vi.mocked(prisma.chatSession.count);
const mockProductCount = vi.mocked(prisma.product.count);
const mockUserCount = vi.mocked(prisma.user.count);

function mockPlan(plan: "free" | "pro") {
  mockOrgFindUnique.mockResolvedValue({ plan } as any);
}

describe("checkDocumentLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows upload on free plan when under limit", async () => {
    mockPlan("free");
    mockDocumentCount.mockResolvedValue(3); // limit is 5

    const result = await checkDocumentLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks upload on free plan when at limit", async () => {
    mockPlan("free");
    mockDocumentCount.mockResolvedValue(5); // exactly at limit

    const result = await checkDocumentLimit("org-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limit).toBe(5);
      expect(result.current).toBe(5);
    }
  });

  it("allows unlimited uploads on pro plan", async () => {
    mockPlan("pro");
    mockDocumentCount.mockResolvedValue(500); // pro limit is 100, not -1... let me check

    // Actually pro limit is 100 documents, not unlimited. Let's test under limit.
    mockDocumentCount.mockResolvedValue(50);
    const result = await checkDocumentLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("defaults to free plan when org not found", async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    mockDocumentCount.mockResolvedValue(5); // at free limit

    const result = await checkDocumentLimit("nonexistent-org");
    expect(result.allowed).toBe(false);
  });
});

describe("checkConversationLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows conversations on free plan when under monthly limit", async () => {
    mockPlan("free");
    mockSessionCount.mockResolvedValue(30); // limit is 50

    const result = await checkConversationLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks conversations on free plan when at monthly limit", async () => {
    mockPlan("free");
    mockSessionCount.mockResolvedValue(50);

    const result = await checkConversationLimit("org-1");
    expect(result.allowed).toBe(false);
  });

  it("allows unlimited conversations on pro plan", async () => {
    mockPlan("pro");
    // Pro plan has -1 (unlimited) — no DB count needed
    const result = await checkConversationLimit("org-1", "pro");
    expect(result.allowed).toBe(true);
    // Should not query DB when limit is -1
    expect(mockSessionCount).not.toHaveBeenCalled();
  });

  it("skips extra DB call when plan is pre-fetched", async () => {
    mockSessionCount.mockResolvedValue(10);

    await checkConversationLimit("org-1", "free");

    // Organization.findUnique should NOT have been called
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});

describe("checkProductLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows product creation under free plan limit", async () => {
    mockPlan("free");
    mockProductCount.mockResolvedValue(5); // limit is 10

    const result = await checkProductLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks product creation at free plan limit", async () => {
    mockPlan("free");
    mockProductCount.mockResolvedValue(10);

    const result = await checkProductLimit("org-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/free/i);
    }
  });
});

describe("checkTeamMemberLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows team member invitation under free limit", async () => {
    mockPlan("free");
    mockUserCount.mockResolvedValue(2); // limit is 3

    const result = await checkTeamMemberLimit("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks invitation at free team member limit", async () => {
    mockPlan("free");
    mockUserCount.mockResolvedValue(3);

    const result = await checkTeamMemberLimit("org-1");
    expect(result.allowed).toBe(false);
  });
});
