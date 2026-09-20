import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import { getSafeErrorMessage } from "@/lib/api-error-handler";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { prepareChat, type PrepareChatError } from "@/lib/chat/prepare-chat";
import { generateChatReply } from "@/lib/chat/drivers";
import { loadRecentMessages } from "@/lib/chat/load-recent-messages";
import { decryptSecret } from "@/lib/crypto/secrets";
import { sendMessage, sendChatAction } from "./client";
import type { TelegramMessage } from "./types";
import type { UIMessage } from "ai";

/** Matches the widget's allowance. chatId is Telegram's equivalent of an IP. */
const telegramLimiter = createRateLimiter({ limit: 20, window: "1m" });

/**
 * How long an idle Telegram conversation keeps mapping to the same ChatSession.
 *
 * Without a window a user would be bound to one session forever, so the free
 * plan's messagesPerConversation limit would eventually wedge them permanently;
 * it would also render the dashboard's conversation list as one endless thread
 * instead of discrete conversations.
 */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

const RESET_COMMAND = "/reset";

export type TelegramChannelContext = {
  id: string;
  orgId: string;
  /** Still encrypted — decrypted here, never held by the route. */
  botToken: string;
  plan: string;
  customSystemPrompt: string | null;
};

/** Messages the user sees. Every one of these still answers Telegram with 200. */
const USER_FACING = {
  rateLimited: "You're sending messages too quickly — please wait a moment.",
  conversationLimit: "This workspace has reached its monthly conversation limit.",
  messageLimit: "This conversation has reached its message limit. Send /reset to start a new one.",
  nonText: "I can only read text messages right now.",
  resetDone: "Started a new conversation. What can I help you with?",
  generic: "Something went wrong on our side. Please try again in a moment.",
} as const;

function explain(error: PrepareChatError): string {
  switch (error.code) {
    case "CONVERSATION_LIMIT":
      return USER_FACING.conversationLimit;
    case "MESSAGE_LIMIT":
      return USER_FACING.messageLimit;
    case "SESSION_NOT_FOUND":
      // Unreachable in practice — we looked the session up ourselves — but an
      // exhaustive switch means a future error code cannot be silently dropped.
      return USER_FACING.generic;
  }
}

/**
 * Finds the conversation this chat belongs to, if it is still fresh.
 *
 * visitorId reuses the existing "anonymous external identity" column. The
 * `telegram:` prefix keeps it from colliding with widget visitor ids.
 */
async function findActiveSession(orgId: string, visitorId: string): Promise<string | undefined> {
  const existing = await prisma.chatSession.findFirst({
    where: {
      orgId,
      source: "telegram",
      visitorId,
      createdAt: { gte: new Date(Date.now() - SESSION_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return existing?.id;
}

/**
 * Runs one inbound Telegram message to completion and delivers the reply.
 *
 * Called after the webhook has already answered 200, so it must never throw:
 * there is no longer a response to turn an error into. Every failure path ends
 * in a sentence sent to the user.
 */
export async function handleTelegramMessage(
  channel: TelegramChannelContext,
  message: TelegramMessage
): Promise<void> {
  const chatId = message.chat.id;
  let botToken: string;

  try {
    botToken = decryptSecret(channel.botToken);
  } catch (error) {
    // Nothing can be sent without the token — not even an apology.
    logError("[telegram/handleMessage] token decrypt failed", error);
    return;
  }

  try {
    const text = message.text?.trim() ?? "";
    if (!text) {
      await sendMessage(botToken, chatId, USER_FACING.nonText);
      return;
    }

    const rate = await checkRateLimit(telegramLimiter, `telegram:${channel.orgId}:${chatId}`);
    if (!rate.success) {
      await sendMessage(botToken, chatId, USER_FACING.rateLimited);
      return;
    }

    const visitorId = `telegram:${chatId}`;
    const isReset = text.toLowerCase() === RESET_COMMAND;

    // /reset doesn't delete anything — it just declines to reuse the current
    // session, so the next turn starts a fresh one.
    const sessionId = isReset ? undefined : await findActiveSession(channel.orgId, visitorId);

    if (isReset) {
      await sendMessage(botToken, chatId, USER_FACING.resetDone);
      return;
    }

    await sendChatAction(botToken, chatId);

    const history = sessionId ? await loadRecentMessages(sessionId) : [];
    const userMessage: UIMessage = {
      id: `tg-${message.message_id}`,
      role: "user",
      parts: [{ type: "text", text }],
    };

    const prepared = await prepareChat({
      orgId: channel.orgId,
      messages: [...history, userMessage],
      sessionId,
      visitorId,
      source: "telegram",
      plan: channel.plan,
      customSystemPrompt: channel.customSystemPrompt,
    });

    if (!prepared.ok) {
      await sendMessage(botToken, chatId, explain(prepared.error));
      return;
    }

    const reply = await generateChatReply(prepared.ctx);
    await sendMessage(botToken, chatId, reply || USER_FACING.generic);

    await prisma.telegramChannel
      .update({ where: { id: channel.id }, data: { lastEventAt: new Date() } })
      .catch((e) => logError("[telegram/handleMessage] lastEventAt", e));
  } catch (error) {
    logError("[telegram/handleMessage]", error);
    // getSafeErrorMessage already distinguishes quota exhaustion from generic
    // failure without leaking internals.
    await sendMessage(botToken, chatId, getSafeErrorMessage(error)).catch(() => {});
  }
}
