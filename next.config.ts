import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the app can be dockerised and moved
  // off Vercel without changing the build. Vercel ignores this setting.
  output: "standalone",
  serverExternalPackages: ["pg"],
  experimental: {
    // Avatar uploads are capped at 2 MB; the default action limit is 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
