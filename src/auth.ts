import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "./auth.config";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

type NextAuthInstance = ReturnType<typeof NextAuth>;

// Lazy singleton — NextAuth() and PrismaAdapter() are initialized on the first
// request, NOT at module load time. Turbopack spawns isolated worker processes
// for API route modules; calling NextAuth() during module initialization causes
// those workers to crash with "Jest worker encountered child process exceptions".
//
// prisma is loaded via dynamic import inside getInstance() so that
// PrismaNeon / @neondatabase/serverless are never evaluated at module load time,
// preventing the worker crash chain:
//   auth.ts → db.ts → PrismaNeon → @neondatabase/serverless → CRASH
let _instance: NextAuthInstance | null = null;

async function getInstance(): Promise<NextAuthInstance> {
  if (!_instance) {
    // Dynamic import — prevents Turbopack from evaluating PrismaNeon /
    // @neondatabase/serverless during module initialization.
    const { prisma } = await import("@/lib/db");

    // Build adapter inline: PrismaAdapter with custom createUser that
    // auto-creates an Organization for OAuth sign-ups.
    //
    // Problem: OAuth users bypass /api/register, so the normal org-creation
    // transaction never runs → `User.orgId` would violate NOT NULL.
    //
    // Solution: Override `createUser` to wrap org + user creation in a
    // Prisma transaction, matching the flow in /api/register.
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

    _instance = NextAuth({
      adapter,
      ...authConfig,
      callbacks: {
        ...authConfig.callbacks,
        async jwt(params) {
          // 1. Run the base edge-safe callback from authConfig (extracts orgId
          //    from user when present, propagates it on subsequent requests).
          const baseResult = authConfig.callbacks?.jwt?.(params);
          const token =
            baseResult instanceof Promise ? await baseResult : (baseResult ?? params.token);

          // 2. DB fallback — only fires on sign-in (params.user present) when
          //    orgId is still missing. This handles the NextAuth v5 beta edge
          //    case where non-standard fields (orgId, role) are stripped from
          //    the OAuth adapter result before reaching this callback.
          //    Credentials flow is unaffected: authorize() explicitly returns
          //    orgId, so the base callback already sets it.
          if (params.user && !token.orgId && token.id) {
            // prisma captured from closure — same instance used throughout
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { orgId: true, role: true },
            });
            if (dbUser) {
              token.orgId = dbUser.orgId;
              token.role = dbUser.role;
            }
          }

          return token;
        },
      },
    });
  }
  return _instance;
}

// Each export is a thin wrapper that triggers lazy initialization on first call.
// ESM destructuring (e.g. `const { GET, POST } = handlers`) captures the wrapper
// function at import time but only invokes getInstance() when the request arrives.
//
// We use Parameters<...> (tuple type) instead of any[] to satisfy TS2556 —
// TypeScript requires a tuple type when spreading args into an overloaded function.
// The outer `as NextAuthInstance[...]` cast restores the full overloaded signature.

// `as unknown as` is required here: the async wrapper's inferred return type
// (Promise<NextMiddleware>) does not satisfy all overloads of NextAuthInstance["auth"]
// — in particular the synchronous Session|null overloads used by Server Components.
// At runtime the inner call still returns the correct type for each overload;
// the cast is purely a TypeScript structural limitation with wrapped overloaded functions.
export const auth = (async (...args: Parameters<NextAuthInstance["auth"]>) =>
  (await getInstance()).auth(...args)) as unknown as NextAuthInstance["auth"];

export const handlers: NextAuthInstance["handlers"] = {
  GET: (async (...args: Parameters<NextAuthInstance["handlers"]["GET"]>) =>
    (await getInstance()).handlers.GET(...args)) as NextAuthInstance["handlers"]["GET"],
  POST: (async (...args: Parameters<NextAuthInstance["handlers"]["POST"]>) =>
    (await getInstance()).handlers.POST(...args)) as NextAuthInstance["handlers"]["POST"],
};

export const signIn = (async (...args: Parameters<NextAuthInstance["signIn"]>) =>
  (await getInstance()).signIn(...args)) as NextAuthInstance["signIn"];

export const signOut = (async (...args: Parameters<NextAuthInstance["signOut"]>) =>
  (await getInstance()).signOut(...args)) as NextAuthInstance["signOut"];
