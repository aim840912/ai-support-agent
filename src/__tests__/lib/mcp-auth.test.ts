import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/lib/org-auth", () => ({ resolveOrgByIntegrationKey: vi.fn() }));
vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

import { resolveOrgByIntegrationKey } from "@/lib/org-auth";
import { authenticateMcpRequest, mcpUnauthorized } from "@/lib/mcp/auth";

const mockResolve = vi.mocked(resolveOrgByIntegrationKey);

function requestWith(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://localhost/api/mcp", { method: "POST", headers });
}

const ORG = { orgId: "org-1", plan: "pro", keyId: "key-1", source: "integration" as const };

describe("authenticateMcpRequest", () => {
  beforeEach(() => vi.resetAllMocks());

  it("resolves an organization for a valid bearer token", async () => {
    mockResolve.mockResolvedValue(ORG);

    await expect(authenticateMcpRequest(requestWith("Bearer mcp_valid"))).resolves.toEqual(ORG);
    expect(mockResolve).toHaveBeenCalledWith("mcp_valid");
  });

  it("only ever consults the integration key table", async () => {
    // This is the security claim of the whole design: Organization.apiKey is
    // printed into the customer's public web page for the chat widget, while
    // these tools read orders and create tickets. Accepting it here would hand
    // every visitor of every tenant's site a data-exfiltration credential.
    mockResolve.mockResolvedValue(null);

    const result = await authenticateMcpRequest(requestWith("Bearer sk_a_widget_key"));

    expect(result).toBeNull();
    // The widget key is passed to the integration lookup, which does not know
    // about Organization.apiKey — there is no second lookup to fall back to.
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith("sk_a_widget_key");
  });

  it("rejects a request with no Authorization header", async () => {
    await expect(authenticateMcpRequest(requestWith())).resolves.toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it.each([
    ["empty header", ""],
    ["scheme only", "Bearer"],
    ["wrong scheme", "Basic mcp_valid"],
    ["raw token without a scheme", "mcp_valid"],
  ])("rejects a malformed header (%s)", async (_label, header) => {
    await expect(authenticateMcpRequest(requestWith(header))).resolves.toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("accepts a lowercase scheme", async () => {
    mockResolve.mockResolvedValue(ORG);
    await expect(authenticateMcpRequest(requestWith("bearer mcp_valid"))).resolves.toEqual(ORG);
  });

  it("returns null for a revoked or unknown key", async () => {
    mockResolve.mockResolvedValue(null);
    await expect(authenticateMcpRequest(requestWith("Bearer mcp_revoked"))).resolves.toBeNull();
  });

  it("fails closed when the lookup throws", async () => {
    // A database outage must not become an open door.
    mockResolve.mockRejectedValue(new Error("db down"));
    await expect(authenticateMcpRequest(requestWith("Bearer mcp_valid"))).resolves.toBeNull();
  });
});

describe("mcpUnauthorized", () => {
  it("answers 401 with a bearer challenge and a JSON-RPC error body", async () => {
    const response = mcpUnauthorized();

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      error: { code: -32001 },
    });
  });
});
