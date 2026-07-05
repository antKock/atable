#!/usr/bin/env node
// Recheck des tags de régime (besoin #1) : l'enrichissement taguait
// « Végétarien » des recettes au poisson / fruits de mer. Ce script re-vérifie
// via GPT-4o-mini (avec les définitions strictes) toutes les recettes portant
// un tag prédéfini, et signale :
//   - les tags Végétarien / Végan posés à tort  → supprimés avec --apply
//   - les tags Végétarien / Végan manquants     → rapportés seulement
//
// Dry-run par défaut (aucune écriture). Usage :
//   node scripts/recheck-diet-tags.mjs                     # prod (.env.local), dry-run
//   node scripts/recheck-diet-tags.mjs --env .env.staging.local
//   node scripts/recheck-diet-tags.mjs --apply             # supprime les tags erronés

import { readFileSync } from "fs";
import { resolve } from "path";

const APPLY = process.argv.includes("--apply");
const envFlag = process.argv.indexOf("--env");
const ENV_FILE = envFlag !== -1 ? process.argv[envFlag + 1] : ".env.local";

function loadEnv(file) {
  const path = resolve(process.cwd(), file);
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

const env = loadEnv(ENV_FILE);
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
const OPENAI_KEY = env["OPENAI_SERVICE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or OPENAI_SERVICE_KEY in ${ENV_FILE}`);
  process.exit(1);
}

console.log(`Env    : ${ENV_FILE} → ${SUPABASE_URL}`);
console.log(`Mode   : ${APPLY ? "APPLY (suppression des tags erronés)" : "dry-run"}\n`);

async function rest(path, init = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Range: "0-49999",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// LLM verdict on the diet facts of one recipe (title + ingredients).
async function classifyDiet(recipe) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "diet_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              containsMeatPoultryFishSeafood: { type: "boolean" },
              containsOtherAnimalProduct: { type: "boolean" },
              evidence: { type: "string" },
            },
            required: ["containsMeatPoultryFishSeafood", "containsOtherAnimalProduct", "evidence"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `Tu es un vérificateur de régimes alimentaires. Analyse les ingrédients d'une recette et réponds en JSON :
- containsMeatPoultryFishSeafood : true si un ingrédient est une viande, volaille, charcuterie, poisson, fruit de mer ou gélatine (le poisson et les fruits de mer comptent TOUJOURS : saumon, thon, crevettes, anchois, sauce nuoc-mâm/poisson…).
- containsOtherAnimalProduct : true si un ingrédient est un œuf, produit laitier (beurre, crème, fromage, lait…) ou du miel. Les laits et crèmes VÉGÉTAUX (lait de coco, lait d'amande, lait de soja, crème de coco…) ne sont PAS des produits animaux.
- evidence : le ou les ingrédients qui justifient tes réponses (chaîne vide si aucun).
Ignore les suggestions purement optionnelles du type « servir avec ».`,
        },
        { role: "user", content: `Titre: ${recipe.title}\nIngrédients:\n${recipe.ingredients ?? ""}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI → ${res.status} ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

// 1. All predefined recipe_tags with their recipe content
const rows = await rest(
  "recipe_tags?select=recipe_id,tag_id,tags!inner(name,is_predefined),recipes!inner(id,title,ingredients)&tags.is_predefined=eq.true"
);

const recipes = new Map();
for (const r of rows) {
  if (!r.tags?.is_predefined) continue;
  const entry = recipes.get(r.recipe_id) ?? {
    id: r.recipe_id,
    title: r.recipes.title,
    ingredients: r.recipes.ingredients,
    tags: [],
  };
  entry.tags.push({ name: r.tags.name, tagId: r.tag_id });
  recipes.set(r.recipe_id, entry);
}
console.log(`Recettes avec ≥1 tag prédéfini : ${recipes.size}\n`);

// 2. LLM check, small concurrency to stay polite with the API
const all = [...recipes.values()];
const wrongTags = []; // {recipe, tagName, tagId, evidence}
const missing = []; // {recipe, tagName, evidence}
let checked = 0;

async function worker() {
  while (all.length > 0) {
    const recipe = all.shift();
    let verdict;
    try {
      verdict = await classifyDiet(recipe);
    } catch (e) {
      console.error(`  ⚠️  ${recipe.title} — LLM check failed: ${e.message}`);
      continue;
    }
    const isVegetarian = !verdict.containsMeatPoultryFishSeafood;
    const isVegan = isVegetarian && !verdict.containsOtherAnimalProduct;
    const has = (name) => recipe.tags.find((t) => t.name === name);

    for (const [tagName, ok] of [["Végétarien", isVegetarian], ["Végan", isVegan]]) {
      const tag = has(tagName);
      if (tag && !ok) wrongTags.push({ recipe, tagName, tagId: tag.tagId, evidence: verdict.evidence });
      // Les recettes sans ingrédients ne permettent pas d'affirmer un régime.
      if (!tag && ok && recipe.ingredients) missing.push({ recipe, tagName, evidence: verdict.evidence });
    }
    checked++;
    if (checked % 25 === 0) console.log(`  …${checked}/${recipes.size} vérifiées`);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

// 3. Report
console.log(`\n=== Tags de régime POSÉS À TORT (${wrongTags.length}) ===`);
for (const w of wrongTags) {
  console.log(`  ✗ ${w.tagName} — « ${w.recipe.title} » (${w.recipe.id})\n      preuve : ${w.evidence}`);
}
console.log(`\n=== Tags de régime MANQUANTS (${missing.length}) — rapport seulement ===`);
for (const m of missing) {
  console.log(`  + ${m.tagName} — « ${m.recipe.title} » (${m.recipe.id})`);
}

// 4. Apply removals
if (APPLY && wrongTags.length > 0) {
  console.log(`\nSuppression de ${wrongTags.length} tag(s) erroné(s)…`);
  for (const w of wrongTags) {
    await rest(`recipe_tags?recipe_id=eq.${w.recipe.id}&tag_id=eq.${w.tagId}`, { method: "DELETE" });
    console.log(`  supprimé : ${w.tagName} ← « ${w.recipe.title} »`);
  }
} else if (wrongTags.length > 0) {
  console.log(`\nDry-run : relancer avec --apply pour supprimer ces ${wrongTags.length} tag(s).`);
}
console.log("\nTerminé.");
