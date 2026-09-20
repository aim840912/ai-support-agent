import { getToolsForPlan, isToolAllowed } from "@/lib/ai/tools/registry";
import { logError } from "@/lib/error-logger";

/**
 * Minimal shape of the MCP server object used here. Typed locally so this
 * module does not depend on the SDK's generic surface.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the SDK types the tool
   handler's argument as `any`; narrowing it here would not match. */
type McpToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

type McpServerLike = {
  registerTool: (
    name: string,
    config: Record<string, unknown>,
    handler: (args: any, ctx?: any) => Promise<McpToolResult>
  ) => unknown;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Registers the tools one organization's plan allows.
 *
 * Gating happens twice, on purpose:
 *
 *  1. At list time — a free-plan client never *sees* createTicket or
 *     checkInventory, so the upgrade boundary is visible rather than a
 *     surprise error.
 *  2. At call time — a client that cached an older tool list, or a future
 *     refactor that registers everything, still cannot execute a tool the
 *     plan excludes.
 *
 * This is possible only because the handler is built per request. The plan is
 * read from the database on every call, so an upgrade takes effect on the next
 * request with no cache to invalidate.
 */
export function registerToolsForPlan(server: McpServerLike, orgId: string, plan: string): void {
  for (const definition of getToolsForPlan(plan)) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        annotations: {
          readOnlyHint: !definition.mutates,
          destructiveHint: definition.mutates,
        },
      },
      async (input: unknown) => {
        if (!isToolAllowed(plan, definition.name)) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `The tool "${definition.name}" is not available on the ${plan} plan.`,
              },
            ],
          };
        }

        try {
          const result = await definition.run(orgId, input);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          // An MCP error result keeps the client's session alive; throwing
          // would drop it.
          logError(`[mcp/${definition.name}]`, error);
          return {
            isError: true,
            content: [{ type: "text" as const, text: "The tool failed. Please try again." }],
          };
        }
      }
    );
  }
}
