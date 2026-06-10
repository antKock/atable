import * as Sentry from "@sentry/nextjs";

// No-op when the DSN env var is absent (local dev, CI).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  // Errors only — no performance tracing, keeps the free tier quiet.
  tracesSampleRate: 0,
});
