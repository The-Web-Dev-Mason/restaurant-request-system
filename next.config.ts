import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other config options here */

  typescript: {
    // ✅ build even if there are type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
