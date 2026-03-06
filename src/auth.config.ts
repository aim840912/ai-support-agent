import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { z } from "zod";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";

// 5 failed login attempts per IP + email per 15 minutes
const loginLimiter = createRateLimiter({ limit: 5, window: "15m" });

// Login only validates non-empty — password strength is enforced at write time
// (register / reset-password). Applying passwordSchema here would lock out
// existing users whose passwords pre-date the strong-password policy.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.enum(["true", "false"]).optional(), // NextAuth Credentials passes values as strings
});

// Pre-hashed dummy value used for constant-time bcrypt when the user doesn't
// exist, preventing timing-based email enumeration.
// Generated with: bcrypt.hash("dummy-password-for-timing", 12)
const DUMMY_HASH =
  "$2a$12$LJ3m4ys3Tl0H2I14y0g.aOSghlp58bpMksFv/4KE2GI/G0mfqxgMq";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt", // Credentials provider requires JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 days (cookie lifetime — actual expiry enforced in jwt callback)
    updateAge: 24 * 60 * 60,   // Refresh token once per day
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes — no auth required
      const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
      const publicPrefixes = ["/widget", "/api/auth", "/api/widget", "/api/register", "/api/verify-email", "/api/forgot-password", "/api/reset-password"];

      const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
      const isPublicPrefix = publicPrefixes.some((prefix) =>
        nextUrl.pathname.startsWith(prefix)
      );

      if (isPublicRoute || isPublicPrefix) return true;

      // All other routes require authentication
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        // First sign-in: persist rememberMe preference and login timestamp
        token.id = user.id;
        token.orgId = (user as { orgId?: string }).orgId;
        token.role = (user as { role?: string }).role;
        token.rememberMe = (user as { rememberMe?: boolean }).rememberMe ?? true; // OAuth defaults to remembered
        token.loginAt = Math.floor(Date.now() / 1000);
      }

      // Every subsequent request: invalidate short-lived sessions after 1 day
      const SHORT_MAX_AGE = 24 * 60 * 60; // 1 day in seconds
      if (!token.rememberMe && token.loginAt) {
        const elapsed = Math.floor(Date.now() / 1000) - (token.loginAt as number);
        if (elapsed > SHORT_MAX_AGE) {
          return {}; // Empty token forces NextAuth to treat session as invalid
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.orgId = token.orgId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Rate limit by IP + email to prevent both brute force and credential stuffing
        if (request) {
          const ip = getClientIp(request);
          const rl = await checkRateLimit(loginLimiter, `login:${ip}:${email}`);
          if (!rl.success) {
            throw new Error("Too many login attempts. Please try again later.");
          }
        }

        // Dynamic import to avoid Edge Runtime bundling Node.js-only modules
        const { prisma } = await import("@/lib/db");
        const bcrypt = await import("bcryptjs");

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            orgId: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user || !user.password) {
          // Always run bcrypt even when user doesn't exist — eliminates the
          // ~200 ms timing gap that would reveal whether an email is registered.
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // Require email verification before allowing login
        if (!user.emailVerified) {
          throw new Error("Please verify your email address before logging in.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: user.orgId,
          role: user.role,
          rememberMe: parsed.data.rememberMe === "true",
        };
      },
    }),
  ],
};
