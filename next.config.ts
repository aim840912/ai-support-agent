import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse is CJS-only, must run in Node.js runtime (not Edge)
  // @neondatabase/serverless uses WebSocket internals that Turbopack cannot
  // bundle into worker processes — forcing native Node.js require() prevents
  // worker crashes during auth module initialization.
  serverExternalPackages: ["pdf-parse", "@neondatabase/serverless"],

  async headers() {
    return [
      {
        // Apply to all routes except widget (widget needs to be embeddable via iframe)
        source: "/((?!widget).*)",
        headers: [
          // Prevents clickjacking — disallows this page from being embedded in an iframe
          { key: "X-Frame-Options", value: "DENY" },
          // Prevents MIME-type sniffing — browser must respect declared Content-Type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits referrer info sent to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disables unused browser features (camera, mic, geolocation)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Enforces HTTPS for 2 years, including subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Content Security Policy — start permissive, tighten incrementally.
          // unsafe-inline/unsafe-eval required for Next.js SSR hydration scripts and
          // Tailwind dynamic styles. Tighten by replacing with nonce-based CSP once
          // Next.js nonce support is fully stable.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // Widget is intentionally embeddable via iframe — skip X-Frame-Options
        // but still protect against MIME sniffing.
        // no-referrer prevents API keys in the URL path from leaking via Referer
        // header when users click external links inside the widget chat.
        source: "/widget/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https:",
              "frame-ancestors *",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
