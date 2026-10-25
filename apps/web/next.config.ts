import type { NextConfig } from "next";

function apiProxyOrigin(): string {
  const configured = process.env.API_URL?.trim().replace(/\/$/, "");
  return configured && configured.length > 0 ? configured : "http://127.0.0.1:4000";
}

const nextConfig: NextConfig = {
  transpilePackages: ["@senda/shared"],
  cacheComponents: true,
  async rewrites() {
    return [
      {
        source: "/senda-api/:path*",
        destination: `${apiProxyOrigin()}/:path*`,
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
