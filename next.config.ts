import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set BUILD_STANDALONE=1 to emit a self-contained server bundle for Docker.
  // It is off by default because `next start` refuses to serve a standalone
  // build, and Vercel ignores the setting either way.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["pg"],
  experimental: {
    // Avatar uploads are capped at 2 MB; the default action limit is 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
