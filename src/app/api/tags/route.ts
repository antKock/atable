import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import {
  withOwnerAuth,
  resolveWriteHousehold,
  forbiddenResponse,
} from "@/lib/api/with-owner-auth";
import { householdIds, memberHouseholdIds } from "@/lib/auth/owner-context";
import { getT } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";

export const GET = withOwnerAuth(async (_request, _ctx, owner) => {
  const supabase = createServerClient();
  // Tags globaux (household_id NULL) + tags custom des foyers de l'owner. Sans
  // foyer, on ne garde que les globaux (pas de clause `in.()` dégénérée).
  const ids = householdIds(owner);
  const orClause =
    ids.length > 0
      ? `household_id.is.null,household_id.in.(${ids.join(",")})`
      : `household_id.is.null`;
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(orClause)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return NextResponse.json({ tags: data ?? [] });
});

// Messages localisés (revue 2026-09-12 : les messages zod bruts partaient en
// anglais dans le toast).
const buildCreateTagSchema = (t: Dictionary) =>
  z.object({
    name: z.string().trim().min(1, t.validation.tagNameRequired).max(50, t.validation.tagNameTooLong),
  });

export const POST = withOwnerAuth(async (request: NextRequest, _ctx, owner) => {
  const t = await getT();
  const body = await request.json().catch(() => null);
  const result = buildCreateTagSchema(t).safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 422 }
    );
  }

  // Un tag custom se crée dans un foyer où l'owner est MEMBRE. Le tag est saisi
  // dans le formulaire avant le choix du foyer de destination : on le rattache
  // au premier foyer membre (le tag reste résolu à l'affichage via recipe_tags,
  // quel que soit le foyer de la recette).
  const target = await resolveWriteHousehold(owner, undefined);
  const householdId =
    target instanceof NextResponse ? memberHouseholdIds(owner)[0] : target.householdId;
  if (!householdId) {
    return forbiddenResponse(t);
  }
  // Monde gelé : un tag custom d'un visiteur démo persisterait pour tous les
  // visiteurs suivants — refusé par la garde par défaut de withOwnerAuth.

  const supabase = createServerClient();
  const ids = householdIds(owner);

  // Check if tag with same name already exists (predefined or scoped to one of
  // the owner's households)
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, category")
    .or(`household_id.is.null,household_id.in.(${ids.join(",")})`)
    .ilike("name", result.data.name)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Create custom tag
  const { data, error } = await supabase
    .from("tags")
    .insert({
      name: result.data.name,
      is_predefined: false,
      household_id: householdId,
      category: null,
    })
    .select("id, name, category")
    .single();

  if (error) throw error;

  return NextResponse.json(data, { status: 201 });
});
