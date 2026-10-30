import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@kept/likeness", "@kept/youcam", "@kept/shop", "@kept/agent", "@kept/mcp"],
  typescript: { tsconfigPath: "tsconfig.json" },
  images: { remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }] },
};

export default config;
