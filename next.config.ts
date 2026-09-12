import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the app can be dockerised and moved
  // off Vercel without changing the build. Vercel ignores this setting.
  output: "standalone",
  serverExternalPackages: ["pg"],
};

export default nextConfig;
