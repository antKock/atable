import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/api/body";
import { rejectUnlessAdmin } from "@/lib/ops/admin-auth";

// Veilleur ops (#27) : relevé quotidien des réponses 5xx vues par Traefik pour
// cet hôte (scripts/vps/watch.sh, toutes les 5 min, total du jour → upsert
// idempotent de stats_daily.traefik_5xx, migration 047).
const WatchSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  traefik5xx: z.number().int().min(0).max(1_000_000),
});

export async function POST(request: NextRequest) {
  const denied = rejectUnlessAdmin(request);
  if (denied) return denied;
  const parsed = await parseJsonBody(request, { schema: WatchSchema });
  if (parsed instanceof NextResponse) return parsed;
  const { day, traefik5xx } = parsed.data;

  const supabase = createServerClient();
  // Upsert par jour, colonnes fournies seulement (les autres compteurs de la
  // ligne ne bougent pas) — `ignoreDuplicates: false` = merge-duplicates.
  const { error } = await supabase
    .from("stats_daily")
    .upsert({ day, traefik_5xx: traefik5xx }, { onConflict: "day" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, day, traefik5xx });
}
