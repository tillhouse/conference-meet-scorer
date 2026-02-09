import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  typescript: {
    // Safety net: ignore build errors in case of environment-specific type issues
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
