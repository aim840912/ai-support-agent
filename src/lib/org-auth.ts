import { prisma } from "@/lib/db";
import { hashApiKey } from "@/lib/api-key";
import { logError } from "@/lib/error-logger";

/**
 * Resolving a machine credential to an organization.
 *
 * Kept out of api-key.ts so that file stays pure crypto with no database
 * dependency — its tests need no mocks, and that is worth preserving.
 */

export type ResolvedOrg = {
  orgId: string;
  plan: string;
  /** IntegrationKey id, or null for the widget key which belongs to the org itself. */
  keyId: string | null;
  source: "widget" | "integration";
};

export type ResolvedWidgetOrg = ResolvedOrg & {
  customSystemPrompt: string | null;
};

/**
 * The lookup condition for a widget key, shared by every caller.
 *
 * The OR is the part worth centralising: organizations created before the hash
 * migration still have apiKeyHash = null and authenticate on the raw column, so
 * a findUnique on the hash alone would lock them out. That is easy to
 * "simplify" away in one copy and not the other.
 */
export function widgetKeyWhere(rawKey: string) {
  const keyHash = hashApiKey(rawKey);
  return { OR: [{ apiKeyHash: keyHash }, { apiKeyHash: null, apiKey: rawKey }] };
}

/** Resolves the public embed key printed into the customer's own web page. */
export async function resolveOrgByWidgetKey(rawKey: string): Promise<ResolvedWidgetOrg | null> {
  if (!rawKey) return null;

  const org = await prisma.organization.findFirst({
    where: widgetKeyWhere(rawKey),
    select: {
      id: true,
      plan: true,
      agentSettings: { select: { systemPrompt: true } },
    },
  });
  if (!org) return null;

  return {
    orgId: org.id,
    plan: org.plan,
    keyId: null,
    source: "widget",
    customSystemPrompt: org.agentSettings?.systemPrompt ?? null,
  };
}

const LAST_USED_THROTTLE_MS = 60_000;

/**
 * A credential issued for machine access (MCP clients, automation).
 *
 * Deliberately a separate function rather than a flag on the widget lookup.
 * They read different tables and have different revocation semantics, and
 * merging them would reopen exactly the hole this table exists to close: the
 * widget key is public — it ships inside the customer's HTML — while these
 * tools read orders and create tickets.
 */
export async function resolveOrgByIntegrationKey(rawKey: string): Promise<ResolvedOrg | null> {
  if (!rawKey) return null;

  const key = await prisma.integrationKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    select: {
      id: true,
      orgId: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      org: { select: { plan: true } },
    },
  });

  if (!key || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;

  // Throttled and unawaited: a write on every request would double the cost of
  // a tool call for a field only used to show "last seen" in the dashboard.
  const stale = !key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
  if (stale) {
    void prisma.integrationKey
      .updateMany({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch((error) => logError("[org-auth] lastUsedAt", error));
  }

  return { orgId: key.orgId, plan: key.org.plan, keyId: key.id, source: "integration" };
}
