/**
 * Deployment identifier frozen into this build (see next.config.ts).
 *
 * The same value is inlined into the client bundle and read by the server in
 * /api/version. Because each deployment carries its own value, a stale client
 * can detect that a newer build is live by comparing the two.
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
