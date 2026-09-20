import { prisma } from "@/lib/db";
import type { UIMessage } from "ai";

/** Roughly 5 exchanges. Matches the free plan's messagesPerConversation. */
export const DEFAULT_HISTORY_LIMIT = 10;

/**
 * Character ceiling for rehydrated history. Not a token count — a cheap guard
 * against the worst case (10 rows x MAX_MESSAGE_LENGTH = 40k characters), which
 * would otherwise be sent on every turn.
 */
export const DEFAULT_HISTORY_CHAR_BUDGET = 6000;

/** Roles the AI SDK accepts on a UIMessage. DB rows may also carry "tool". */
const REPLAYABLE_ROLES = new Set(["user", "assistant"]);

/**
 * Rebuilds recent conversation history from the transcript.
 *
 * Only channels that don't carry their own history need this: the web clients
 * keep it in the browser and resend it, whereas a messaging webhook delivers
 * one line at a time.
 *
 * **Text only, by design.** Persisted tool parts store `{ toolName, toolCallId }`
 * with no input or output, so they cannot be rebuilt into a valid tool-call
 * part — and a tool-call without its matching tool-result is rejected by most
 * providers. The information isn't lost: whatever the tool found is already in
 * the assistant's text. The cost is that the model may re-run an idempotent
 * lookup it already performed.
 */
export async function loadRecentMessages(
  sessionId: string,
  limit: number = DEFAULT_HISTORY_LIMIT,
  charBudget: number = DEFAULT_HISTORY_CHAR_BUDGET
): Promise<UIMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { sessionId },
    // Newest first, then reversed below. `asc` + `take` would return the
    // OLDEST N messages, which is the opposite of what history means.
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, role: true, content: true },
  });

  const kept: UIMessage[] = [];
  let used = 0;

  for (const row of rows) {
    if (!REPLAYABLE_ROLES.has(row.role)) continue;

    // An assistant turn that only called tools is persisted with content "".
    // Replaying it as an empty text part makes most providers return 400, so
    // this filter is required rather than defensive.
    if (row.content.length === 0) continue;

    // Always keep the newest replayable row, even if it alone blows the budget —
    // returning nothing would silently drop all context.
    if (kept.length > 0 && used + row.content.length > charBudget) break;

    used += row.content.length;
    kept.push({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: [{ type: "text", text: row.content }],
    });
  }

  return kept.reverse();
}
