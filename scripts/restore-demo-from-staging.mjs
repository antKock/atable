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
// Usage : node scripts/restore-demo-from-staging.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
  );
}
const dryRun = process.argv.includes("--dry-run");
const prodEnv = loadEnv(".env.local");
const stagingEnv = loadEnv(".env.staging.local");
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

const { data: tags } = await prod.from("tags").select("id,name").is("household_id", null);
const tagId = new Map(tags.map((t) => [t.name, t.id]));

const rehost = (url) => (url ? url.replace(/^https:\/\/[^/]+/, `https://${prodStorageHost}`) : null);
let restored = 0, links = 0, missingImages = 0;
for (const r of rows) {
  const generated = rehost(r.generated_image_url);
  if (generated) {
    const head = await fetch(generated, { method: "HEAD" });
    if (!head.ok) { missingImages++; console.warn(`  image absente en prod : ${r.title}`); }
  }
  const recipe = {
    id: r.id, household_id: DEMO, is_seed: true,
    title: r.title, ingredients: r.ingredients, steps: r.steps, notes: r.notes,
    prep_time: r.prep_time, cook_time: r.cook_time, cost: r.cost, complexity: r.complexity,
    seasons: r.seasons, servings: r.servings,
    photo_url: rehost(r.photo_url), generated_image_url: generated, image_prompt: r.image_prompt,
    image_status: generated ? "done" : "none", enrichment_status: r.enrichment_status ?? "enriched",
    source: r.source ?? "manual", created_at: r.created_at,
  };
  const tagIds = r.recipe_tags.map((rt) => tagId.get(rt.tags?.name)).filter(Boolean);
  if (dryRun) { console.log(`  [dry] ${r.title} (${tagIds.length} tags)`); continue; }
  const { error: upErr } = await prod.from("recipes").upsert(recipe, { onConflict: "id" });
  if (upErr) throw new Error(`${r.title}: ${upErr.message}`);
  if (tagIds.length) {
    const { error: tagErr } = await prod.from("recipe_tags").upsert(tagIds.map((tag_id) => ({ recipe_id: r.id, tag_id })), { onConflict: "recipe_id,tag_id" });
    if (tagErr) throw new Error(`${r.title} tags: ${tagErr.message}`);
    links += tagIds.length;
  }
  restored++;
}
const { count } = await prod.from("recipes").select("id", { count: "exact", head: true }).eq("household_id", DEMO).eq("is_seed", true);
console.log(`${dryRun ? "dry-run" : "restauré"} : ${restored} recettes, ${links} liens de tags, ${missingImages} images manquantes — seed en prod maintenant : ${count}`);
