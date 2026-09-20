import type { z } from "zod";
import { getPlanLimits } from "@/lib/plan/limits";
import { TOOL_METADATA } from "@/lib/ai/tool-metadata";
import {
  searchKnowledgeBaseDescription,
  searchKnowledgeBaseInputSchema,
  runSearchKnowledgeBase,
} from "./search-knowledge-base";
import {
  getOrderStatusDescription,
  getOrderStatusInputSchema,
  runGetOrderStatus,
} from "./get-order-status";
import {
  checkInventoryDescription,
  checkInventoryInputSchema,
  runCheckInventory,
} from "./check-inventory";
import { createTicketDescription, createTicketInputSchema, runCreateTicket } from "./create-ticket";

export const TOOL_NAMES = [
  "searchKnowledgeBase",
  "getOrderStatus",
  "checkInventory",
  "createTicket",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolDefinition<TIn> = {
  name: ToolName;
  /** Human-readable name for surfaces that show one, e.g. an MCP client's tool list. */
  title: string;
  description: string;
  /**
   * The SAME zod object the AI SDK tool uses. The MCP SDK accepts a Standard
   * Schema object, so there is no conversion layer between the two surfaces —
   * and therefore nothing that can drift.
   */
  inputSchema: z.ZodType<TIn>;
  run: (orgId: string, input: TIn) => Promise<unknown>;
  /** Writes tenant data. MCP clients surface this as a destructive action. */
  mutates: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- the registry is
   deliberately heterogeneous; each entry is individually typed above. */
export const TOOL_REGISTRY: Record<ToolName, ToolDefinition<any>> = {
  searchKnowledgeBase: {
    name: "searchKnowledgeBase",
    title: TOOL_METADATA.searchKnowledgeBase.label,
    description: searchKnowledgeBaseDescription,
    inputSchema: searchKnowledgeBaseInputSchema,
    run: runSearchKnowledgeBase,
    mutates: false,
  },
  getOrderStatus: {
    name: "getOrderStatus",
    title: TOOL_METADATA.getOrderStatus.label,
    description: getOrderStatusDescription,
    inputSchema: getOrderStatusInputSchema,
    run: runGetOrderStatus,
    mutates: false,
  },
  checkInventory: {
    name: "checkInventory",
    title: TOOL_METADATA.checkInventory.label,
    description: checkInventoryDescription,
    inputSchema: checkInventoryInputSchema,
    run: runCheckInventory,
    mutates: false,
  },
  createTicket: {
    name: "createTicket",
    title: TOOL_METADATA.createTicket.label,
    description: createTicketDescription,
    inputSchema: createTicketInputSchema,
    run: runCreateTicket,
    mutates: true,
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The tools a plan may use.
 *
 * Plan gating used to live only in createSupportAgent, which was fine while
 * chat was the only surface. MCP is a second one, so the rule had to move
 * somewhere both can read it.
 */
export function getToolsForPlan(plan: string): ToolDefinition<unknown>[] {
  const allowed = new Set(getPlanLimits(plan).enabledTools);
  return TOOL_NAMES.filter((name) => allowed.has(name)).map((name) => TOOL_REGISTRY[name]);
}

export function isToolAllowed(plan: string, name: string): boolean {
  return getPlanLimits(plan).enabledTools.includes(name);
}
