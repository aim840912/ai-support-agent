/**
 * Shared tool metadata — single source of truth for tool names, labels,
 * icons, and colors. Used by both live chat (tool-call-display) and
 * conversation history (tool-call-badge).
 */

export const TOOL_LABELS: Record<string, string> = {
  searchKnowledgeBase: "Searching knowledge base",
  getOrderStatus: "Checking order status",
  checkInventory: "Checking inventory",
  createTicket: "Creating support ticket",
};

export type ToolMeta = {
  /** Short label shown in badges */
  label: string;
  /** Tailwind text-color class (supports dark: variant) */
  color: string;
  /** Tailwind bg-color class (supports dark: variant) */
  bg: string;
};

export const TOOL_METADATA: Record<string, ToolMeta> = {
  searchKnowledgeBase: {
    label: "KB Search",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50",
  },
  getOrderStatus: {
    label: "Order Status",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/50",
  },
  checkInventory: {
    label: "Inventory",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
  },
  createTicket: {
    label: "Create Ticket",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-950/50",
  },
};
