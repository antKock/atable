import * as Sentry from "@sentry/nextjs";

// No-op when the DSN env var is absent (local dev, CI).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // SENTRY_ENVIRONMENT est posé par Dokploy (production / staging).
  environment: process.env.SENTRY_ENVIRONMENT ?? "development",
  // Errors only — no performance tracing, keeps the free tier quiet.
  tracesSampleRate: 0,
  // Tag d'hébergement (`runtime:vps`, posé par le Dockerfile) : conservé pour
  // les recherches et alertes Sentry qui filtrent dessus.
  initialScope: { tags: { runtime: process.env.SENTRY_RUNTIME ?? "local" } },
});
