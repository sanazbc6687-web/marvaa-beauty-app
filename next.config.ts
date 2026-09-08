import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The project currently has no ESLint package; type checking remains a separate
  // required build gate and lint is run explicitly when the toolchain is present.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
