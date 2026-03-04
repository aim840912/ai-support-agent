import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse is CJS-only, must run in Node.js runtime (not Edge)
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
