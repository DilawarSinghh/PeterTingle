import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions are stable in Next.js 14+; no experimental flag needed.
  // Extend here for custom headers, rewrites, image domains, etc.
  // Pin workspace root — OneDrive parent dirs contain stray lockfiles that
  // confuse Next's root inference.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
