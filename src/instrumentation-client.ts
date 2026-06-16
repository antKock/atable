import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting (including the Capacitor WebViews, where
// errors are otherwise invisible). No-op when the DSN env var is absent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
