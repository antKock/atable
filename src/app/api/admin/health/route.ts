import { NextRequest, NextResponse } from "next/server";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { rejectUnlessAdmin } from "@/lib/ops/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Veilleur ops (#27) : santé de l'app telle que la section Santé la calcule
// (une seule source de vérité pour les seuils). Interrogée une fois par jour par
// scripts/vps/watch.sh, qui alerte Sentry pour chaque voyant au rouge. Pas de
// HTTP 500 quand un voyant est rouge : le corps porte l'état, le statut reste 200
// (un 500 ici serait compté par… le veilleur Traefik).
export async function GET(request: NextRequest) {
  const denied = rejectUnlessAdmin(request);
  if (denied) return denied;
  const { data, timings, totalMs } = await getDashboardV3();
  const h = data.overview.health;
  return NextResponse.json({
    ok: h.ok,
    checkedAt: new Date().toISOString(),
    checks: {
      pipeline: h.pipeline,
      crons: h.crons,
      demo: h.demo,
      backup: h.backup,
      edge: h.edge,
      instagram: h.instagram,
      apify: h.apify,
    },
    // Mesure : durée de chaque lecture de loadRawV3 (13 en parallèle, la plus
    // lente d'abord) et durée totale — pour cibler l'optimisation du dashboard.
    timings: { totalMs, reads: timings },
  });
}
