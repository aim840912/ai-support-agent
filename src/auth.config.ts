import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { z } from "zod";
import { createRateLimiter, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { Account, Profile, User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";

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
const DUMMY_HASH = "$2a$12$LJ3m4ys3Tl0H2I14y0g.aOSghlp58bpMksFv/4KE2GI/G0mfqxgMq";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt", // Credentials provider requires JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 days (cookie lifetime — actual expiry enforced in jwt callback)
    updateAge: 24 * 60 * 60, // Refresh token once per day
  },
  callbacks: {
    /**
     * Guard for allowDangerousEmailAccountLinking.
     *
     * Both OAuth providers have allowDangerousEmailAccountLinking: true so that
     * legitimate users can add Google/GitHub login to an existing account.
     * The risk: an attacker could create an OAuth account with a victim's email
     * on a compromised provider and auto-link into the victim's account.
     *
     * Mitigation: only allow auto-linking when the existing account has already
     * verified their email (emailVerified !== null). Unverified accounts cannot
     * be hijacked since they haven't proven ownership of the email address.
     *
     * For OAuth sign-ins: also require the provider to return email_verified=true
     * (Google always does; GitHub omits this field for some accounts but we treat
     * absence as unverified to be conservative).
     */
    async signIn({
      user,
      account,
      profile,
    }: {
      user: User | AdapterUser;
      account?: Account | null;
      profile?: Profile;
    }) {
      // Only applies to OAuth sign-ins — Credentials flow is handled in authorize()
      if (account?.type !== "oauth") return true;

      // Require the OAuth provider to confirm email ownership
      const providerVerified = profile?.email_verified === true;
      if (!providerVerified) return false;

      // If a credentials account already exists with this email, only allow
      // linking when that account has completed email verification.
      if (user?.email) {
        const { prisma } = await import("@/lib/db");
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { emailVerified: true },
        });
        // No existing user → new OAuth sign-up, always allowed
        if (!existing) return true;
        // Existing user → only allow OAuth link if email was already verified
        if (!existing.emailVerified) return false;
      }

      return true;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes — no auth required
      const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
      const publicPrefixes = [
        "/widget",
        "/api/auth",
        "/api/widget",
        "/api/register",
        "/api/verify-email",
        "/verify-email",
        "/api/forgot-password",
        "/api/reset-password",
        "/api/team/accept-invite",
        "/api/stripe/webhook", // Stripe server-to-server: no session cookie
      ];

      const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
      const isPublicPrefix = publicPrefixes.some((prefix) => nextUrl.pathname.startsWith(prefix));

      if (isPublicRoute || isPublicPrefix) return true;

      // All other routes require authentication
      return isLoggedIn;
    },
    async jwt({ token, user, trigger, session }) {
      const UPDATE_AGE_SEC = 24 * 60 * 60; // matches session.updateAge
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        // First sign-in: persist user claims.
        // Prefer activeOrgId (multi-org) over legacy orgId; fall back for
        // users who existed before the data migration ran.
        const resolvedOrgId =
          (user as { activeOrgId?: string | null }).activeOrgId ??
          (user as { orgId?: string }).orgId;

        token.id = user.id;
        token.orgId = resolvedOrgId;
        token.role = (user as { role?: string }).role; // preliminary — overwritten below from UserOrganization
        token.rememberMe = (user as { rememberMe?: boolean }).rememberMe ?? true; // OAuth defaults to remembered
        token.loginAt = now;
        token.isDemo = (user as { isDemo?: boolean }).isDemo ?? false;

        // Fetch passwordChangedAt + authoritative role from UserOrganization.
        // UserOrganization.role is the source of truth for role-per-org;
        // User.role is only kept as a legacy fallback (pre-migration users).
        const { prisma } = await import("@/lib/db");
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: {
            passwordChangedAt: true,
            organizations: resolvedOrgId
              ? { where: { orgId: resolvedOrgId }, select: { role: true }, take: 1 }
              : false,
          },
        });
        token.passwordChangedAt = dbUser?.passwordChangedAt
          ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
          : 0;
        token.passwordChangedAtCheckedAt = now;
        // Override with per-org role from UserOrganization when available
        const membership = Array.isArray(dbUser?.organizations)
          ? (dbUser.organizations as { role: string }[])[0]
          : undefined;
        if (membership?.role) {
          token.role = membership.role;
        }
      }

      // Handle immediate org-switch: the OrgSwitcher calls useSession().update()
      // with { activeOrgId } which triggers trigger === "update" here.
      // We validate membership before changing the token to prevent privilege escalation.
      if (trigger === "update" && (session as { activeOrgId?: string })?.activeOrgId) {
        const newOrgId = (session as { activeOrgId: string }).activeOrgId;
        const { prisma } = await import("@/lib/db");
        const membership = await prisma.userOrganization.findUnique({
          where: { userId_orgId: { userId: token.id as string, orgId: newOrgId } },
          select: { role: true },
        });
        if (membership) {
          token.orgId = newOrgId;
          token.role = membership.role;
        }
        // If no membership found, silently ignore — attacker cannot escalate by
        // passing an arbitrary orgId; the token stays on the current org.
        return token;
      }

      // Expire short-lived (non-remembered) sessions after 1 day
      const SHORT_MAX_AGE = 24 * 60 * 60; // 1 day in seconds
      if (!token.rememberMe && token.loginAt) {
        const elapsed = now - (token.loginAt as number);
        if (elapsed > SHORT_MAX_AGE) {
          return {}; // Empty token forces NextAuth to treat session as invalid
        }
      }

      // Refresh passwordChangedAt, role, and orgId every 24 h (matching updateAge).
      // Password change detection: forces re-login within one updateAge window.
      // Role/orgId refresh: ensures demoted/transferred users can't retain stale
      // permissions longer than 24 h without re-authenticating.
      const lastChecked = token.passwordChangedAtCheckedAt as number | undefined;
      if (token.id && (!lastChecked || now - lastChecked > UPDATE_AGE_SEC)) {
        const { prisma } = await import("@/lib/db");
        const currentOrgId = token.orgId as string | undefined;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            passwordChangedAt: true,
            activeOrgId: true,
            organizations: currentOrgId
              ? { where: { orgId: currentOrgId }, select: { role: true }, take: 1 }
              : false,
          },
        });
        token.passwordChangedAt = dbUser?.passwordChangedAt
          ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
          : 0;
        // Propagate fresh orgId from activeOrgId (multi-org) — handles org-switches
        // made server-side (e.g. accept-invite auto-switches active org).
        if (dbUser?.activeOrgId) {
          token.orgId = dbUser.activeOrgId;
        }
        // Propagate fresh role from UserOrganization
        const freshMembership = Array.isArray(dbUser?.organizations)
          ? (dbUser.organizations as { role: string }[])[0]
          : undefined;
        if (freshMembership?.role) {
          token.role = freshMembership.role;
        }
        token.passwordChangedAtCheckedAt = now;
      }

      // Invalidate sessions issued before a password change.
      // Uses the cached token value — no DB round-trip on the hot path.
      // Worst-case staleness: 24 h (acceptable; far better than the 30-day
      // window that existed before passwordChangedAt was cached in the token).
      if (token.iat && token.passwordChangedAt) {
        if ((token.iat as number) < (token.passwordChangedAt as number)) {
          return {}; // Token predates password change — force re-login
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.orgId = token.orgId as string;
        session.user.role = token.role as string;
        session.user.isDemo = (token.isDemo as boolean) ?? false;
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
        // Demo shortcut — bypasses password validation and email verification.
        // isDemo flag is only meaningful here on the server; it cannot grant access
        // to any account other than the seeded demo user.
        if (credentials?.isDemo === "true") {
          const { prisma } = await import("@/lib/db");
          const { DEMO_EMAIL } = await import("@/lib/demo");
          const user = await prisma.user.findUnique({
            where: { email: DEMO_EMAIL },
            select: {
              id: true,
              email: true,
              name: true,
              orgId: true,
              activeOrgId: true,
              role: true,
            },
          });
          if (!user) return null;
          return { ...user, rememberMe: false, isDemo: true };
        }

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
            activeOrgId: true, // Multi-org: prefer activeOrgId over legacy orgId
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
          activeOrgId: user.activeOrgId, // Passed to JWT callback for multi-org support
          role: user.role,
          rememberMe: parsed.data.rememberMe === "true",
        };
      },
    }),
  ],
};
