import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Fly.io Docker image.
  output: "standalone",
};

export default nextConfig;
