import * as Sentry from "@sentry/nextjs";

// Covers the middleware (session verification, revocation checks).
// No-op when the DSN env var is absent (local dev, CI).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
});
