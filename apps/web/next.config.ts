import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The shared package ships TypeScript source.
  transpilePackages: ["@fiscallm/shared"],
  // The optimizer route (/_next/image) is not reachable behind the
  // multi-service rewrites in vercel.json; serve images as they are.
  images: { unoptimized: true },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
