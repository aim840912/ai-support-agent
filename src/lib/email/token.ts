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
export async function createAndStoreToken(
  identifier: string,
  ttlMs: number
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs);

  // One token per identifier at a time
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return token;
}

/** Resolves the base URL for constructing email links. */
export function getBaseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}
