#!/usr/bin/env node
// Foyer démo ANGLAIS (chantier « Version EN », Lot 3).
//
//   node scripts/demo-en/demo-en.mjs translate            → lit les recettes seed
//        du foyer démo FR de STAGING (.env.staging.local), les traduit en en-US
//        avec le modèle texte de prod, écrit scripts/demo-en/recipes.en.json
//        (versionné : même contenu sur staging et prod, relisible).
//   node scripts/demo-en/demo-en.mjs apply --env staging|prod [--dry-run]
//        → crée/maj le foyer démo EN (id fixe, is_demo) et ses recettes seed
//        (ids fixes, upsert), en réutilisant les IMAGES générées des recettes
//        FR (mêmes fichiers Storage — les seed ne sont jamais supprimées) et
//        les tags globaux résolus par nom canonique FR.
//
// L'id du foyer EN est ensuite à poser en env : DEMO_HOUSEHOLD_ID_EN.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(HERE, "recipes.en.json");
export const DEMO_EN_HOUSEHOLD_ID = "00000000-0000-0000-0000-00000000e000";
const recipeId = (n) => `00000000-0000-0000-0000-00000000e${String(n).padStart(3, "0")}`;

function loadEnv(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
  );
}
const args = process.argv.slice(2);
const cmd = args[0];
const envName = args.includes("--env") ? args[args.indexOf("--env") + 1] : null;
const dryRun = args.includes("--dry-run");

if (cmd === "translate") {
  const staging = loadEnv(".env.staging.local");
  const prodEnv = loadEnv(".env.local");
  const sb = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await sb.from("recipes")
    .select("id,title,ingredients,steps,notes,prep_time,cook_time,cost,complexity,seasons,servings,generated_image_url,image_prompt,created_at,recipe_tags(tags(name))")
    .eq("household_id", staging.DEMO_HOUSEHOLD_ID).eq("is_seed", true).order("created_at");
  if (error) throw error;
  console.log(`source : ${rows.length} recettes seed FR (staging)`);
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: prodEnv.OPENAI_SERVICE_KEY });
  const SYSTEM = `You translate French home-cooking recipes into natural American English (en-US) for a recipe app.
Rules:
- Translate title, ingredients, steps and notes. Keep quantities and METRIC units exactly as given (g, kg, ml, cl, l, °C) — do not convert.
- Keep the line structure: one ingredient per line, one step per line. A line starting with "// " is a section header: keep the "// " prefix and translate the header.
- Title in Title Case (e.g. "Beef Bourguignon"). Keep well-known French dish names as commonly used in English ("Ratatouille", "Tarte Tatin", "Crêpes", "Gratin Dauphinois", "Tartiflette", "Tiramisu").
- Do not add or remove ingredients or steps. No commentary. Return JSON only.`;
  const schema = { name: "recipe_translation", strict: true, schema: { type: "object", additionalProperties: false, required: ["title", "ingredients", "steps", "notes"], properties: { title: { type: "string" }, ingredients: { type: ["string", "null"] }, steps: { type: ["string", "null"] }, notes: { type: ["string", "null"] } } } };
  const out = [];
  let n = 0;
  for (const r of rows) {
    n++;
    const res = await openai.chat.completions.create({
      model: "gpt-5.6-luna", reasoning_effort: "none",
      response_format: { type: "json_schema", json_schema: schema },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify({ title: r.title, ingredients: r.ingredients, steps: r.steps, notes: r.notes }) }],
    });
    const tr = JSON.parse(res.choices[0].message.content ?? "{}");
    out.push({
      id: recipeId(n), source_fr_id: r.id, source_title_fr: r.title,
      title: tr.title, ingredients: tr.ingredients, steps: tr.steps, notes: tr.notes,
      prep_time: r.prep_time, cook_time: r.cook_time, cost: r.cost, complexity: r.complexity,
      seasons: r.seasons, servings: r.servings, image_prompt: r.image_prompt,
      generated_image_url: r.generated_image_url, tags: r.recipe_tags.map((rt) => rt.tags?.name).filter(Boolean),
    });
    console.log(`  ${n}/${rows.length} ${r.title} → ${tr.title}`);
  }
  writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`écrit ${JSON_PATH}`);
} else if (cmd === "apply") {
  if (!envName) throw new Error("--env staging|prod requis");
  const env = loadEnv(envName === "prod" ? ".env.local" : ".env.staging.local");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host;
  const recipes = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  console.log(`${envName} (${host}) : ${recipes.length} recettes EN${dryRun ? " [dry-run]" : ""}`);
  const { data: tags } = await sb.from("tags").select("id,name").is("household_id", null);
  const tagId = new Map(tags.map((t) => [t.name, t.id]));
  // Les images FR vivent dans le Storage de CHAQUE env au même chemin ; on
  // ré-héberge l'URL sur l'env cible et on vérifie qu'elle répond.
  const rehost = (url) => (url ? url.replace(/^https:\/\/[^/]+/, `https://${host}`) : null);
  if (dryRun) { for (const r of recipes) console.log(`  [dry] ${r.title} (${r.tags.length} tags)`); process.exit(0); }
  const { error: hhErr } = await sb.from("households").upsert(
    { id: DEMO_EN_HOUSEHOLD_ID, name: "Mijote Demo", join_code: "DEMO-0001", guest_join_code: "DEMOGUEST-0001", is_demo: true },
    { onConflict: "id" },
  );
  if (hhErr) throw hhErr;
  let missing = 0, links = 0;
  for (const r of recipes) {
    const image = rehost(r.generated_image_url);
    if (image) { const head = await fetch(image, { method: "HEAD" }); if (!head.ok) { missing++; console.warn(`  image absente : ${r.title}`); } }
    const { error } = await sb.from("recipes").upsert({
      id: r.id, household_id: DEMO_EN_HOUSEHOLD_ID, is_seed: true,
      title: r.title, ingredients: r.ingredients, steps: r.steps, notes: r.notes,
      prep_time: r.prep_time, cook_time: r.cook_time, cost: r.cost, complexity: r.complexity,
      seasons: r.seasons, servings: r.servings, image_prompt: r.image_prompt,
      generated_image_url: image, image_status: image ? "done" : "none",
      enrichment_status: "enriched", source: "manual",
    }, { onConflict: "id" });
    if (error) throw new Error(`${r.title}: ${error.message}`);
    const ids = r.tags.map((name) => tagId.get(name)).filter(Boolean);
    if (ids.length) {
      const { error: tagErr } = await sb.from("recipe_tags").upsert(ids.map((tag_id) => ({ recipe_id: r.id, tag_id })), { onConflict: "recipe_id,tag_id" });
      if (tagErr) throw new Error(`${r.title} tags: ${tagErr.message}`);
      links += ids.length;
    }
  }
  const { count } = await sb.from("recipes").select("id", { count: "exact", head: true }).eq("household_id", DEMO_EN_HOUSEHOLD_ID).eq("is_seed", true);
  console.log(`appliqué : ${recipes.length} recettes, ${links} liens de tags, ${missing} images manquantes — seed EN en base : ${count}`);
  console.log(`→ poser DEMO_HOUSEHOLD_ID_EN=${DEMO_EN_HOUSEHOLD_ID} dans l'env ${envName}`);
} else {
  console.error("usage : demo-en.mjs translate | apply --env staging|prod [--dry-run]");
  process.exit(1);
}
