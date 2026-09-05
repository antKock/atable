import * as Sentry from "@sentry/nextjs";

// No-op when the DSN env var is absent (local dev, CI).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Vercel pose VERCEL_ENV ; en auto-hébergement (Docker) on pose
  // SENTRY_ENVIRONMENT explicitement (production / staging).
  environment:
    process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "development",
  // Errors only — no performance tracing, keeps the free tier quiet.
  tracesSampleRate: 0,
});
