"use server";

import { redirect } from "next/navigation";

/**
 * Demo sign-in Server Action.
 * Redirects to the login page with ?demo=1, which triggers the client-side
 * signIn() call via next-auth/react. This avoids the Server Action module
 * isolation issue where PrismaNeon (WebSocket Pool) creates a fresh connection
 * that is immediately closed by Neon before the first query completes.
 */
export async function demoSignIn() {
  redirect("/login?demo=1");
}
