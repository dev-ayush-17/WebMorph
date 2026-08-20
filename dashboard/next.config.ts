import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly set turbopack root to this directory to avoid false lockfile
  // detection warnings in a monorepo (parent workspace has its own package-lock.json)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
