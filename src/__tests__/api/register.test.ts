import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before importing the route) ──────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

vi.mock("@/lib/email/send-verification", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mock-mode", () => ({
  isResendConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
}));

// Rate limiter — always allow in tests
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 4, reset: 9999999999 }),
  };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { POST } from "@/app/api/register/route";
import { prisma } from "@/lib/db";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockTransaction = vi.mocked(prisma.$transaction);

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(body: object) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "test@example.com",
  password: "SecurePass1",
  name: "Test User",
  orgName: "Test Org",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: email doesn't exist, transaction succeeds
    mockFindUnique.mockResolvedValue(null);
    mockTransaction.mockResolvedValue({} as any);
  });

  it("returns 201 on successful registration", async () => {
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message).toMatch(/check your inbox/i);
  });

  it("returns 201 even when email already exists (anti-enumeration)", async () => {
    // Simulate duplicate email — route must return same 201 to prevent enumeration
    mockFindUnique.mockResolvedValue({ id: "existing-user" } as any);

    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message).toMatch(/check your inbox/i);
  });

  it("returns 400 on validation failure (invalid email)", async () => {
    const res = await POST(buildRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on validation failure (weak password)", async () => {
    const res = await POST(buildRequest({ ...validBody, password: "weak" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on validation failure (missing name)", async () => {
    const res = await POST(buildRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid invite token", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("INVALID_INVITE"));

    const res = await POST(
      buildRequest({ ...validBody, inviteToken: "bad-token", orgName: undefined })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invitation/i);
  });
});
