import type { NextConfig } from "next";

const API_ORIGIN =
  process.env.API_ORIGIN ??
  (process.env.NODE_ENV === "production" ? "https://api-production-5de6.up.railway.app" : "http://localhost:8080");

const nextConfig: NextConfig = {
  transpilePackages: ["@aionix/shared"],
  poweredByHeader: false,
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.up.railway.app" },
      { protocol: "http", hostname: "localhost" },
    ],
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
