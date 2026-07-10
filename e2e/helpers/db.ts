import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnv } from "./env";

// Client service role sur le Supabase LOCAL : préparer/asserter l'état DB.
// Jamais d'appel réseau externe dans les tests.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const env = loadTestEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

export async function getHouseholdByJoinCode(joinCode: string) {
  const { data, error } = await db()
    .from("households")
    .select("id, name, join_code, is_demo")
    .eq("join_code", joinCode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecipeByTitle(householdId: string, title: string) {
  const { data, error } = await db()
    .from("recipes")
    .select("id, title, household_id, share_token")
    .eq("household_id", householdId)
    .eq("title", title)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Insertion directe d'une recette (raccourci de préparation d'état : la
 * caractérisation du flow de création UI vit dans recipe-manual.spec.ts).
 */
export async function insertRecipe(params: {
  householdId: string;
  title: string;
  seasons?: string[];
  cost?: string | null;
  tagName?: string;
}) {
  const { data: recipe, error } = await db()
    .from("recipes")
    .insert({
      household_id: params.householdId,
      title: params.title,
      ingredients: "Ingrédient A\nIngrédient B",
      steps: "Étape 1\nÉtape 2",
      seasons: params.seasons ?? [],
      cost: params.cost ?? null,
      source: "manual",
      enrichment_status: "enriched",
      image_status: "none",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (params.tagName) {
    const { data: tag, error: tagError } = await db()
      .from("tags")
      .select("id")
      .eq("name", params.tagName)
      .eq("is_predefined", true)
      .single();
    if (tagError) throw tagError;
    const { error: linkError } = await db()
      .from("recipe_tags")
      .insert({ recipe_id: recipe.id, tag_id: tag.id });
    if (linkError) throw linkError;
  }
  return recipe.id as string;
}

export async function getOwnerByEmail(email: string) {
  const { data, error } = await db()
    .from("owners")
    .select("id, name, recovery_email")
    .eq("recovery_email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Nombre de login_tokens d'un owner (0 attendu après une simple saisie d'email). */
export async function countLoginTokens(ownerId?: string): Promise<number> {
  let query = db().from("login_tokens").select("id", { count: "exact", head: true });
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Remplace les secrets du DERNIER login_token actif de l'owner par des valeurs
 * connues du test. Le transport email est no-op en E2E (RESEND_API_KEY absent)
 * et les hashes ne se renversent pas : c'est le seul moyen de jouer les flows
 * code/lien de bout en bout à travers la vraie logique serveur.
 */
export async function overrideLatestLoginToken(
  ownerId: string,
  purpose: "recovery" | "merge",
  secrets: { token?: string; code?: string },
): Promise<void> {
  const { data: row, error } = await db()
    .from("login_tokens")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error(`Aucun login_token actif (owner ${ownerId}, ${purpose})`);

  const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
  const patch: Record<string, string> = {};
  if (secrets.token) patch.token_hash = sha256(secrets.token);
  if (secrets.code) patch.code_hash = sha256(secrets.code);
  const { error: updateError } = await db().from("login_tokens").update(patch).eq("id", row.id);
  if (updateError) throw updateError;
}

export async function getPredefinedTagId(name: string): Promise<string> {
  const { data, error } = await db()
    .from("tags")
    .select("id")
    .eq("name", name)
    .eq("is_predefined", true)
    .single();
  if (error) throw error;
  return data.id;
}
