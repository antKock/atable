import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Après Sentry (les problèmes remontent en événements) ; un rapport, jamais
    // un blocage du démarrage. Import dynamique : zod reste hors du bundle edge.
    const { reportEnvIssues } = await import("./lib/env-check");
    reportEnvIssues();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures unhandled errors from route handlers and server components.
export const onRequestError = Sentry.captureRequestError;
