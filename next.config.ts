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
    /*
     * A Server Action fired with no connection stays pending and runs once the
     * network returns, instead of throwing. That covers the case this app
     * actually hits: a tap on the check-in button in a basement gym.
     *
     * It is in-memory and lives only as long as the page, which is what we want
     * here. A check-in queued to disk could surface hours later and record a
     * visit that started long before it was accepted, and the server has no way
     * to tell a stale GPS fix from a live one.
     *
     * Cache Components is deliberately not enabled alongside it: that changes
     * the rendering model, and the retry behaviour does not depend on it.
     */
    useOffline: true,
  },
};

export default nextConfig;
