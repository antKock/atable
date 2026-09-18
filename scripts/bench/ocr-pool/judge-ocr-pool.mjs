#!/usr/bin/env node
// Juge du banc « OCR sur l'appareil » : pour chaque cas du pool, les sorties des
// variantes (bench-ocr-pool.mjs) sont notées EN AVEUGLE par gpt-5.6-sol contre la
// vérité terrain (JSON-LD, texte injecté ou transcription relue — jamais une
// sortie d'un des modèles testés). Même grille que judge-results.mjs (complétude,
// fidélité, format, /30 ; bruit mesuré ±2,7 pts) + `major_errors` : erreurs qui
// feraient rater le plat (ingrédient manquant ou inventé, quantité fausse, étape
// manquante) — c'est ce qui définit une « lecture mauvaise » pour le secours.
// Cache : results/ocr-pool/_judge/<id>.json (supprimer pour rejuger).
//
// Usage : node scripts/bench/ocr-pool/judge-ocr-pool.mjs [--ids=a,b] [--concurrency=3]
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "../../lib/env.mjs";
import { loadPool, POOL, OUT, VARIANTS } from "./bench-ocr-pool.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const OPENAI_KEY = loadEnvLocal(path.join(REPO, ".env.local")).OPENAI_SERVICE_KEY;
const JUDGE_MODEL = "gpt-5.6-sol";

const SCHEMA = {
  name: "judgement",
  strict: true,
  schema: {
    type: "object",
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            candidate: { type: "string" },
            completeness: { type: "integer" },
            fidelity: { type: "integer" },
            format: { type: "integer" },
            major_errors: { type: "integer" },
            wrong_recipe: { type: "boolean" },
            comment: { type: "string" },
          },
          required: [
            "candidate",
            "completeness",
            "fidelity",
            "format",
            "major_errors",
            "wrong_recipe",
            "comment",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["scores"],
    additionalProperties: false,
  },
};

function truthText(t) {
  return [
    t.title
      ? `Titre : ${t.title}`
      : "Titre : (non visible sur les images — tout titre plausible déduit du contenu est acceptable, ne le note pas)",
    t.servings ? `Portions : ${t.servings}` : null,
    `Ingrédients :\n${t.ingredients.join("\n")}`,
    `Étapes :\n${t.steps.join("\n") || "(aucune visible)"}`,
    t.notes ? `Notes : ${t.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const pick = (o) => ({
  title: o.title,
  ingredients: o.ingredients,
  steps: o.steps,
  notes: o.notes,
  servings: o.servings,
});

async function judgeCase(c, truth, candidates) {
  // Ordre aveugle stable par cas (hash id + variante).
  const h = (s) => [...(c.id + s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const shuffled = [...candidates].sort((a, b) => h(a.variant) - h(b.variant));
  const letters = "ABCDEFGH";
  const mapping = Object.fromEntries(shuffled.map((x, i) => [letters[i], x.variant]));
  const blocks = shuffled
    .map((x, i) => `--- Candidat ${letters[i]} ---\n${JSON.stringify(pick(x.output), null, 1)}`)
    .join("\n\n");
  const context = [
    `Catégorie de l'image source : ${c.category}${c.subtype ? ` (${c.subtype})` : ""}.`,
    truth.truncated
      ? "La vérité terrain est RESTREINTE à ce qui était visible sur les images : ne pénalise pas l'absence de ce qui n'y figurait pas."
      : null,
    truth.format === "prose"
      ? "La recette source est rédigée en prose (livre ancien ou manuscrit) : un découpage raisonnable en ingrédients et étapes est attendu, la liste d'ingrédients de la vérité est indicative."
      : null,
    truth.steps.length === 0
      ? "Aucune étape n'était visible sur les images : un candidat sans étapes est correct, des étapes inventées sont une faute de fidélité."
      : null,
    "Les mots marqués [?] sont illisibles dans la source : ne pénalise pas une lecture plausible à cet endroit.",
  ]
    .filter(Boolean)
    .join(" ");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        reasoning_effort: "medium",
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          {
            role: "system",
            content: `Tu es un évaluateur exigeant d'extractions de recettes de cuisine. Des modèles ont extrait une recette à partir d'IMAGES (captures d'écran, photos de livres, manuscrits) que tu ne vois pas ; on te donne la VÉRITÉ TERRAIN (le contenu réel de la recette) et ${shuffled.length} extractions JSON candidates anonymisées. Évalue chaque candidat de 0 à 10 sur :
- completeness : tous les ingrédients et étapes de la vérité sont présents (rien d'oublié), avec leurs quantités
- fidelity : rien d'inventé ni de déformé (quantités, unités, ingrédients, temps, portions, notes) ; les erreurs de lecture (ex. « 350 г », « signons ») doivent être corrigées ou absentes, jamais recopiées
- format : une ligne par ingrédient/étape, pas de puces/numéros en début de ligne, sections « // Nom » seulement si la source en a, notes = uniquement une astuce explicite de la source (null sinon), pas de texte d'interface ou de publicité
Et major_errors : le NOMBRE d'erreurs qui feraient rater ou changer le plat pour quelqu'un qui cuisine avec cette extraction (ingrédient principal manquant ou inventé, quantité ou unité fausse, étape importante manquante, recette voisine mélangée). Une coquille sans conséquence n'en est pas une.
Et wrong_recipe : true si le candidat a extrait majoritairement une AUTRE recette que celle de la vérité (une recette voisine visible sur la même page : la cible était ambiguë pour lui) ; note-le quand même normalement.
Le titre peut être raisonnablement reformulé (casse, ponctuation). La langue doit être celle de la source. Cite les différences concrètes dans les commentaires.`,
          },
          {
            role: "user",
            content: `${context}\n\nVÉRITÉ TERRAIN :\n${truthText(truth)}\n\nCANDIDATS :\n\n${blocks}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(300000),
    });
    const json = await res.json();
    if (res.ok) {
      const parsed = JSON.parse(json.choices[0].message.content);
      const scores = {};
      for (const s of parsed.scores) {
        const letter = String(s.candidate)
          .trim()
          .match(/([A-H])\s*$/)?.[1];
        const variant = mapping[letter];
        if (!variant) continue;
        scores[variant] = {
          total: s.completeness + s.fidelity + s.format,
          completeness: s.completeness,
          fidelity: s.fidelity,
          format: s.format,
          major_errors: s.major_errors,
          wrong_recipe: s.wrong_recipe,
          comment: s.comment,
        };
      }
      return { id: c.id, mapping, scores, usage: json.usage };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${res.status} ${json?.error?.message ?? ""}`);
  }
}

async function main() {
  const argv = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.replace(/^--/, "").split("="))
      .map(([k, v]) => [k, v ?? true]),
  );
  let cases = await loadPool();
  if (argv.ids) cases = cases.filter((c) => argv.ids.split(",").includes(c.id));
  const queue = [...cases];
  let n = 0;
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const file = path.join(OUT, "_judge", `${c.id}.json`);
      try {
        await access(file);
        continue;
      } catch {
        /* à juger */
      }
      let truth;
      try {
        truth = JSON.parse(await readFile(path.join(c.baseDir ?? POOL, c.truth), "utf8"));
      } catch {
        // Vérités transcrites à la main (manuscrits, licences libres) : copie
        // versionnée dans ocr-pool/truth/, le dossier fixtures/ étant hors git.
        try {
          truth = JSON.parse(await readFile(path.join(HERE, c.truth), "utf8"));
        } catch {
          continue; // cas du manifeste sans vérité (pool en cours de construction)
        }
      }
      const candidates = [];
      for (const v of Object.keys(VARIANTS)) {
        try {
          candidates.push(JSON.parse(await readFile(path.join(OUT, v, `${c.id}.json`), "utf8")));
        } catch {
          /* variante absente pour ce cas */
        }
      }
      if (candidates.length < 2) continue;
      try {
        const j = await judgeCase(c, truth, candidates);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(j, null, 1));
        n++;
        const line = Object.entries(j.scores)
          .map(([v, s]) => `${v} ${s.total}/30 (${s.major_errors} err)`)
          .join(" · ");
        console.log(`  ${c.id} — ${line}`);
      } catch (err) {
        console.error(`  ✗ ${c.id} — ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(argv.concurrency ?? 3) }, worker));
  console.log(`${n} cas jugés.`);
}

await main();
