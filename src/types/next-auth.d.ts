import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: string;
      isDemo?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    orgId?: string;
    role?: string;
    isDemo?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string;
    role?: string;
    rememberMe?: boolean;
    loginAt?: number; // Unix timestamp (seconds)
    isDemo?: boolean;
  }
}
