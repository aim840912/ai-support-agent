import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

/**
 * Build a PrismaAdapter that auto-creates an Organization for OAuth sign-ups.
 *
 * Problem: OAuth users bypass /api/register, so the normal org-creation
 * transaction never runs → `User.orgId` would violate NOT NULL.
 *
 * Solution: Override `createUser` to wrap org + user creation in a
 * Prisma transaction, matching the flow in /api/register.
 */
function buildAdapter() {
  const adapter = PrismaAdapter(prisma);

  // Override createUser so OAuth sign-ups auto-create an Organization.
  // We use tx.user.create directly (instead of delegating to the original
  // adapter method) because we need to inject orgId, which the base adapter
  // does not know about.
  adapter.createUser = async (data) => {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: (data.name ?? data.email?.split("@")[0] ?? "My Organization") + "'s Org",
        },
      });

      return tx.user.create({
        data: {
          email: data.email!,
          name: data.name ?? null,
          image: (data as { image?: string }).image ?? null,
          emailVerified: data.emailVerified ?? null,
          orgId: org.id,
          role: "owner",
        },
      });
    });
  };

  return adapter;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: buildAdapter(),
  ...authConfig,
});
