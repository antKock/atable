import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting (including the Capacitor WebViews, where
// errors are otherwise invisible). No-op when the DSN env var is absent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Inliné au build : NEXT_PUBLIC_VERCEL_ENV sur Vercel, NEXT_PUBLIC_SENTRY_ENVIRONMENT
  // passé en build-arg par le Dockerfile (auto-hébergement).
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    "development",
  tracesSampleRate: 0,
  // Distingue l'hébergement (vercel / vps) pendant la migration et après :
  // filtre `runtime:vps` dans Sentry. Posé par le Dockerfile pour l'image.
  initialScope: { tags: { runtime: process.env.NEXT_PUBLIC_SENTRY_RUNTIME ?? "vercel" } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
