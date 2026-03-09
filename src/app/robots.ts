import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-support-agent-tau.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: [
          "/overview",
          "/analytics",
          "/conversations",
          "/knowledge-base",
          "/orders",
          "/products",
          "/settings",
          "/tickets",
          "/playground",
          "/api/",
          "/widget/",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
