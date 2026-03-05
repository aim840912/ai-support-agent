import { z } from "zod";

/**
 * Shared password validation schema.
 *
 * Enforces minimum security requirements:
 *   - At least 8 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *
 * Apply this schema in all three places that accept passwords:
 * - /api/register
 * - /api/reset-password
 * - auth.config.ts Credentials authorize (for login validation)
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");
