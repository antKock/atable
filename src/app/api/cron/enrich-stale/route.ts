import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isCronAuthorized } from "@/lib/cron-auth";
import { enrichStaleRecipes } from "@/lib/enrichment/stale";

// Ramassage des enrichissements perdus (recettes `pending` depuis > 1 h, cf.
// lib/enrichment/stale.ts). Même contrat que les autres crons : GET +
// `Authorization: Bearer $CRON_SECRET`, appelé toutes les heures par la
// crontab du VPS (bootstrap.sh). Pas de moniteur Sentry Crons : un seul seat
// dans le plan, pris par demo-reset ; un échec remonte par captureException.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await enrichStaleRecipes());
  } catch (err) {
    Sentry.captureException(err);
    console.error("[cron/enrich-stale] failed:", err);
    return NextResponse.json({ error: "Enrich-stale failed" }, { status: 500 });
  }
}
