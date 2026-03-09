"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * Thin client-side wrapper around NextAuth's SessionProvider.
 *
 * Kept in its own file so the root layout (a Server Component) can import
 * it without needing a 'use client' directive at the layout level.
 *
 * Required by any component that calls useSession() — e.g. OrgSwitcher.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
