import { resolveOrgByIntegrationKey, type ResolvedOrg } from "@/lib/org-auth";
import { logError } from "@/lib/error-logger";

/**
 * Bearer-token authentication for the MCP endpoint.
 *
 * Separated from the route so it can be tested as a plain function. That
 * matters more than usual here: the MCP handler itself may not load cleanly in
 * a node test environment, and the security claim this file makes — that a
 * widget key cannot drive MCP — needs a test regardless.
 */
export async function authenticateMcpRequest(request: Request): Promise<ResolvedOrg | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;

  try {
    // Only IntegrationKey is consulted. The widget key deliberately does not
    // work here: it ships inside the customer's public HTML, while these tools
    // read orders and create tickets.
    return await resolveOrgByIntegrationKey(token.trim());
  } catch (error) {
    logError("[mcp/auth]", error);
    return null;
  }
}

/**
 * RFC 9728-shaped challenge.
 *
 * A client configured with a static token never needs discovery, but sending
 * a well-formed challenge means one that expects to negotiate gets a usable
 * error instead of a bare rejection.
 */
export function mcpUnauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: provide a valid integration key" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="mcp", error="invalid_token"',
      },
    }
  );
}
