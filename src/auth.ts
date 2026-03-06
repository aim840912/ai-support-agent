import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

type NextAuthInstance = ReturnType<typeof NextAuth>;

/**
 * Build a PrismaAdapter that auto-creates an Organization for OAuth sign-ups.
 *
 * Problem: OAuth users bypass /api/register, so the normal org-creation
 * transaction never runs → `User.orgId` would violate NOT NULL.
 *
 * Solution: Override `createUser` to wrap org + user creation in a
 * Prisma transaction, matching the flow in /api/register.
 *
 * NOTE: Called lazily on first request (not at module init) to prevent
 * Turbopack worker process crashes. Calling NextAuth() + PrismaAdapter()
 * at module top level causes the worker to crash during initialization.
 */
function buildAdapter() {
  const adapter = PrismaAdapter(prisma);

  // Override createUser so OAuth sign-ups auto-create an Organization.
  // We use tx.user.create directly (instead of delegating to the original
  // adapter method) because we need to inject orgId, which the base adapter
  // does not know about.
  adapter.createUser = async (data) => {
    return prisma.$transaction(async (tx) => {
      const rawApiKey = generateApiKey();
      const org = await tx.organization.create({
        data: {
          name: (data.name ?? data.email?.split("@")[0] ?? "My Organization") + "'s Org",
          apiKey: rawApiKey,
          apiKeyHash: hashApiKey(rawApiKey),
        },
      });

      return tx.user.create({
        data: {
          email: data.email!,
          name: data.name ?? null,
          image: (data as { image?: string }).image ?? null,
          // OAuth providers are trusted identity sources — treat their users
          // as already verified. Without this, GitHub OAuth (which doesn't
          // always return email_verified) could leave users with null
          // emailVerified and unable to access gated features.
          emailVerified: data.emailVerified ?? new Date(),
          orgId: org.id,
          role: "owner",
        },
      });
    });
  };

  return adapter;
}

// Lazy singleton — NextAuth() and PrismaAdapter() are initialized on the first
// request, NOT at module load time. Turbopack spawns isolated worker processes
// for API route modules; calling NextAuth() during module initialization causes
// those workers to crash with "Jest worker encountered child process exceptions".
let _instance: NextAuthInstance | null = null;

function getInstance(): NextAuthInstance {
  if (!_instance) {
    _instance = NextAuth({ adapter: buildAdapter(), ...authConfig });
  }
  return _instance;
}

// Each export is a thin wrapper that triggers lazy initialization on first call.
// ESM destructuring (e.g. `const { GET, POST } = handlers`) captures the wrapper
// function at import time but only invokes getInstance() when the request arrives.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = ((...args: any[]) => getInstance().auth(...args)) as NextAuthInstance["auth"];

export const handlers: NextAuthInstance["handlers"] = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GET: (...args: any[]) => getInstance().handlers.GET(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  POST: (...args: any[]) => getInstance().handlers.POST(...args),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn = ((...args: any[]) => getInstance().signIn(...args)) as NextAuthInstance["signIn"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut = ((...args: any[]) => getInstance().signOut(...args)) as NextAuthInstance["signOut"];
