import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * Generates a cryptographically random token, replaces any existing token
 * for the given identifier, and persists the new one.
 *
 * @param identifier - The lookup key (email for verification, "reset:<email>" for password reset)
 * @param ttlMs      - Token lifetime in milliseconds
 * @returns          The raw hex token string
 */
export async function createAndStoreToken(identifier: string, ttlMs: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs);

  // One token per identifier at a time — batch transaction ensures atomicity:
  // if the process crashes between delete and create, no stale orphan token survives.
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token, expires } }),
  ]);

  return token;
}

/** Resolves the base URL for constructing email links. */
export function getBaseUrl(): string {
  const url = process.env.AUTH_URL;
  if (!url && process.env.NODE_ENV === "production") {
    // Warn loudly — email verification and password-reset links will point to
    // localhost:3000, making them unclickable for real users.
    console.warn(
      "[email] AUTH_URL is not set in production. Email links will use " +
        "http://localhost:3000 as base URL — set AUTH_URL to your deployment URL."
    );
  }
  return url ?? "http://localhost:3000";
}
