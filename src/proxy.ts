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
     * - .well-known/*  (browser/agent probes, e.g. Chrome DevTools'
     *                   appspecific/com.chrome.devtools.json — redirecting
     *                   these to /login makes DevTools retry in a loop)
     * - public assets (png, jpg, svg, etc.)
     *
     * Auth decisions (public vs protected) are made in authConfig.authorized callback.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|widget/embed\\.js|\\.well-known|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
