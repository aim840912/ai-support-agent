import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// Next.js 16: "proxy" replaces "middleware". Named export must be a simple identifier.
export const proxy = auth;

export const config = {
  // Protect all dashboard routes
  matcher: [
    "/knowledge-base/:path*",
    "/conversations/:path*",
    "/playground/:path*",
    "/analytics/:path*",
    "/settings/:path*",
  ],
};
