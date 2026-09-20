import { after } from "next/server";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import { hashApiKey, secureCompareHex } from "@/lib/api-key";
import { handleTelegramMessage } from "@/lib/channels/telegram/handle-message";
import type { TelegramUpdate } from "@/lib/channels/telegram/types";

// node:crypto and Prisma — cannot run on the edge.
export const runtime = "nodejs";
export const maxDuration = 60;

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Recently handled update ids.
 *
 * Telegram retries with backoff on any non-2xx, and the same update can also
 * arrive twice across a redeploy. Per-instance like the rate limiter, and with
 * the same caveat: on serverless this deduplicates within one warm instance,
 * not globally. It is a second line of defence — answering 200 immediately is
 * the first.
 */
const seenUpdates = new Set<number>();
const SEEN_CAP = 200;

function alreadySeen(updateId: number): boolean {
  if (seenUpdates.has(updateId)) return true;

  seenUpdates.add(updateId);
  if (seenUpdates.size > SEEN_CAP) {
    // Sets iterate in insertion order, so this evicts the oldest.
    const oldest = seenUpdates.values().next().value;
    if (oldest !== undefined) seenUpdates.delete(oldest);
  }
  return false;
}

/**
 * Deliberately indistinguishable for "no such webhookId" and "wrong secret",
 * matching the Stripe webhook route: telling an attacker which half they got
 * right helps them craft a valid-looking request.
 */
function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

/**
 * Inbound Telegram updates.
 *
 * Answers 200 before doing any work. Telegram retries on non-2xx with backoff,
 * and an agent turn takes 5-15 seconds, so a handler that replied only when it
 * finished would routinely hand the user duplicate answers — the most visible
 * failure this integration can have. The turn itself runs in after(), which
 * keeps the function alive past the response.
 *
 * Every outcome below is a 200. A non-2xx here means "resend this", which is
 * never what we want for a message we have already seen.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ webhookId: string }> }
): Promise<Response> {
  const { webhookId } = await context.params;

  const channel = await prisma.telegramChannel.findUnique({
    where: { webhookId },
    select: {
      id: true,
      orgId: true,
      botToken: true,
      secretTokenHash: true,
      enabled: true,
      org: {
        select: {
          plan: true,
          agentSettings: { select: { systemPrompt: true } },
        },
      },
    },
  });

  if (!channel) return unauthorized();

  // The URL is stored on Telegram's servers and appears in logs, so knowing it
  // must not be sufficient to post updates. The secret token is the credential.
  const presented = request.headers.get(SECRET_HEADER);
  if (!presented || !secureCompareHex(hashApiKey(presented), channel.secretTokenHash)) {
    return unauthorized();
  }

  if (!channel.enabled) return new Response(null, { status: 200 });

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch (error) {
    logError("[telegram/webhook] malformed body", error);
    return new Response(null, { status: 200 });
  }

  // Edits, joins, reactions and every other update type are ignored in silence,
  // following the Stripe webhook's default branch.
  const message = update.message;
  if (!message || typeof update.update_id !== "number") {
    return new Response(null, { status: 200 });
  }

  if (alreadySeen(update.update_id)) return new Response(null, { status: 200 });

  after(() =>
    handleTelegramMessage(
      {
        id: channel.id,
        orgId: channel.orgId,
        botToken: channel.botToken,
        plan: channel.org.plan,
        customSystemPrompt: channel.org.agentSettings?.systemPrompt ?? null,
      },
      message
    )
  );

  return new Response(null, { status: 200 });
}
