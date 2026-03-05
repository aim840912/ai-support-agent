import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { z } from "zod";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";

// 5 failed login attempts per IP + email per 15 minutes
const loginLimiter = createRateLimiter({ limit: 5, window: "15m" });

const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt", // Credentials provider requires JWT strategy
    maxAge: 7 * 24 * 60 * 60,  // 7 days (reduced from NextAuth default of 30 days)
    updateAge: 24 * 60 * 60,   // Refresh token once per day
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes — no auth required
      const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
      const publicPrefixes = ["/widget", "/api/auth", "/api/widget", "/api/verify-email", "/api/forgot-password", "/api/reset-password"];

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
        token.id = user.id;
        token.orgId = (user as { orgId?: string }).orgId;
        token.role = (user as { role?: string }).role;
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
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
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

        if (!user || !user.password) return null;

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
        };
      },
    }),
  ],
};
