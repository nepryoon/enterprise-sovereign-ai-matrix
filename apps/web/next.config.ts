import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // No next/image usage: disable the optimisation endpoint (sharp/AVIF attack surface).
  images: { unoptimized: true },
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://api:8000";
    // fallback: applied only after filesystem and dynamic routes, so the streaming route handler in
    // app/api/v1/executions/[id]/stream wins over the generic (compressible) proxy.
    return { beforeFiles: [], afterFiles: [], fallback: [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
    ] };
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
