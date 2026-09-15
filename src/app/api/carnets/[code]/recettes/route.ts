import { NextRequest, NextResponse } from "next/server";
import { resolveInviteCode } from "@/lib/auth/invite-code";
import { isBearerAuthorized } from "@/lib/cron-auth";
import { ensureShareToken } from "@/lib/db/share-token";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { getRequestOrigin } from "@/lib/request-origin";
import { JoinCodeSchema } from "@/lib/schemas/household";
import { buildShareUrl } from "@/lib/share-url";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

// GET /api/carnets/[code]/recettes — lecture d'un carnet par l'app Bien.
//
// Le carnet est désigné par son code membre (WORD-NNNN) ; l'appel porte le
// secret partagé `BIEN_API_SECRET` en Bearer (préfixe public côté proxy, comme
// /api/cron/, jamais anonyme : sans secret configuré, tout est refusé). Chaque
// recette reçoit son jeton de partage s'il manque, pour que Bien puisse lier
// vers /r/<token>. Bien lit titre, photo, lien, ingrédients (texte, une ligne
// par ingrédient), parts et temps ; tout le reste vit chez lui.
export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!isBearerAuthorized(request.headers.get("authorization"), process.env.BIEN_API_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const parsed = JoinCodeSchema.safeParse(code);
  if (!parsed.success) return NextResponse.json({ error: "Code invalide" }, { status: 400 });

  const supabase = createServerClient();
  const carnet = await resolveInviteCode(supabase, parsed.data);
  if (!carnet || carnet.role !== "member")
    return NextResponse.json({ error: "Carnet inconnu" }, { status: 404 });

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, ingredients, servings, prep_time, cook_time, complexity, photo_url, generated_image_url, share_token, updated_at",
    )
    .eq("household_id", carnet.householdId)
    .order("title", { ascending: true });
  if (error) throw error;

  const origin = getRequestOrigin(request);
  const recettes = [];
  for (const r of data ?? []) {
    const token = await ensureShareToken(supabase, r.id, carnet.householdId, r.share_token);
    recettes.push({
      id: r.id,
      titre: r.title,
      ingredients: r.ingredients,
      parts: r.servings,
      preparation: r.prep_time,
      cuisson: r.cook_time,
      complexite: r.complexity,
      image: r.photo_url ?? r.generated_image_url,
      lien: buildShareUrl(origin, token, DEFAULT_LOCALE),
      majLe: r.updated_at,
    });
  }
  return NextResponse.json({
    carnet: { id: carnet.householdId, nom: carnet.householdName },
    recettes,
  });
}
