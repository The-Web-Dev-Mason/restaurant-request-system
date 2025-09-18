import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Other config options...

  typescript: {
    // ✅ build even if there are type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // ✅ build even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;