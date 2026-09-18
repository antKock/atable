#!/usr/bin/env node
// Banc « OCR sur l'appareil » (chantier du 2026-09-18) : sur le pool public
// (manifestes scripts/bench/ocr-pool/manifest-*.json, images hors git dans
// fixtures/ocr-pool/), compare trois chemins d'import photo :
//  - gpt-4o      : le chemin de prod (images → gpt-4o, prompt et schéma de prod) ;
//  - vision+luna : Apple Vision VNRecognizeTextRequest (iOS 13+) sur le Mac,
//                  texte → gpt-5.6-luna (prompt d'extraction de prod) ;
//  - vdoc+luna   : Apple Vision RecognizeDocumentsRequest (iOS 26+), idem.
// Chaque sortie est mise en cache (results/ocr-pool/<variante>/<id>.json) : un
// relancement ne refait que ce qui manque. Le jugement est dans judge-ocr-pool.mjs.
//
// Usage : swiftc -O -parse-as-library scripts/bench/ocr-pool/vision-ocr.swift -o /tmp/vision-ocr
//         node scripts/bench/ocr-pool/bench-ocr-pool.mjs [--only=<variante>] [--limit=N] [--ids=a,b]
import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "../../lib/env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
export const POOL = path.join(REPO, "scripts/bench/fixtures/ocr-pool");
export const OUT = path.join(REPO, "scripts/bench/results/ocr-pool");
const VISION_BIN = process.env.VISION_BIN ?? "/tmp/vision-ocr";
const OPENAI_KEY = loadEnvLocal(path.join(REPO, ".env.local")).OPENAI_SERVICE_KEY;

// Tarifs $/M tokens (copie de src/lib/ai-cost.ts TOKEN_PRICING).
export const PRICING = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
};

// ---------- Prompt et schéma de PROD, relus depuis src/lib/import.ts ----------
// (pas de copie à la main : le banc teste exactement ce que la prod envoie)
const importSrc = await readFile(path.join(REPO, "src/lib/import.ts"), "utf8");
const enrichSrc = await readFile(path.join(REPO, "src/lib/schemas/enrichment.ts"), "utf8");
const enumOf = (name) =>
  [
    ...enrichSrc
      .match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`))[1]
      .matchAll(/"([^"]*)"/g),
  ].map((m) => m[1]);
const ENUMS = {
  VALID_SEASONS: enumOf("VALID_SEASONS"),
  VALID_PREP_TIMES: enumOf("VALID_PREP_TIMES"),
  VALID_COOK_TIMES: enumOf("VALID_COOK_TIMES"),
  VALID_COST_LEVELS: enumOf("VALID_COST_LEVELS"),
  VALID_COMPLEXITY_LEVELS: enumOf("VALID_COMPLEXITY_LEVELS"),
};
const IMAGE_KINDS = ["screenshot", "printed_photo", "handwritten", "other"];
const template = (name) =>
  importSrc
    .match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`))[1]
    .replace(/\$\{(VALID_[A-Z_]+)\.join\(", "\)\}/g, (_, k) => ENUMS[k].join(", "))
    .replaceAll("\\n", "\n");
export const SYSTEM_PROMPT = template("EXTRACTION_SYSTEM_PROMPT");
const OCR_USER_PROMPT = template("OCR_USER_PROMPT");

const BASE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    ingredients: { type: ["string", "null"] },
    steps: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    prepTime: { type: ["string", "null"], enum: [...ENUMS.VALID_PREP_TIMES, null] },
    cookTime: { type: ["string", "null"], enum: [...ENUMS.VALID_COOK_TIMES, null] },
    cost: { type: ["string", "null"], enum: [...ENUMS.VALID_COST_LEVELS, null] },
    complexity: { type: ["string", "null"], enum: [...ENUMS.VALID_COMPLEXITY_LEVELS, null] },
    seasons: { type: "array", items: { type: "string", enum: ENUMS.VALID_SEASONS } },
    servings: { type: ["integer", "null"] },
  },
  required: [
    "title",
    "ingredients",
    "steps",
    "notes",
    "prepTime",
    "cookTime",
    "cost",
    "complexity",
    "seasons",
    "servings",
  ],
  additionalProperties: false,
};
const IMPORT_SCHEMA = { name: "recipe_import", strict: true, schema: BASE_SCHEMA };
const OCR_SCHEMA = {
  name: "recipe_import_ocr",
  strict: true,
  schema: {
    ...BASE_SCHEMA,
    properties: { ...BASE_SCHEMA.properties, kind: { type: "string", enum: IMAGE_KINDS } },
    required: [...BASE_SCHEMA.required, "kind"],
  },
};

// Chemin texte proposé : le texte lu sur l'appareil part au serveur, structuré
// par luna. Consigne dédiée (bruit d'OCR, éléments d'interface, ordre imparfait).
export const VISION_USER_PREFIX =
  "Extrais la recette depuis ce texte lu par reconnaissance de caractères sur une ou plusieurs images (capture d'écran ou photo). Le texte peut contenir des erreurs de lecture, des éléments d'interface ou de publicité à ignorer, et l'ordre des lignes peut être imparfait :";

// Variante « auto-évaluation » : luna juge aussi la lecture dans le même appel
// (candidat au critère de secours, étape 4). Champ placé en dernier.
const QUALITY_SCHEMA = {
  name: "recipe_import_ocr_text",
  strict: true,
  schema: {
    ...BASE_SCHEMA,
    properties: {
      ...BASE_SCHEMA.properties,
      ocr_quality: { type: "string", enum: ["good", "doubtful", "poor"] },
    },
    required: [...BASE_SCHEMA.required, "ocr_quality"],
  },
};
export const QUALITY_INSTRUCTION = `Indique aussi dans ocr_quality la qualité de la LECTURE (pas de la recette) :
- good : texte lu proprement, quantités et ingrédients lisibles sans deviner ;
- doubtful : plusieurs mots ou quantités mal lus que tu as dû deviner ou corriger ;
- poor : texte en grande partie illisible, incohérent ou tronqué au point de ne pas pouvoir extraire la recette sans inventer.
Une recette simplement incomplète (la capture ne montre qu'une partie) mais bien lue reste good.`;

// ---------- Pool ----------
// `--manifest=<fichier>` : pool supplémentaire — par exemple les envois réels
// gardés 30 jours (scripts/import-samples/pull.mjs → manifest-real.json), dont
// les chemins sont relatifs au dossier du manifeste (`baseDir`).
export async function loadPool(extraManifest = argvFlag("manifest")) {
  const files = (await readdir(HERE)).filter((f) => /^manifest-.*\.json$/.test(f));
  const cases = [];
  for (const f of files) cases.push(...JSON.parse(await readFile(path.join(HERE, f), "utf8")));
  if (extraManifest) {
    const baseDir = path.dirname(path.resolve(extraManifest));
    const extra = JSON.parse(await readFile(extraManifest, "utf8"));
    cases.push(...extra.map((c) => ({ ...c, baseDir })));
  }
  return cases;
}

function argvFlag(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}

// ---------- Appels ----------
async function chat(body) {
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    const json = await res.json();
    if (res.ok) return { json, ms: Date.now() - started };
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${res.status} ${json?.error?.message ?? ""}`);
  }
}

function costOf(model, usage) {
  const p = PRICING[model];
  return ((usage?.prompt_tokens ?? 0) * p.input + (usage?.completion_tokens ?? 0) * p.output) / 1e6;
}

async function runGpt4o(c) {
  const images = await Promise.all(
    c.images.map(async (img) => ({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${(await readFile(path.join(c.baseDir ?? POOL, img))).toString("base64")}`,
      },
    })),
  );
  const { json, ms } = await chat({
    model: "gpt-4o",
    response_format: { type: "json_schema", json_schema: OCR_SCHEMA },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: [{ type: "text", text: OCR_USER_PROMPT }, ...images] },
    ],
  });
  const output = JSON.parse(json.choices[0].message.content);
  return { output, ms, usage: json.usage, costUsd: costOf("gpt-4o", json.usage) };
}

/** Lecture Vision (cache commun aux variantes qui la partagent). */
async function readVision(c, doc) {
  const file = path.join(OUT, doc ? "_vision-doc" : "_vision", `${c.id}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* pas en cache */
  }
  const args = [...(doc ? ["--doc"] : []), ...c.images.map((i) => path.join(c.baseDir ?? POOL, i))];
  const raw = JSON.parse(
    execFileSync(VISION_BIN, args, { maxBuffer: 64 * 1024 * 1024 }).toString(),
  );
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(raw));
  return raw;
}

/** Texte envoyé au serveur : une section par image, dans l'ordre d'envoi. */
export function visionText(raw, doc) {
  return raw.images
    .map((im, i) => {
      const body =
        doc && im.transcript != null ? im.transcript : im.lines.map((l) => l.text).join("\n");
      return raw.images.length > 1 ? `[Image ${i + 1}]\n${body}` : body;
    })
    .join("\n\n");
}

/** Signaux disponibles sur l'appareil, pour le critère de secours (étape 4). */
export function visionSignals(raw, text) {
  const lines = raw.images.flatMap((im) => im.lines);
  const n = lines.length || 1;
  const chars = lines.reduce((s, l) => s + l.text.length, 0) || 1;
  return {
    nImages: raw.images.length,
    nLines: lines.length,
    nChars: text.length,
    meanConf: lines.reduce((s, l) => s + l.confidence, 0) / n,
    // Confiance pondérée par la longueur (une ligne longue pèse plus qu'un « + »)
    weightedConf: lines.reduce((s, l) => s + l.confidence * l.text.length, 0) / chars,
    lowConfShare: lines.filter((l) => l.confidence < 0.5).length / n,
    lowConfCharShare:
      lines.filter((l) => l.confidence < 0.5).reduce((s, l) => s + l.text.length, 0) / chars,
    visionMs: raw.images.reduce((s, im) => s + im.ms, 0),
  };
}

async function runVisionLuna(c, doc, quality = false) {
  const raw = await readVision(c, doc);
  const text = visionText(raw, doc);
  const { json, ms } = await chat({
    model: "gpt-5.6-luna",
    reasoning_effort: "none",
    response_format: {
      type: "json_schema",
      json_schema: quality ? QUALITY_SCHEMA : IMPORT_SCHEMA,
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: quality
          ? `${VISION_USER_PREFIX}\n\n${text}\n\n${QUALITY_INSTRUCTION}`
          : `${VISION_USER_PREFIX}\n\n${text}`,
      },
    ],
  });
  const output = JSON.parse(json.choices[0].message.content);
  return {
    output,
    ms,
    usage: json.usage,
    costUsd: costOf("gpt-5.6-luna", json.usage),
    visionText: text,
    signals: visionSignals(raw, text),
  };
}

export const VARIANTS = {
  "gpt-4o": runGpt4o,
  "vision+luna": (c) => runVisionLuna(c, false),
  "vdoc+luna": (c) => runVisionLuna(c, true),
  "vision+lunaq": (c) => runVisionLuna(c, false, true),
  "vdoc+lunaq": (c) => runVisionLuna(c, true, true),
};

// ---------- Exécution ----------
async function main() {
  const argv = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.replace(/^--/, "").split("="))
      .map(([k, v]) => [k, v ?? true]),
  );
  let cases = await loadPool();
  if (argv.ids) cases = cases.filter((c) => argv.ids.split(",").includes(c.id));
  if (argv.limit) cases = cases.slice(0, Number(argv.limit));
  const variants = argv.only ? [argv.only] : Object.keys(VARIANTS);
  console.log(`${cases.length} cas × ${variants.join(", ")}`);

  const queue = cases.flatMap((c) => variants.map((v) => ({ c, v })));
  let done = 0;
  let spent = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const file = path.join(OUT, job.v, `${job.c.id}.json`);
      try {
        await access(file);
        done++;
        continue;
      } catch {
        /* à faire */
      }
      try {
        const r = await VARIANTS[job.v](job.c);
        spent += r.costUsd;
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify({ id: job.c.id, variant: job.v, ...r }, null, 1));
      } catch (err) {
        console.error(`  ✗ ${job.v} ${job.c.id} — ${err.message}`);
      }
      done++;
      if (done % 10 === 0) console.log(`  ${done} faits, ${spent.toFixed(3)} $ dépensés`);
    }
  };
  await Promise.all(Array.from({ length: Number(argv.concurrency ?? 4) }, worker));
  console.log(`Terminé — ${spent.toFixed(3)} $ dépensés sur ce passage. Sorties : ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
