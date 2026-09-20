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
import { generateWebhookSecret } from "@/lib/webhook-signature";
import { deliverOnce, validateWebhookUrl } from "@/lib/webhooks/dispatch";
import { buildEvent, WEBHOOK_EVENTS } from "@/lib/webhooks/events";

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

// ─────────────────────────────────────────────────────────────────────────────
// Outbound webhooks
// ─────────────────────────────────────────────────────────────────────────────

const endpointSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Choose at least one event"),
  description: z.string().trim().max(200).optional(),
});

export type EndpointResult = { ok: boolean; message: string; secret?: string };

/**
 * Every mutation below re-reads the org from the session and scopes the write
 * to it with updateMany/deleteMany. Using update({ where: { id } }) would let
 * an admin of one org delete another org's endpoint by guessing a cuid — an
 * IDOR, and the first thing a reviewer looks for here.
 */
export async function createWebhookEndpoint(input: {
  url: string;
  events: string[];
  description?: string;
}): Promise<EndpointResult> {
  const { orgId } = await requireWriteAccess();

  const parsed = endpointSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const urlCheck = validateWebhookUrl(parsed.data.url);
  if (!urlCheck.ok) return { ok: false, message: urlCheck.reason };

  try {
    const secret = generateWebhookSecret();
    await prisma.webhookEndpoint.create({
      data: {
        orgId,
        url: parsed.data.url,
        events: parsed.data.events,
        description: parsed.data.description || null,
        secret,
      },
    });

    revalidatePath("/integrations");
    // The secret is returned once so it can be shown for copying; it stays
    // readable afterwards because the receiver needs it to verify signatures.
    return { ok: true, message: "Endpoint added.", secret };
  } catch (error) {
    logError("[integrations/createWebhookEndpoint]", error);
    return { ok: false, message: "Could not add the endpoint." };
  }
}

export async function setWebhookEndpointEnabled(
  id: string,
  enabled: boolean
): Promise<EndpointResult> {
  const { orgId } = await requireWriteAccess();

  try {
    const { count } = await prisma.webhookEndpoint.updateMany({
      where: { id, orgId },
      // Re-enabling clears the failure streak, otherwise a single further
      // failure would immediately switch it off again.
      data: enabled ? { enabled: true, failureCount: 0 } : { enabled: false },
    });
    if (count === 0) return { ok: false, message: "Endpoint not found." };

    revalidatePath("/integrations");
    return { ok: true, message: enabled ? "Endpoint enabled." : "Endpoint paused." };
  } catch (error) {
    logError("[integrations/setWebhookEndpointEnabled]", error);
    return { ok: false, message: "Could not update the endpoint." };
  }
}

export async function deleteWebhookEndpoint(id: string): Promise<EndpointResult> {
  const { orgId } = await requireWriteAccess();

  try {
    const { count } = await prisma.webhookEndpoint.deleteMany({ where: { id, orgId } });
    if (count === 0) return { ok: false, message: "Endpoint not found." };

    revalidatePath("/integrations");
    return { ok: true, message: "Endpoint removed." };
  } catch (error) {
    logError("[integrations/deleteWebhookEndpoint]", error);
    return { ok: false, message: "Could not remove the endpoint." };
  }
}

export async function rotateWebhookSecret(id: string): Promise<EndpointResult> {
  const { orgId } = await requireWriteAccess();

  try {
    const secret = generateWebhookSecret();
    const { count } = await prisma.webhookEndpoint.updateMany({
      where: { id, orgId },
      data: { secret },
    });
    if (count === 0) return { ok: false, message: "Endpoint not found." };

    revalidatePath("/integrations");
    return {
      ok: true,
      secret,
      message:
        "Secret rotated. Update it in the receiving tool — deliveries will fail until you do.",
    };
  } catch (error) {
    logError("[integrations/rotateWebhookSecret]", error);
    return { ok: false, message: "Could not rotate the secret." };
  }
}

export type TestDeliveryResult = {
  ok: boolean;
  message: string;
  statusCode?: number | null;
  durationMs?: number;
};

/**
 * Fires a representative event at one endpoint.
 *
 * Goes through the real deliverOnce, so what this proves is the actual
 * delivery path — headers, signature, timeout and all — rather than a
 * simulation of it.
 */
export async function sendTestWebhook(id: string): Promise<TestDeliveryResult> {
  const { orgId } = await requireWriteAccess();

  // findFirst scoped by orgId before doing anything with the row.
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id, orgId },
    select: { id: true, url: true, secret: true, orgId: true },
  });
  if (!endpoint) return { ok: false, message: "Endpoint not found." };

  const result = await deliverOnce(endpoint, buildEvent("ticket.created", orgId, SAMPLE_TICKET));
  revalidatePath("/integrations");

  return {
    ok: result.ok,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    message: result.ok
      ? `Delivered — HTTP ${result.statusCode} in ${result.durationMs}ms.`
      : (result.error ?? `Failed with HTTP ${result.statusCode ?? "no response"}.`),
  };
}

/** Obviously-fake values, so a test event is never mistaken for a real ticket. */
const SAMPLE_TICKET = {
  ticketId: "tkt_sample",
  ticketNumber: "TKT-SAMPLE",
  subject: "Test event from the Integrations page",
  description: "This is a sample payload. No ticket was created.",
  priority: "high",
  status: "open",
  slaHours: 4,
  orderNumber: "ORD-SAMPLE",
  source: "dashboard",
  createdAt: new Date().toISOString(),
  dashboardUrl: `${getPublicBaseUrl()}/tickets/tkt_sample`,
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP integration keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issuing a machine credential is a higher bar than configuring a channel.
 * Matches regenerateApiKey in the settings actions, which is owner-only for
 * the same reason.
 */
async function requireOwner() {
  const session = await auth();
  if (!session?.user?.orgId) throw new Error("Unauthorized");
  if (session.user.role !== "owner") throw new Error("Forbidden: owner only");
  if (isDemoUser(session.user.email)) {
    throw new Error("The demo account cannot issue integration keys");
  }
  return { orgId: session.user.orgId };
}

const MAX_KEYS_PER_ORG = 10;

const keyNameSchema = z
  .string()
  .trim()
  .min(1, "Give the key a name so you can tell them apart")
  .max(60, "Name must be 60 characters or fewer");

export type CreateKeyResult = {
  ok: boolean;
  message: string;
  /** Returned exactly once — only the hash is stored. */
  key?: string;
};

export async function createIntegrationKey(input: { name: string }): Promise<CreateKeyResult> {
  const { orgId } = await requireOwner();

  const parsed = keyNameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    const active = await prisma.integrationKey.count({ where: { orgId, revokedAt: null } });
    if (active >= MAX_KEYS_PER_ORG) {
      return {
        ok: false,
        message: `You already have ${MAX_KEYS_PER_ORG} active keys. Revoke one first.`,
      };
    }

    // mcp_ rather than sk_ so the two credential families are distinguishable
    // in logs at a glance.
    const raw = `mcp_${randomBytes(24).toString("base64url")}`;
    await prisma.integrationKey.create({
      data: {
        orgId,
        name: parsed.data,
        keyHash: hashApiKey(raw),
        keyPrefix: raw.slice(0, 12),
      },
    });

    revalidatePath("/integrations");
    return { ok: true, key: raw, message: "Key created. Copy it now — it is not shown again." };
  } catch (error) {
    logError("[integrations/createIntegrationKey]", error);
    return { ok: false, message: "Could not create the key." };
  }
}

export async function revokeIntegrationKey(id: string): Promise<{ ok: boolean; message: string }> {
  const { orgId } = await requireOwner();

  try {
    // Marked revoked rather than deleted, so the dashboard can still show that
    // a key existed and when it was last used.
    const { count } = await prisma.integrationKey.updateMany({
      where: { id, orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return { ok: false, message: "Key not found." };

    revalidatePath("/integrations");
    return { ok: true, message: "Key revoked. Clients using it will stop working immediately." };
  } catch (error) {
    logError("[integrations/revokeIntegrationKey]", error);
    return { ok: false, message: "Could not revoke the key." };
  }
}
