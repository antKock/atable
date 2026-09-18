#!/usr/bin/env node
// Banc d'essai « image moins chère » : régénère l'image de plat de quelques
// recettes de prod avec plusieurs modèles/qualités OpenAI, en réutilisant
// EXACTEMENT la construction du prompt de prod (src/lib/enrichment.ts,
// generateImageBytes : image_prompt + suffixe de style fixe).
// Mesure : tokens réels (usage), coût USD, latence. Produit une planche HTML
// (une ligne par recette, une colonne par variante, image prod actuelle en tête)
// dans scripts/bench/results/image/ (gitignoré).
// Les recettes (id, titre, image_prompt, URL de l'image prod) sont lues en
// lecture seule sur la base prod : node scripts/events/query.mjs prod … (tunnel ssh).
// Usage : node scripts/bench/bench-image.mjs [--only 1.5-low,2-low] [--planche nom] [--html-only]
//   --only    : sous-ensemble de variantes (les autres cases de results.json sont conservées)
//   --planche : nom du fichier HTML (défaut « planche »)
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "../lib/env.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "../..");
const OUT = path.join(ROOT, "results", "image");

const envVars = loadEnvLocal(path.join(REPO, ".env.local"));
const OPENAI_KEY = envVars.OPENAI_SERVICE_KEY;
if (!OPENAI_KEY) {
  console.error("OPENAI_SERVICE_KEY introuvable dans .env.local");
  process.exit(1);
}

// ---------- Recettes : 5 profils variés (mijoté, dessert, salade, sauce, difficile) ----------
const RECIPES = [
  { id: "fdd25430-168e-4ff2-abe5-2a180de855b6", profile: "plat mijoté" },
  { id: "ffc318fb-8392-40e7-a063-6984ba56f979", profile: "dessert" },
  { id: "38adce96-9358-4e95-a323-b2f170462f07", profile: "salade" },
  { id: "6b1affa9-91ef-417c-86dd-b428fb3d9738", profile: "plat en sauce" },
  { id: "cfb988a3-411f-410c-8ccd-306ab08f1c7d", profile: "difficile (pâte crue)" },
  // Second lot (2026-09-18) pour départager gpt-image-2 et 2.5-flare.
  { id: "c066b849-9ec5-4d65-b8c8-cbf89276e20a", profile: "sandwich" },
  { id: "3ea45f64-9bea-42d0-b443-c447b1096978", profile: "plat asiatique" },
  { id: "5400bd07-0c4e-4930-8a14-1cf50d2983f1", profile: "tarte salée" },
  { id: "9229c95c-3417-4166-8368-ca951b29289a", profile: "biscuits" },
  { id: "bebd3d15-33d0-46bb-a680-1747242dfff4", profile: "difficile (sauce seule)" },
];

// ---------- Variantes ----------
// Prix OpenAI au 2026-09-18 (USD / 1M tokens, developers.openai.com/api/docs/pricing).
// gpt-image-1.5 facture en plus des tokens de SORTIE TEXTE (~143/image, raisonnement
// interne) à 10 $/1M ; les autres modèles n'en émettent pas.
const PRICING = {
  "gpt-image-1.5": { textIn: 5, textOut: 10, imageOut: 32 },
  "gpt-image-1-mini": { textIn: 2, textOut: 0, imageOut: 8 },
  "gpt-image-2": { textIn: 5, textOut: 0, imageOut: 30 },
  "gpt-image-2.5-flare": { textIn: 5, textOut: 0, imageOut: 30 },
};
const ALL_VARIANTS = [
  {
    key: "1.5-low",
    model: "gpt-image-1.5",
    quality: "low",
    label: "gpt-image-1.5 low (prod, régénérée)",
  },
  { key: "mini-low", model: "gpt-image-1-mini", quality: "low", label: "gpt-image-1-mini low" },
  {
    key: "mini-medium",
    model: "gpt-image-1-mini",
    quality: "medium",
    label: "gpt-image-1-mini medium",
  },
  { key: "2-low", model: "gpt-image-2", quality: "low", label: "gpt-image-2 low" },
  {
    key: "flare-low",
    model: "gpt-image-2.5-flare",
    quality: "low",
    label: "gpt-image-2.5-flare low",
  },
];
const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
};
const only = argValue("--only")?.split(",");
const VARIANTS = only ? ALL_VARIANTS.filter((v) => only.includes(v.key)) : ALL_VARIANTS;
const PLANCHE = argValue("--planche") ?? "planche";

// Copie conforme de src/lib/enrichment.ts (generateImageBytes).
const prodPrompt = (imagePrompt) =>
  `${imagePrompt}. Flat realistic illustration, overhead angle, neutral warm background, soft natural lighting. Show only the dish exactly as described above, plated simply and without any added garnish or decoration.`;

function costOf(model, usage) {
  const p = PRICING[model];
  const d = usage.output_tokens_details ?? {};
  const imageOut = d.image_tokens ?? usage.output_tokens ?? 0;
  const textOut = d.text_tokens ?? 0;
  return (usage.input_tokens * p.textIn + textOut * p.textOut + imageOut * p.imageOut) / 1_000_000;
}

function loadRecipes() {
  const ids = RECIPES.map((r) => `'${r.id}'`).join(",");
  const sql = `copy (select json_agg(json_build_object('id',id,'title',title,'image_prompt',image_prompt,'url',generated_image_url))::jsonb from recipes where id in (${ids})) to stdout`;
  const out = execFileSync("node", ["scripts/events/query.mjs", "prod", sql], {
    cwd: REPO,
    encoding: "utf8",
  });
  const rows = JSON.parse(out.trim().replace(/\\\\/g, "\\"));
  return RECIPES.map((r) => ({ ...r, ...rows.find((x) => x.id === r.id) }));
}

async function generate(variant, prompt, attempt = 0) {
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: variant.model,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: variant.quality,
      output_format: "webp",
      output_compression: 80,
    }),
    signal: AbortSignal.timeout(180000),
  });
  const ms = Date.now() - started;
  const json = await res.json().catch(() => ({}));
  // L'org est plafonnée à 5 images/min tous modèles gpt-image confondus : on
  // attend la fenêtre suivante plutôt que d'échouer.
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 15000));
    return generate(variant, prompt, attempt + 1);
  }
  if (!res.ok) throw new Error(`${variant.key} ${res.status} ${json.error?.message}`);
  return { ms, usage: json.usage, bytes: Buffer.from(json.data[0].b64_json, "base64") };
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const recipes = loadRecipes();
  // Reprise : on garde les cases déjà réussies d'un passage précédent.
  const previous = await readFile(path.join(OUT, "results.json"), "utf8").then(
    JSON.parse,
    () => [],
  );
  const results = [];
  for (const recipe of recipes) {
    // Image prod actuelle (référence de style de la grille existante).
    const prodRes = await fetch(recipe.url);
    await writeFile(
      path.join(OUT, `${recipe.id}__prod.webp`),
      Buffer.from(await prodRes.arrayBuffer()),
    );
    // Variantes en parallèle par recette (latences comparables, même minute).
    const row = await Promise.all(
      VARIANTS.map(async (v) => {
        const done = previous
          .find((p) => p.id === recipe.id)
          ?.runs.find((x) => x.variant === v.key && !x.error);
        if (done) return done;
        try {
          const g = await generate(v, prodPrompt(recipe.image_prompt));
          const file = `${recipe.id}__${v.key}.webp`;
          await writeFile(path.join(OUT, file), g.bytes);
          const cost = costOf(v.model, g.usage);
          console.log(
            `${recipe.title} · ${v.key} · ${g.ms} ms · $${cost.toFixed(4)} · ${g.bytes.length >> 10} Ko`,
          );
          return { variant: v.key, file, ms: g.ms, usage: g.usage, cost, kb: g.bytes.length >> 10 };
        } catch (err) {
          console.error(String(err));
          return { variant: v.key, error: String(err) };
        }
      }),
    );
    const kept = (previous.find((p) => p.id === recipe.id)?.runs ?? []).filter(
      (x) => !VARIANTS.some((v) => v.key === x.variant),
    );
    results.push({ ...recipe, runs: [...kept, ...row] });
    await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  }
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  return results;
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function html(results) {
  const avg = (key, f) => {
    const xs = results
      .map((r) => r.runs.find((x) => x.variant === key))
      .filter((x) => x && !x.error)
      .map(f);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const head = VARIANTS.map(
    (v) =>
      `<th>${esc(v.label)}<br><small>moy. $${avg(v.key, (x) => x.cost).toFixed(4)} · ${(avg(v.key, (x) => x.ms) / 1000).toFixed(1)} s</small></th>`,
  ).join("");
  const rows = results
    .map((r) => {
      const cells = VARIANTS.map((v) => {
        const x = r.runs.find((y) => y.variant === v.key);
        if (!x || x.error) return `<td class="err">${esc(x?.error ?? "—")}</td>`;
        return `<td><a href="${x.file}"><img src="${x.file}" loading="lazy"></a><div class="m">$${x.cost.toFixed(4)} · ${(x.ms / 1000).toFixed(1)} s · ${x.kb} Ko</div></td>`;
      }).join("");
      return `<tr><th class="r">${esc(r.title)}<br><small>${esc(r.profile)}</small><details><summary>prompt</summary><p>${esc(prodPrompt(r.image_prompt))}</p></details></th><td><a href="${r.id}__prod.webp"><img src="${r.id}__prod.webp"></a><div class="m">image en prod (gpt-image-1.5 low)</div></td>${cells}</tr>`;
    })
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Banc image — ${new Date().toISOString().slice(0, 10)}</title>
<style>body{font:14px system-ui;margin:16px;background:#faf8f5}table{border-collapse:collapse}th,td{padding:6px;vertical-align:top;text-align:left}
thead th{position:sticky;top:0;background:#faf8f5;font-size:13px}th.r{width:170px}img{width:210px;height:210px;object-fit:cover;border-radius:10px;display:block}
.m{font-size:12px;color:#666;margin-top:3px}.err{color:#b00;font-size:12px;width:210px}details p{font-weight:normal;font-size:11px;color:#555}</style>
<h1>Banc d'essai image — ${new Date().toISOString().slice(0, 10)}</h1>
<p>Même <code>image_prompt</code> + même suffixe de style que la prod, 1024×1024, WebP 80. Coût = tokens réels × tarif public. Cliquer une image pour la taille réelle.</p>
<table><thead><tr><th></th><th>Prod actuelle</th>${head}</tr></thead><tbody>
${rows}
</tbody></table>`;
}

const results = process.argv.includes("--html-only")
  ? JSON.parse(await readFile(path.join(OUT, "results.json"), "utf8"))
  : await run();
await writeFile(path.join(OUT, `${PLANCHE}.html`), html(results));
console.log(`\nPlanche : ${path.join(OUT, `${PLANCHE}.html`)}`);
