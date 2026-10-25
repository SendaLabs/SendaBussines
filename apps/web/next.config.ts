import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@senda/shared"],
  cacheComponents: true,
  async rewrites() {
    return [
      {
        source: "/senda-api/:path*",
        destination: "http://127.0.0.1:4000/:path*",
      },
    ];
  },
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
