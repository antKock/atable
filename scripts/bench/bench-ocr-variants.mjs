#!/usr/bin/env node
// Variantes OCR de rattrapage : gpt-5.6-luna @ reasoning_effort=low et
// gpt-5.6-terra @ minimal, jugées face aux sorties existantes (results.json)
// de gpt-4o et gpt-5.6-luna @ minimal. Usage : node scripts/bench/bench-ocr-variants.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(ROOT, "fixtures");
const OUT = path.join(ROOT, "results");
const REPO = path.resolve(ROOT, "../..");
const envFile = await readFile(path.join(REPO, ".env.local"), "utf8");
const OPENAI_KEY = envFile.match(/^OPENAI_SERVICE_KEY=(.+)$/m)?.[1]?.trim();

const TOKEN_PRICING = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5-mini": { input: 0.25, output: 2 },
};

const VALID_SEASONS = ["printemps", "ete", "automne", "hiver"];
const VALID_PREP_TIMES = ["< 10 min", "10-20 min", "20-30 min", "30-45 min", "> 45 min"];
const VALID_COOK_TIMES = ["Aucune", "< 15 min", "15-30 min", "30 min - 1h", "1h - 2h", "> 2h"];
const VALID_COST_LEVELS = ["€", "€€", "€€€"];
const VALID_COMPLEXITY_LEVELS = ["facile", "moyen", "difficile"];

// Même prompt/schema que bench-models.mjs (copie de src/lib/import.ts).
const EXTRACTION_SYSTEM_PROMPT = (await readFile(path.join(ROOT, "bench-models.mjs"), "utf8"))
  .match(/const EXTRACTION_SYSTEM_PROMPT = `([\s\S]*?)`;/)[1]
  .replaceAll("${VALID_PREP_TIMES.join(\", \")}", VALID_PREP_TIMES.join(", "))
  .replaceAll("${VALID_COOK_TIMES.join(\", \")}", VALID_COOK_TIMES.join(", "))
  .replaceAll("${VALID_COST_LEVELS.join(\", \")}", VALID_COST_LEVELS.join(", "))
  .replaceAll("${VALID_COMPLEXITY_LEVELS.join(\", \")}", VALID_COMPLEXITY_LEVELS.join(", "))
  .replaceAll("${VALID_SEASONS.join(\", \")}", VALID_SEASONS.join(", "))
  .replaceAll("\\n", "\n");

const IMPORT_JSON_SCHEMA = {
  name: "recipe_import",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      ingredients: { type: ["string", "null"] },
      steps: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
      prepTime: { type: ["string", "null"], enum: [...VALID_PREP_TIMES, null] },
      cookTime: { type: ["string", "null"], enum: [...VALID_COOK_TIMES, null] },
      cost: { type: ["string", "null"], enum: [...VALID_COST_LEVELS, null] },
      complexity: { type: ["string", "null"], enum: [...VALID_COMPLEXITY_LEVELS, null] },
      seasons: { type: "array", items: { type: "string", enum: [...VALID_SEASONS] } },
      servings: { type: ["integer", "null"] },
    },
    required: ["title", "ingredients", "steps", "notes", "prepTime", "cookTime", "cost", "complexity", "seasons", "servings"],
    additionalProperties: false,
  },
};

// Round 4 : impact du paramètre `detail` des images sur gpt-4o (pas de
// reasoning_effort sur cette génération — le levier vision, c'est detail).
const VARIANTS = [
  { key: "gpt-4o@detail-low", model: "gpt-4o", detail: "low" },
  { key: "gpt-4o@detail-high", model: "gpt-4o", detail: "high" },
];
const CASES = ["marmiton-ratatouille", "cuisineaz-sauce-pommes", "750g-tarte-pommes"];

async function runOcr(variant, slug) {
  const images = [];
  for (const n of [1, 2]) {
    const buf = await readFile(path.join(FIX, "images", `${slug}-${n}.png`));
    images.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${buf.toString("base64")}`,
        ...(variant.detail ? { detail: variant.detail } : {}),
      },
    });
  }
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: variant.model,
      ...(variant.effort ? { reasoning_effort: variant.effort } : {}),
      response_format: { type: "json_schema", json_schema: IMPORT_JSON_SCHEMA },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: "Extrais la recette de cette/ces image(s) :" }, ...images] },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  const json = await res.json();
  if (!res.ok) return { label: slug, model: variant.key, error: json?.error?.message ?? res.status };
  const u = json.usage ?? {};
  const p = TOKEN_PRICING[variant.model];
  return {
    label: slug, model: variant.key, ms: Date.now() - started,
    inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    costUsd: ((u.prompt_tokens ?? 0) * p.input + (u.completion_tokens ?? 0) * p.output) / 1e6,
    output: JSON.parse(json.choices[0].message.content),
  };
}

async function judge(caseLabel, source, candidates) {
  const letters = ["A", "B", "C", "D"];
  const shuffled = [...candidates].sort((a, b) => {
    const h = (s) => [...(caseLabel + s)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    return h(a.model) - h(b.model);
  });
  const mapping = Object.fromEntries(shuffled.map((c, i) => [letters[i], c.model]));
  const blocks = shuffled.map((c, i) => `--- Candidat ${letters[i]} ---\n${JSON.stringify(c.output, null, 1)}`).join("\n\n");
  const schema = {
    name: "judgement", strict: true,
    schema: {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              candidate: { type: "string" }, completeness: { type: "integer" },
              fidelity: { type: "integer" }, format: { type: "integer" }, comment: { type: "string" },
            },
            required: ["candidate", "completeness", "fidelity", "format", "comment"],
            additionalProperties: false,
          },
        },
        ranking: { type: "array", items: { type: "string" } },
      },
      required: ["scores", "ranking"], additionalProperties: false,
    },
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.6-sol", reasoning_effort: "medium",
      response_format: { type: "json_schema", json_schema: schema },
      messages: [
        {
          role: "system",
          content: `Tu es un évaluateur exigeant d'extractions de recettes. On te donne une SOURCE (texte de référence de la page) et ${shuffled.length} extractions JSON candidates produites depuis des CAPTURES D'ÉCRAN de cette page (un bandeau cookies masquait parfois le titre : un titre raisonnablement déduit est acceptable, un contenu inventé non). Note chaque candidat de 0 à 10 en completeness (rien d'oublié), fidelity (rien d'inventé : quantités, servings, saisons, temps), format (une ligne par ingrédient/étape, pas de puces/numéros, sections « // » seulement si la source en a, notes = uniquement astuce explicite sinon null). Classe ensuite du meilleur au moins bon. Cite les différences concrètes.`,
        },
        { role: "user", content: `SOURCE :\n${source}\n\nCANDIDATS :\n\n${blocks}` },
      ],
    }),
    signal: AbortSignal.timeout(300000),
  });
  const json = await res.json();
  if (!res.ok) return { caseLabel, error: json?.error?.message ?? res.status };
  return { caseLabel, mapping, ...JSON.parse(json.choices[0].message.content) };
}

const prior = JSON.parse(await readFile(path.join(OUT, "results.json"), "utf8"));
// Sorties des runs précédents (si présentes), pour un jugement à 4 candidats :
// gpt-4o + Luna@low + Terra@none + le nouveau venu. Luna@minimal (dominé par
// Luna@low) sort du panel pour rester ≤ 4.
let lunaLow = [];
try {
  lunaLow = JSON.parse(await readFile(path.join(OUT, "ocr-variants.json"), "utf8"))
    .newRuns.filter((r) => r.model === "gpt-5.6-luna@low" && !r.error);
} catch {
  /* premier run */
}
// (Terra du round 2 sort du panel : dominé en prix, et 4 candidats max.)
const newRuns = [];
for (const variant of VARIANTS) {
  for (const slug of CASES) {
    const r = await runOcr(variant, slug);
    console.log(`ocr ${slug} × ${variant.key} — ${r.error ? "ERREUR " + r.error : `${r.ms}ms, ${r.inputTokens}in/${r.outputTokens}out (${r.reasoningTokens} raisonnement), $${r.costUsd.toFixed(5)}`}`);
    newRuns.push(r);
  }
}

const judgements = [];
for (const slug of CASES) {
  const source = await readFile(path.join(FIX, "text", `${slug}.txt`), "utf8");
  const candidates = [
    ...prior.ocr.filter((r) => r.label === slug && !r.error && r.model === "gpt-4o").map((r) => ({ model: r.model, output: r.output })),
    ...lunaLow.filter((r) => r.label === slug).map((r) => ({ model: r.model, output: r.output })),
    ...newRuns.filter((r) => r.label === slug && !r.error).map((r) => ({ model: r.model, output: r.output })),
  ];
  const j = await judge(`ocr4/${slug}`, source, candidates);
  judgements.push(j);
  console.log(`juge ${slug} — ${j.error ?? j.ranking?.join(" > ")}`);
}

await writeFile(path.join(OUT, "ocr-variants4.json"), JSON.stringify({ newRuns, judgements }, null, 2));

const norm = (s) => (s.match(/[A-D]$/) || [s])[0];
const byModel = {};
for (const j of judgements) {
  if (j.error) continue;
  for (const s of j.scores) {
    const model = j.mapping[norm(s.candidate)];
    if (!model) continue;
    byModel[model] ??= { total: 0, n: 0, wins: 0 };
    byModel[model].total += s.completeness + s.fidelity + s.format;
    byModel[model].n++;
  }
  const w = j.mapping[norm(j.ranking[0])];
  if (w) { byModel[w] ??= { total: 0, n: 0, wins: 0 }; byModel[w].wins++; }
}
console.log("\n=== OCR 4 candidats — score moyen /30 et victoires/3");
for (const [m, s] of Object.entries(byModel)) {
  console.log(`  ${m} — ${(s.total / s.n).toFixed(1)}/30, ${s.wins} victoire(s)`);
}
