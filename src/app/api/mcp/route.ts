import { createMcpHandler } from "mcp-handler";
import { authenticateMcpRequest, mcpUnauthorized } from "@/lib/mcp/auth";
import { registerToolsForPlan } from "@/lib/mcp/register";
import {
  createRateLimiter,
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
} from "@/lib/rate-limit";

// Prisma, the Neon adapter and node:crypto — this cannot run on the edge.
export const runtime = "nodejs";
// A knowledge-base search can be slow; measured before tightening.
export const maxDuration = 60;

const mcpLimiter = createRateLimiter({ limit: 60, window: "1m" });

/**
 * MCP server exposing the support agent's tools to external clients.
 *
 * Authentication is done here rather than with the SDK's withMcpAuth wrapper.
 * That wrapper takes an already-constructed handler, which fixes the tool list
 * before the token is known — but the tool list is exactly what varies by
 * tenant and plan. Building the handler per request costs nothing in v2, which
 * is stateless and creates a fresh server for every request anyway; the price
 * is writing the 401 ourselves.
 */
async function handler(request: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(request);
  if (!auth) return mcpUnauthorized();

  // Keyed on org + IP, matching the widget route: the raw credential never
  // reaches the rate-limit store.
  const rl = await checkRateLimit(mcpLimiter, `mcp:${auth.orgId}:${getClientIp(request)}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const mcp = createMcpHandler((server) => registerToolsForPlan(server, auth.orgId, auth.plan), {
    serverInfo: { name: "ai-support-agent", version: "1.0.0" },
    capabilities: { tools: {} },
    instructions:
      "Customer support tools for one organization. Every tool is scoped to the organization that owns the credential in use.",
  });

  return mcp(request);
}

export { handler as GET, handler as POST };
