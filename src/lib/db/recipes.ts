import { NextResponse } from "next/server";
import type { DbClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db/types";
import type { TagJoin } from "@/lib/supabase/mappers";
import { householdIds, type OwnerContext } from "@/lib/auth/owner-context";
import { requireMember, assertNotDemoSeedMutation } from "@/lib/api/with-owner-auth";
import { getT } from "@/lib/i18n/server";

type RecipeRow = Tables<"recipes">;
export type RecipeColumn = keyof RecipeRow;

// Colonnes toujours lues : celles des gardes d'écriture (membre du foyer de
// la recette, seed démo intouchable).
const BASE_COLUMNS = ["id", "household_id", "is_seed"] as const;
type BaseColumn = (typeof BASE_COLUMNS)[number];

// Jointure tags, unique projection embarquée de l'app (mappers.ts).
const TAGS_EMBED = "recipe_tags(tag_id, tags(id, name, category))";

type LoadOptions<K extends RecipeColumn, All extends boolean, WithTags extends boolean> = {
  /** Colonnes supplémentaires à lire (noms vérifiés par le schéma généré). */
  columns?: readonly K[];
  /** Toute la ligne (`*`), pour les routes qui renvoient la recette entière. */
  all?: All;
  /** Ajoute la jointure `recipe_tags(tag_id, tags(…))`. */
  withTags?: WithTags;
  /**
   * Écriture : exige d'être MEMBRE du foyer de la recette (un invité est en
   * lecture seule) et refuse une recette SEED du foyer démo. Ordre des gardes,
   * commun à toutes les routes : 404 → membre (403) → démo (403).
   */
  write?: boolean;
};

type Loaded<
  K extends RecipeColumn,
  All extends boolean,
  WithTags extends boolean,
> = (All extends true ? RecipeRow : Pick<RecipeRow, BaseColumn | K>) &
  (WithTags extends true ? Required<TagJoin> : unknown);

/**
 * Charge une recette « scopée owner » : elle doit vivre dans l'un des foyers
 * de l'owner (membre OU invité), sinon 404 localisé. Renvoie `{ recipe }` ou
 * la réponse d'erreur à retourner telle quelle (revue 2026-09-12 : absorbe les
 * 7 copies « recette scopée + 404 » et les 4 copies du triplet de gardes).
 *
 * La projection est construite ici à partir de noms de colonnes typés (pas
 * d'une chaîne PostgREST libre : le parseur de types de postgrest-js sur une
 * chaîne générique faisait exploser `tsc`), et le type de retour en découle.
 */
export async function loadOwnedRecipe<
  K extends RecipeColumn = never,
  All extends boolean = false,
  WithTags extends boolean = false,
>(
  db: DbClient,
  id: string,
  owner: OwnerContext,
  options: LoadOptions<K, All, WithTags> = {},
): Promise<{ recipe: Loaded<K, All, WithTags> } | NextResponse> {
  const parts: string[] = options.all ? ["*"] : [...BASE_COLUMNS, ...(options.columns ?? [])];
  if (options.withTags) parts.push(TAGS_EMBED);
  const columns: string = parts.join(", ");

  const { data, error } = await db
    .from("recipes")
    .select(columns)
    .eq("id", id)
    .in("household_id", householdIds(owner))
    .single();

  if (error || !data) {
    const t = await getT();
    return NextResponse.json({ error: t.api.recipeNotFound }, { status: 404 });
  }
  // `select(string)` ne porte pas de type : la projection vient des options
  // ci-dessus, le cast est le seul point où la forme est affirmée.
  const recipe = data as unknown as Loaded<K, All, WithTags>;
  if (options.write) {
    const forbidden = await requireMember(owner, recipe.household_id);
    if (forbidden) return forbidden;
    const frozen = await assertNotDemoSeedMutation(owner, recipe);
    if (frozen) return frozen;
  }
  return { recipe };
}
