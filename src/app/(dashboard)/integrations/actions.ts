"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { logError } from "@/lib/error-logger";
import { hashApiKey } from "@/lib/api-key";
import { encryptSecret, decryptSecret, isSecretEncryptionConfigured } from "@/lib/crypto/secrets";
import { getMe, setWebhook, deleteWebhook } from "@/lib/channels/telegram/client";
import { getPublicBaseUrl, isPubliclyReachable } from "@/lib/public-url";
import { isDemoUser } from "@/lib/demo";

/**
 * Server actions are callable from the browser, so every one of these
 * re-derives the org from the session and validates its input. The
 * TypeScript signature is not a control.
 */
async function requireWriteAccess() {
  const session = await auth();
  if (!session?.user?.orgId) throw new Error("Unauthorized");

  const role = session.user.role;
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden: insufficient permissions");
  }

  // The shared demo login is public — let it look around, not reconfigure.
  if (isDemoUser(session.user.email)) {
    throw new Error("The demo account cannot change integration settings");
  }

  return { orgId: session.user.orgId };
}

/** Telegram accepts only these characters in a secret token. */
function generateSecretToken(): string {
  return randomBytes(24).toString("base64url");
}

const telegramSchema = z.object({
  // 123456789:AA... — reject obvious nonsense before spending a round trip.
  botToken: z
    .string()
    .trim()
    .regex(/^\d{5,}:[A-Za-z0-9_-]{30,}$/, "That doesn't look like a BotFather token")
    .optional(),
  enabled: z.boolean(),
});

export type TelegramActionResult = {
  ok: boolean;
  message: string;
  botUsername?: string;
};

/**
 * Creates or updates the org's Telegram channel and registers the webhook.
 *
 * A new token always gets a new webhookId and secret: rotating the credential
 * while leaving the URL in place would keep any previously leaked URL valid.
 */
export async function saveTelegramChannel(input: {
  botToken?: string;
  enabled: boolean;
}): Promise<TelegramActionResult> {
  const { orgId } = await requireWriteAccess();

  const parsed = telegramSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { botToken, enabled } = parsed.data;

  if (!isSecretEncryptionConfigured()) {
    return {
      ok: false,
      message: "INTEGRATION_ENCRYPTION_KEY is not configured on the server.",
    };
  }

  const existing = await prisma.telegramChannel.findUnique({
    where: { orgId },
    select: { id: true, botToken: true, webhookId: true },
  });

  if (!botToken && !existing) {
    return { ok: false, message: "Paste a bot token from @BotFather to connect Telegram." };
  }

  try {
    // Resolve the token we will actually use: the new one, or the stored one
    // when the user is only toggling `enabled`.
    const effectiveToken = botToken ?? decryptSecret(existing!.botToken);

    const identity = await getMe(effectiveToken);
    if (!identity.ok) {
      return { ok: false, message: identity.description ?? "Telegram rejected that token." };
    }

    const baseUrl = getPublicBaseUrl();
    if (enabled && !isPubliclyReachable(baseUrl)) {
      return {
        ok: false,
        message: `Telegram cannot reach ${baseUrl}. Set INTEGRATIONS_PUBLIC_URL to a public HTTPS address.`,
      };
    }

    // Enabling ALWAYS mints a new webhookId and secret, even when nothing else
    // changed. Two reasons, and the first is a correctness bug rather than a
    // preference: disabling calls deleteWebhook, so a pause/resume cycle needs
    // a fresh registration — and we only store the secret's hash, so the old
    // one cannot be replayed even if we wanted to. Re-minting also retires any
    // previously exposed URL on every reconnect.
    const webhookId = randomBytes(16).toString("base64url");
    const secretToken = generateSecretToken();

    if (enabled) {
      const registered = await setWebhook(
        effectiveToken,
        `${baseUrl}/api/channels/telegram/${webhookId}`,
        secretToken
      );
      if (!registered.ok) {
        // Nothing has been written yet, so a failure here leaves the stored
        // channel exactly as it was rather than half-updated.
        return {
          ok: false,
          message: registered.description ?? "Could not register the webhook with Telegram.",
        };
      }
    } else {
      await deleteWebhook(effectiveToken);
    }

    await prisma.telegramChannel.upsert({
      where: { orgId },
      create: {
        orgId,
        webhookId,
        botToken: encryptSecret(effectiveToken),
        botUsername: identity.username ?? null,
        secretTokenHash: hashApiKey(secretToken),
        enabled,
      },
      update: {
        ...(botToken ? { botToken: encryptSecret(botToken) } : {}),
        // Only overwrite the routing credentials when they were actually
        // registered; a disable keeps the old pair, which is already inert
        // because Telegram has been told to stop delivering.
        ...(enabled ? { webhookId, secretTokenHash: hashApiKey(secretToken) } : {}),
        botUsername: identity.username ?? null,
        enabled,
      },
    });

    revalidatePath("/integrations");
    return {
      ok: true,
      botUsername: identity.username,
      message: enabled
        ? `Connected as @${identity.username}. Send it a message to try it out.`
        : `Disconnected @${identity.username}. It will stop replying.`,
    };
  } catch (error) {
    logError("[integrations/saveTelegramChannel]", error);
    return { ok: false, message: "Could not save the Telegram channel. Please try again." };
  }
}

/** Confirms the stored token still works, without changing anything. */
export async function testTelegramChannel(): Promise<TelegramActionResult> {
  const { orgId } = await requireWriteAccess();

  const channel = await prisma.telegramChannel.findUnique({
    where: { orgId },
    select: { botToken: true },
  });
  if (!channel) return { ok: false, message: "No Telegram channel is connected." };

  try {
    const identity = await getMe(decryptSecret(channel.botToken));
    return identity.ok
      ? { ok: true, botUsername: identity.username, message: `@${identity.username} is reachable.` }
      : { ok: false, message: identity.description ?? "Telegram rejected the stored token." };
  } catch (error) {
    logError("[integrations/testTelegramChannel]", error);
    return { ok: false, message: "Could not reach Telegram." };
  }
}

export async function disconnectTelegramChannel(): Promise<TelegramActionResult> {
  const { orgId } = await requireWriteAccess();

  const channel = await prisma.telegramChannel.findUnique({
    where: { orgId },
    select: { botToken: true },
  });
  if (!channel) return { ok: false, message: "No Telegram channel is connected." };

  try {
    // Tell Telegram to stop delivering before dropping the row, so updates
    // can't arrive for a channel we can no longer authenticate.
    await deleteWebhook(decryptSecret(channel.botToken));
  } catch (error) {
    logError("[integrations/disconnectTelegramChannel] deleteWebhook", error);
  }

  // deleteMany scoped by orgId, never delete({ where: { id } }) — see the
  // multi-tenant rules in CLAUDE.md.
  await prisma.telegramChannel.deleteMany({ where: { orgId } });

  revalidatePath("/integrations");
  return { ok: true, message: "Telegram disconnected." };
}
