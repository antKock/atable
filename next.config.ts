import type { NextConfig } from "next";

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
  },
  // Serve the Apple App Site Association from the well-known path via the API
  // route (guarantees application/json + lets it read APPLE_APP_ID at runtime).
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/aasa",
      },
    ];
  },
};

export default nextConfig;
