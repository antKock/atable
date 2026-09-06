#!/usr/bin/env node
// Restaure les recettes SEED du foyer démo de PROD depuis la copie de STAGING
// (inverse de sync-staging-demo-from-prod.mjs). Écrit le 2026-09-04 après
// l'incident « démo prod vide » : les 30 recettes seed avaient été supprimées
// par un visiteur (aucun garde-fou sur la suppression d'une recette seed —
// corrigé par assertNotDemoSeedMutation).
//
// Idempotent : upsert par id (les ids de staging sont ceux de la copie du
// 2026-06-18). Les images sont référencées dans le Storage PROD aux mêmes
// chemins que staging (vérifié : les 30 fichiers y sont toujours). Les tags
// sont résolus par nom dans la table `tags` globale de prod.
//
// Requiert : .env.local (prod) et .env.staging.local (staging).
// Usage : node scripts/restore-demo-from-staging.mjs [--dry-run] [--yes]
//   Écrit en PROD : demande de taper PROD (sauf --dry-run ou --yes).
//   Une recette en échec n'arrête pas les autres ; récapitulatif final et
//   code de sortie 1 s'il y a eu au moins un échec.
import { createClient } from "@supabase/supabase-js";
import { ENV_FILES, confirmProd, loadEnvLocal } from "./lib/env.mjs";

const dryRun = process.argv.includes("--dry-run");
const prodEnv = loadEnvLocal(ENV_FILES.prod);
const stagingEnv = loadEnvLocal(ENV_FILES.staging);
const prod = createClient(prodEnv.NEXT_PUBLIC_SUPABASE_URL, prodEnv.SUPABASE_SERVICE_ROLE_KEY);
const staging = createClient(stagingEnv.NEXT_PUBLIC_SUPABASE_URL, stagingEnv.SUPABASE_SERVICE_ROLE_KEY);
const DEMO = prodEnv.DEMO_HOUSEHOLD_ID;
const prodStorageHost = new URL(prodEnv.NEXT_PUBLIC_SUPABASE_URL).host;

const { data: hh, error: hhError } = await prod.from("households").select("id,name,is_demo").eq("id", DEMO).single();
if (hhError || !hh?.is_demo) throw new Error(`foyer démo prod introuvable ou non démo : ${hhError?.message}`);

const { data: rows, error } = await staging
  .from("recipes")
  .select("id,title,ingredients,steps,notes,prep_time,cook_time,cost,complexity,seasons,servings,photo_url,generated_image_url,image_prompt,image_status,enrichment_status,source,created_at,recipe_tags(tags(name))")
  .eq("household_id", stagingEnv.DEMO_HOUSEHOLD_ID)
  .eq("is_seed", true);
if (error) throw error;
console.log(`staging : ${rows.length} recettes seed`);

const { data: tags, error: tagsError } = await prod.from("tags").select("id,name").is("household_id", null);
if (tagsError || !tags) {
  console.error(`lecture des tags globaux de prod impossible : ${tagsError?.message ?? "réponse vide"}`);
  process.exit(1);
}
const tagId = new Map(tags.map((t) => [t.name, t.id]));

if (!dryRun) await confirmProd("restauration des recettes seed démo", { envFile: ENV_FILES.prod });

const rehost = (url) => (url ? url.replace(/^https:\/\/[^/]+/, `https://${prodStorageHost}`) : null);
// Les deux images (photo importée et image générée) sont ré-hébergées sur le
// Storage prod : on vérifie que chacune y répond avant de la référencer.
async function checkImage(url, title, kind) {
  if (!url) return;
  const head = await fetch(url, { method: "HEAD" });
  if (!head.ok) { missingImages++; console.warn(`  ${kind} absente en prod : ${title}`); }
}
let restored = 0, links = 0, missingImages = 0;
const failures = [];
for (const r of rows) {
  const generated = rehost(r.generated_image_url);
  const photo = rehost(r.photo_url);
  await checkImage(generated, r.title, "image générée");
  await checkImage(photo, r.title, "photo");
  const recipe = {
    id: r.id, household_id: DEMO, is_seed: true,
    title: r.title, ingredients: r.ingredients, steps: r.steps, notes: r.notes,
    prep_time: r.prep_time, cook_time: r.cook_time, cost: r.cost, complexity: r.complexity,
    seasons: r.seasons, servings: r.servings,
    photo_url: photo, generated_image_url: generated, image_prompt: r.image_prompt,
    image_status: generated ? "done" : "none", enrichment_status: r.enrichment_status ?? "enriched",
    source: r.source ?? "manual", created_at: r.created_at,
  };
  const tagIds = r.recipe_tags.map((rt) => tagId.get(rt.tags?.name)).filter(Boolean);
  if (dryRun) { console.log(`  [dry] ${r.title} (${tagIds.length} tags)`); continue; }
  // Upserts séquentiels (30 recettes, volume négligeable) ; un échec est
  // consigné et n'empêche pas les suivantes.
  const { error: upErr } = await prod.from("recipes").upsert(recipe, { onConflict: "id" });
  if (upErr) { failures.push(`${r.title}: ${upErr.message}`); console.error(`  ✗ ${r.title}: ${upErr.message}`); continue; }
  if (tagIds.length) {
    const { error: tagErr } = await prod.from("recipe_tags").upsert(tagIds.map((tag_id) => ({ recipe_id: r.id, tag_id })), { onConflict: "recipe_id,tag_id" });
    if (tagErr) { failures.push(`${r.title} tags: ${tagErr.message}`); console.error(`  ✗ ${r.title} tags: ${tagErr.message}`); continue; }
    links += tagIds.length;
  }
  restored++;
}
const { count } = await prod.from("recipes").select("id", { count: "exact", head: true }).eq("household_id", DEMO).eq("is_seed", true);
console.log(`${dryRun ? "dry-run" : "restauré"} : ${restored} recettes, ${failures.length} échecs, ${links} liens de tags, ${missingImages} images manquantes — seed en prod maintenant : ${count}`);
if (failures.length) {
  console.error(`échecs :\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
