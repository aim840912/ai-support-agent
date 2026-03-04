import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

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
