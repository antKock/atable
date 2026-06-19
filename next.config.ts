import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Build identifier baked into both the client bundle and the /api/version
// response. A stale WebView (or PWA) compares its own frozen value against the
// live one to detect that a new deployment shipped — see VersionWatcher.
// Prefer the git SHA (set on Vercel git deploys); fall back to a build-time
// timestamp so a fresh id is still produced for CLI / non-git builds.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `t${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  images: {
    // Serve images directly (no Vercel Image Optimization) → 0 transformations.
    // Safe now that sources are web-weight: generated images are WebP and
    // uploads are resized/compressed client-side. All next/image usage is
    // recipe photos, so this has no collateral. Supersedes the width/format
    // settings below (kept as a fallback if this is ever reverted).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.themealdb.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
    // Cap the width buckets: each unique (source × width × format) is a Vercel
    // "Image Optimization transformation". Defaults expose 8 deviceSizes +
    // 8 imageSizes → a single recipe photo can be transformed at many widths.
    // Trim to what the layout actually needs (hero ~672/100vw retina; cards
    // ~256-384) to cut the transformation count.
    deviceSizes: [640, 828, 1080],
    imageSizes: [256, 384],
    formats: ["image/webp"],
    // Long cache so optimized variants aren't regenerated (reduces cache writes).
    minimumCacheTTL: 2678400, // 31 days
  },
  // Serve the Apple App Site Association from the well-known path via the API
  // route (guarantees application/json + lets it read APPLE_APP_ID at runtime).
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/aasa",
      },
      {
        source: "/.well-known/assetlinks.json",
        destination: "/api/assetlinks",
      },
    ];
  },
};

// Source maps are only uploaded when SENTRY_AUTH_TOKEN is present (Vercel);
// everywhere else this wrapper is inert.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
});
