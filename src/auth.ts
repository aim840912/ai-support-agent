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

  const originalCreateUser = adapter.createUser!.bind(adapter);

  adapter.createUser = async (data) => {
    // Check if org already exists for this email domain (nice-to-have)
    // For now: always create a new personal org on first OAuth sign-in
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: (data.name ?? data.email?.split("@")[0] ?? "My Organization") + "'s Org",
        },
      });

      // Call the original adapter createUser with the orgId injected
      // PrismaAdapter expects the Prisma User shape — we add orgId here
      const user = await tx.user.create({
        data: {
          email: data.email!,
          name: data.name ?? null,
          image: (data as { image?: string }).image ?? null,
          emailVerified: data.emailVerified ?? null,
          orgId: org.id,
          role: "owner",
        },
      });

      return user;
    });
  };

  // Silence TypeScript — originalCreateUser is captured but the override above
  // replaces it; keeping this reference prevents the "unused variable" lint error.
  void originalCreateUser;

  return adapter;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: buildAdapter(),
  ...authConfig,
});
