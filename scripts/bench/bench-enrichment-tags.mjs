#!/usr/bin/env node
// Banc d'essai : tags de l'enrichissement en énumération stricte.
//
// Hypothèse (revue d'architecture 2026-09-06) : le schéma strict de la prod
// déclare `tags: string[]` sans `enum` ; quand le modèle traduit ou invente un
// tag (« Vegetarian », « Chicken »), le matching par nom l'ignore en silence →
// recettes EN moins taguées, donc moins de carrousels. Passer les noms des tags
// prédéfinis en `enum` devrait forcer des codes exacts sans dégrader le reste.
//
// Même modèle, même prompt et même schéma que la prod : le code TS de
// src/lib/enrichment-prompt.ts et src/lib/ai-models.ts est importé tel quel
// (strip-types natif de Node ≥ 23.6, cf. hook de résolution ci-dessous).
// Deux variantes par recette : `sans-enum` (état actuel) et `enum`.
//
// Mesures par appel : tags proposés, valides (∈ liste), perdus, retirés par
// sanitizeDietTags, faux tags de régime (⊂ `forbiddenDietTags` de la fixture),
// nombre final, latence, coût. Résultats bruts dans results/enrichment-tags.json.
//
// Usage : node scripts/bench/bench-enrichment-tags.mjs [--runs N] [--max-usd X]
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvLocal } from "../lib/env.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(ROOT, "fixtures", "enrich");
const OUT = path.join(ROOT, "results");
const REPO = path.resolve(ROOT, "../..");
const SRC = path.join(REPO, "src");

// ---------- Import du code de prod (TypeScript) ----------
// Node strippe les types nativement mais ne résout ni l'alias `@/` ni les
// imports sans extension : ce hook fait les deux, uniquement pour src/.
registerHooks({
  resolve(specifier, context, next) {
    const spec = specifier.startsWith("@/")
      ? pathToFileURL(path.join(SRC, specifier.slice(2))).href
      : specifier;
    try {
      return next(spec, context);
    } catch (err) {
      const relative = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file://");
      if (err?.code === "ERR_MODULE_NOT_FOUND" && relative && !path.extname(spec)) {
        return next(`${spec}.ts`, context);
      }
      throw err;
    }
  },
  load(url, context, next) {
    // Sans "type": "module" dans package.json, Node devine le format et avertit.
    if (url.startsWith(pathToFileURL(SRC).href) && url.endsWith(".ts")) {
      return next(url, { ...context, format: "module-typescript" });
    }
    return next(url, context);
  },
});
const { buildEnrichmentSchema, buildSystemPrompt, recipeUserContent, sanitizeDietTags } =
  await import("../../src/lib/enrichment-prompt.ts");
const { AI_MODELS, withEffortFallback } = await import("../../src/lib/ai-models.ts");

// ---------- Clé API (.env.local, socle scripts/lib/env.mjs) ----------
const OPENAI_KEY = loadEnvLocal(path.join(REPO, ".env.local")).OPENAI_SERVICE_KEY;
if (!OPENAI_KEY) {
  console.error("OPENAI_SERVICE_KEY introuvable dans .env.local");
  process.exit(1);
}

// ---------- Paramètres ----------
function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}
const RUNS = argValue("--runs", 2);
const MAX_USD = argValue("--max-usd", 1);
const MODEL = AI_MODELS.text;
// USD / 1M tokens — même grille que src/lib/ai-cost.ts (TOKEN_PRICING).
const PRICING = { "gpt-5.6-luna": { input: 0.2, output: 1.2 } };
const price = PRICING[MODEL];
if (!price) {
  console.error(`Tarif inconnu pour ${MODEL} — compléter PRICING`);
  process.exit(1);
}
// Plafond avant tout appel : ~2 k tokens in / 200 out par appel.
const EST_USD_PER_CALL = (2000 * price.input + 200 * price.output) / 1e6;

const VARIANTS = [
  { id: "sans-enum", enumTags: false },
  { id: "enum", enumTags: true },
];

// ---------- Fixtures ----------
const predefinedTags = JSON.parse(await readFile(path.join(FIX, "predefined-tags.json"), "utf8"));
const tagNames = predefinedTags.map((t) => t.name);
const tagNameSet = new Set(tagNames);
const recipes = [
  ...JSON.parse(await readFile(path.join(FIX, "recipes-fr.json"), "utf8")).map((r) => ({ ...r, lang: "fr" })),
  ...JSON.parse(await readFile(path.join(FIX, "recipes-en.json"), "utf8")).map((r) => ({ ...r, lang: "en" })),
];

const totalCalls = recipes.length * VARIANTS.length * RUNS;
const estimated = totalCalls * EST_USD_PER_CALL;
if (estimated > MAX_USD) {
  console.error(`Budget dépassé avant de commencer : ${totalCalls} appels ≈ $${estimated.toFixed(3)} > $${MAX_USD}`);
  process.exit(1);
}
console.log(`${MODEL} — ${recipes.length} recettes × ${VARIANTS.length} variantes × ${RUNS} runs = ${totalCalls} appels (≈ $${estimated.toFixed(3)}, plafond $${MAX_USD})\n`);

// ---------- Appel OpenAI ----------
const systemPrompt = buildSystemPrompt(predefinedTags);
let spentUsd = 0;

async function postChat(body) {
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Même forme d'erreur que le SDK (status + message) : withEffortFallback
    // de la prod reconnaît le rejet de reasoning_effort et retente sans.
    throw Object.assign(new Error(json?.error?.message ?? `HTTP ${res.status}`), { status: res.status });
  }
  return { json, ms: Date.now() - started };
}

async function callEnrichment(recipe, variant) {
  const base = {
    model: MODEL,
    response_format: {
      type: "json_schema",
      json_schema: buildEnrichmentSchema(tagNames, { enumTags: variant.enumTags }),
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: recipeUserContent(recipe) },
    ],
  };
  // 3 tentatives sur 429 / 5xx passagers, comme le harnais principal.
  for (let attempt = 0; ; attempt++) {
    try {
      return await withEffortFallback((effortParams) => postChat({ ...base, ...effortParams }));
    } catch (err) {
      const transient = err.status === 429 || err.status >= 500;
      if (!transient || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

function measure(recipe, proposed) {
  const valid = proposed.filter((t) => tagNameSet.has(t));
  const lost = proposed.filter((t) => !tagNameSet.has(t));
  // Chemin de la prod : sanitizeDietTags(result.tags) puis matching par nom.
  const sanitized = sanitizeDietTags(proposed);
  const removedBySanitize = proposed.filter((t) => !sanitized.includes(t));
  const final = sanitized.filter((t) => tagNameSet.has(t));
  const falseDiet = final.filter((t) => recipe.forbiddenDietTags.includes(t));
  return {
    proposed: proposed.length,
    valid: valid.length,
    lost,
    removedBySanitize,
    falseDiet,
    final: final.length,
    finalTags: final,
  };
}

// Petit limiteur de concurrence (4 appels en vol max).
function pLimit(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
const limit = pLimit(4);

// ---------- Exécution ----------
const calls = [];
for (let run = 1; run <= RUNS; run++) {
  for (const recipe of recipes) {
    for (const variant of VARIANTS) {
      calls.push(limit(async () => {
        const label = `${recipe.slug} × ${variant.id} #${run}`;
        try {
          const { json, ms } = await callEnrichment(recipe, variant);
          const usage = json.usage ?? {};
          const inputTokens = usage.prompt_tokens ?? 0;
          const outputTokens = usage.completion_tokens ?? 0;
          const costUsd = (inputTokens * price.input + outputTokens * price.output) / 1e6;
          spentUsd += costUsd;
          const output = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
          const metrics = measure(recipe, Array.isArray(output.tags) ? output.tags : []);
          console.log(
            `${label} — ${ms} ms, $${costUsd.toFixed(5)} — ${metrics.valid}/${metrics.proposed} valides` +
              (metrics.lost.length ? `, perdus : ${metrics.lost.join(", ")}` : "") +
              (metrics.removedBySanitize.length ? `, sanitize : ${metrics.removedBySanitize.join(", ")}` : "") +
              (metrics.falseDiet.length ? `, FAUX RÉGIME : ${metrics.falseDiet.join(", ")}` : ""),
          );
          return {
            label: recipe.slug, lang: recipe.lang, variant: variant.id, run, model: MODEL,
            effort: usage.completion_tokens_details ? (json.reasoning_effort ?? null) : null,
            ms, inputTokens, outputTokens,
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
            costUsd, output, metrics,
          };
        } catch (err) {
          console.log(`${label} — ERREUR ${err.message}`);
          return { label: recipe.slug, lang: recipe.lang, variant: variant.id, run, model: MODEL, error: err.message };
        }
      }));
    }
  }
}
const results = await Promise.all(calls);

// ---------- Synthèse ----------
function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const summary = {};
for (const variant of VARIANTS) {
  for (const lang of ["fr", "en", "all"]) {
    const rows = results.filter(
      (r) => !r.error && r.variant === variant.id && (lang === "all" || r.lang === lang),
    );
    summary[`${variant.id}/${lang}`] = {
      calls: rows.length,
      proposed: mean(rows.map((r) => r.metrics.proposed)),
      valid: mean(rows.map((r) => r.metrics.valid)),
      lost: rows.reduce((n, r) => n + r.metrics.lost.length, 0),
      removedBySanitize: rows.reduce((n, r) => n + r.metrics.removedBySanitize.length, 0),
      falseDiet: rows.reduce((n, r) => n + r.metrics.falseDiet.length, 0),
      final: mean(rows.map((r) => r.metrics.final)),
      ms: mean(rows.map((r) => r.ms)),
      usd: rows.reduce((n, r) => n + r.costUsd, 0),
    };
  }
}

await mkdir(OUT, { recursive: true });
const outFile = path.join(OUT, "enrichment-tags.json");
await writeFile(
  outFile,
  JSON.stringify({ date: new Date().toISOString(), model: MODEL, runs: RUNS, summary, calls: results }, null, 2),
);

console.log("\nvariante/langue     appels  proposés  valides  perdus  sanitize  faux régime  final  latence   coût");
for (const [key, s] of Object.entries(summary)) {
  console.log(
    `${key.padEnd(20)}${String(s.calls).padStart(6)}${s.proposed.toFixed(2).padStart(10)}${s.valid.toFixed(2).padStart(9)}` +
      `${String(s.lost).padStart(8)}${String(s.removedBySanitize).padStart(10)}${String(s.falseDiet).padStart(13)}` +
      `${s.final.toFixed(2).padStart(7)}${(s.ms / 1000).toFixed(1).padStart(8)}s  $${s.usd.toFixed(4)}`,
  );
}
const errors = results.filter((r) => r.error).length;
console.log(`\nDépense totale : $${spentUsd.toFixed(4)}${errors ? ` — ${errors} appel(s) en erreur` : ""}`);
console.log(`Résultats bruts : ${outFile}`);
