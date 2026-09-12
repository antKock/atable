import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting (including the Capacitor WebViews, where
// errors are otherwise invisible). No-op when the DSN env var is absent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Inliné au build : NEXT_PUBLIC_SENTRY_ENVIRONMENT est passé en build-arg
  // par le Dockerfile (production / staging).
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
  tracesSampleRate: 0,
  // Tag d'hébergement (`runtime:vps`, posé par le Dockerfile) : conservé pour
  // les recherches et alertes Sentry qui filtrent dessus.
  initialScope: { tags: { runtime: process.env.NEXT_PUBLIC_SENTRY_RUNTIME ?? "local" } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
