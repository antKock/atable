import * as Sentry from "@sentry/nextjs";

// Runtime edge (aucune route edge aujourd'hui : le proxy tourne sur Node).
// No-op when the DSN env var is absent (local dev, CI).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Vercel pose VERCEL_ENV ; en auto-hébergement (Docker) on pose
  // SENTRY_ENVIRONMENT explicitement (production / staging).
  environment:
    process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  // Distingue l'hébergement (vercel / vps) pendant la migration et après :
  // filtre `runtime:vps` dans Sentry. Posé par le Dockerfile pour l'image.
  initialScope: { tags: { runtime: process.env.SENTRY_RUNTIME ?? "vercel" } },
});
