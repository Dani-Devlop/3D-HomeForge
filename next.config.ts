import type { NextConfig } from "next";

/**
 * Two build modes:
 *  - default:      standalone server build used by the dev sandbox / VPS.
 *  - NEXT_EXPORT=1: fully static export for GitHub Pages, served under
 *    NEXT_PUBLIC_BASE_PATH (defaults to /3D-HomeForge). API routes are removed
 *    during that build and NEXT_PUBLIC_DEMO_MODE=1 routes all calls to the
 *    localStorage-backed demo backend.
 */
const isExport = process.env.NEXT_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isExport ? "/3D-HomeForge" : "");

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export" as const,
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
        distDir: "export-dist",
      }
    : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
