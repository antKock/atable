#!/usr/bin/env node
// Télécharge localement les envois d'import gardés 30 jours (lecture seule),
// pour reproduire une erreur ou alimenter le banc OCR.
// docs/specs/ocr-appareil/01-conservation-imports.md
//
// Usage :
//   node scripts/import-samples/pull.mjs prod|staging|local [--id=<sampleId>] [--errors]
//        [--method=photo|voice|url] [--since=7] [--max-per-owner=N] [--limit=200]
//
// Sortie : scripts/bench/fixtures/import-samples/<env>/<sampleId>/ (hors git)
//   sample.json  — la ligne import_samples (+ `saved` : la recette enregistrée
//                  après corrections, quand elle existe : c'est la vérité terrain)
//   1.jpg, audio.m4a, page.txt… — les fichiers tels que reçus
// + manifest-real.json : les échantillons PHOTO reliés à une recette, au format
//   du pool du banc (node scripts/bench/ocr-pool/bench-ocr-pool.mjs --manifest=…).
// Les copies d'échantillons expirés sont supprimées à chaque passage.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { target, purgeLocal, ensureDir, parseArgs } from "./lib.mjs";

const { positional, flags } = parseArgs();
const t = target(positional[0] ?? "");
await ensureDir(t.outDir);
const purged = await purgeLocal(t.outDir);
if (purged) console.log(`${purged} copie(s) locale(s) expirée(s) supprimée(s)`);

const filters = [`expires_at=gt.${new Date().toISOString()}`];
if (flags.id) filters.push(`id=eq.${flags.id}`);
if (flags.errors) filters.push("status=gte.400");
if (flags.method) filters.push(`method=eq.${flags.method}`);
if (flags.since) {
  filters.push(
    `created_at=gte.${new Date(Date.now() - Number(flags.since) * 86400_000).toISOString()}`,
  );
}
const limit = Number(flags.limit ?? 200);
let rows = await t.rest(
  `import_samples?select=*&${filters.join("&")}&order=created_at.desc&limit=${limit}`,
);

// Rééquilibrage : une personne très active ne doit pas faire tout le pool.
if (flags["max-per-owner"]) {
  const max = Number(flags["max-per-owner"]);
  const seen = new Map();
  rows = rows.filter((r) => {
    const n = (seen.get(r.owner_id) ?? 0) + 1;
    seen.set(r.owner_id, n);
    return n <= max;
  });
}

// Vérité terrain : la recette telle qu'enregistrée (corrigée par la personne).
const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))];
const saved = new Map();
for (let i = 0; i < recipeIds.length; i += 50) {
  const chunk = recipeIds.slice(i, i + 50);
  const recipes = await t.rest(
    `recipes?select=id,title,ingredients,steps,notes,servings&id=in.(${chunk.join(",")})`,
  );
  for (const r of recipes) saved.set(r.id, r);
}

const manifest = [];
for (const row of rows) {
  const dir = path.join(t.outDir, row.id);
  await ensureDir(dir);
  const files = [];
  for (const key of row.files) {
    const name = key.split("/").pop();
    try {
      await writeFile(path.join(dir, name), await t.getFile(key));
      files.push(name);
    } catch (err) {
      console.warn(`  ${key} : ${err.message}`);
    }
  }
  const recipe = row.recipe_id ? saved.get(row.recipe_id) : null;
  await writeFile(
    path.join(dir, "sample.json"),
    JSON.stringify({ ...row, saved: recipe ?? null }, null, 1),
  );

  if (row.method === "photo" && recipe) {
    const lines = (s) =>
      (s ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const truth = {
      id: row.id,
      category: row.image_kind ?? "other",
      lang: null,
      title: recipe.title,
      ingredients: lines(recipe.ingredients),
      steps: lines(recipe.steps),
      notes: recipe.notes,
      servings: recipe.servings,
      truncated: false,
    };
    await writeFile(path.join(dir, "truth.json"), JSON.stringify(truth, null, 1));
    manifest.push({
      id: `real-${row.id}`,
      category: row.image_kind ?? "other",
      subtype: "reel",
      images: files.filter((f) => /\.(jpe?g|png|webp)$/.test(f)).map((f) => `${row.id}/${f}`),
      truth: `${row.id}/truth.json`,
      source: `${t.name}:import_samples/${row.id}`,
      truth_method: "recette-enregistree",
    });
  }
  console.log(
    `${row.id}  ${row.method}/${row.status}${row.error_code ? `/${row.error_code}` : ""}  ${files.length} fichier(s)${recipe ? "  + recette enregistrée" : ""}`,
  );
}
await writeFile(path.join(t.outDir, "manifest-real.json"), JSON.stringify(manifest, null, 1));
console.log(`\n${rows.length} échantillon(s) → ${t.outDir}`);
console.log(`${manifest.length} photo(s) avec vérité terrain → manifest-real.json`);
