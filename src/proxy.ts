import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16: "proxy" replaces "middleware". Named export must be a simple identifier.
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - widget/embed.js (publicly embeddable widget script)
     * - public assets (png, jpg, svg, etc.)
     *
     * Auth decisions (public vs protected) are made in authConfig.authorized callback.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|widget/embed\\.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
