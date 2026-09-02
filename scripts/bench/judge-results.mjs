#!/usr/bin/env node
// Évalue la qualité des sorties du banc d'essai (scripts/bench/results/results.json) :
//  - transcription : WER vs le script de dictée (vérité terrain exacte)
//  - structuration texte / OCR / enrichissement : juge LLM (gpt-5.6-sol) en
//    aveugle — candidats anonymisés A/B/C, ordre mélangé par cas.
// Usage : node scripts/bench/judge-results.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(ROOT, "fixtures");
const OUT = path.join(ROOT, "results");
const REPO = path.resolve(ROOT, "../..");

const envFile = await readFile(path.join(REPO, ".env.local"), "utf8");
const OPENAI_KEY = envFile.match(/^OPENAI_SERVICE_KEY=(.+)$/m)?.[1]?.trim();
const JUDGE_MODEL = "gpt-5.6-sol";

const results = JSON.parse(await readFile(path.join(OUT, "results.json"), "utf8"));

// ---------- WER ----------
function normalizeWords(s) {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.,;:!?'"«»„“”()\[\]…\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function wer(refText, hypText) {
  const ref = normalizeWords(refText);
  const hyp = normalizeWords(hypText);
  const d = Array.from({ length: ref.length + 1 }, (_, i) =>
    Array.from({ length: hyp.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      const sub = d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      d[i][j] = Math.min(sub, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  return ref.length ? d[ref.length][hyp.length] / ref.length : 0;
}

console.log("=== Transcription — WER vs script de dictée (plus bas = mieux)");
const werRows = [];
for (const r of results.audio) {
  if (r.error) continue;
  const w = wer(r.reference, r.text);
  werRows.push({ label: r.label, model: r.model, wer: w, ms: r.ms, costUsd: r.costUsd });
  console.log(`  ${r.label} × ${r.model} — WER ${(w * 100).toFixed(1)}%`);
}

// ---------- Juge LLM ----------
async function judge(caseLabel, sourceDescription, source, candidates, rubric) {
  // Ordre aveugle stable : tri par hash du couple cas+modèle.
  const shuffled = [...candidates].sort((a, b) => {
    const h = (s) => [...(caseLabel + s)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    return h(a.model) - h(b.model);
  });
  const letters = ["A", "B", "C", "D"];
  const mapping = Object.fromEntries(shuffled.map((c, i) => [letters[i], c.model]));
  const blocks = shuffled
    .map((c, i) => `--- Candidat ${letters[i]} ---\n${JSON.stringify(c.output, null, 1)}`)
    .join("\n\n");

  const schema = {
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
              comment: { type: "string" },
            },
            required: ["candidate", "completeness", "fidelity", "format", "comment"],
            additionalProperties: false,
          },
        },
        ranking: { type: "array", items: { type: "string" } },
      },
      required: ["scores", "ranking"],
      additionalProperties: false,
    },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      reasoning_effort: "medium",
      response_format: { type: "json_schema", json_schema: schema },
      messages: [
        {
          role: "system",
          content: `Tu es un évaluateur exigeant d'extractions de recettes de cuisine. On te donne une SOURCE et ${shuffled.length} extractions JSON candidates anonymisées produites par des modèles différents à partir de cette source. Évalue chaque candidat de 0 à 10 sur :
- completeness : tous les ingrédients/étapes/métadonnées présents dans la source sont extraits (rien d'oublié)
- fidelity : rien d'inventé (quantités, notes, servings, temps), les corrections orales sont bien résolues, les valeurs d'enum sont sensées
- format : respect des règles — pas de puces/numéros en début de ligne, sections « // Nom » uniquement si la source en a, notes = uniquement astuce explicite de la source (null sinon), une ligne par ingrédient/étape
${rubric}
Termine par un classement du meilleur au moins bon (les ex æquo sont autorisés dans les scores mais tranche dans le ranking). Sois précis et cite les différences concrètes dans les commentaires.`,
        },
        { role: "user", content: `${sourceDescription}\n\nSOURCE :\n${source}\n\nCANDIDATS :\n\n${blocks}` },
      ],
    }),
    signal: AbortSignal.timeout(300000),
  });
  const json = await res.json();
  if (!res.ok) return { caseLabel, error: json?.error?.message ?? res.status };
  const parsed = JSON.parse(json.choices[0].message.content);
  return { caseLabel, mapping, ...parsed };
}

function collect(task, label) {
  return results[task].filter((r) => r.label === label && !r.error);
}

const judgements = { text: [], ocr: [], enrich: [] };

// Structuration texte : source = le texte fourni au modèle.
for (const label of ["marmiton-ratatouille", "cuisineaz-sauce-pommes", "750g-tarte-pommes", "insta-caption", "voice-fr-hesitations", "voice-pt-caldo"]) {
  const file = label === "insta-caption" ? "insta-caption" : label;
  const source = await readFile(path.join(FIX, "text", `${file}.txt`), "utf8");
  const j = await judge(
    `text/${label}`,
    label.startsWith("voice")
      ? "La source est une transcription orale (hésitations et corrections possibles ; la recette doit être en français même si la dictée ne l'est pas — sauf le titre qui peut garder son nom d'origine)."
      : "La source est le texte brut d'une page web ou d'une caption Instagram (bruit publicitaire possible).",
    source,
    collect("text", label),
    "",
  );
  judgements.text.push(j);
  console.log(`juge text/${label} — ${j.error ?? j.ranking?.join(" > ")}`);
}

// OCR : source de référence = texte nettoyé de la même page (les captures
// peuvent avoir un bandeau cookies qui masque le titre — pénalise un titre
// inventé, pas un titre déduit raisonnablement du contenu).
for (const label of ["marmiton-ratatouille", "cuisineaz-sauce-pommes", "750g-tarte-pommes"]) {
  const source = await readFile(path.join(FIX, "text", `${label}.txt`), "utf8");
  const j = await judge(
    `ocr/${label}`,
    "Les candidats ont travaillé sur des CAPTURES D'ÉCRAN de la page dont voici le texte de référence. Un bandeau cookies masquait parfois le titre sur l'image : un titre raisonnablement déduit du contenu est acceptable, un contenu inventé non.",
    source,
    collect("ocr", label),
    "",
  );
  judgements.ocr.push(j);
  console.log(`juge ocr/${label} — ${j.error ?? j.ranking?.join(" > ")}`);
}

// Enrichissement : source = la recette structurée ; rubrique adaptée aux tags.
// Copie des recettes d'entrée du bench (ENRICH_RECIPES de bench-models.mjs).
const ENRICH_SOURCES = {
  ratatouille:
    "Titre: Ratatouille\nIngrédients:\n350 g d'aubergines\n350 g de courgettes\n350 g de poivrons\n350 g d'oignons\n500 g de tomates\n6 cuillères à soupe d'huile d'olive\n2 gousses d'ail\n1 brin de thym\n1 feuille de laurier\nsel\npoivre\nPréparation:\nCoupez les légumes en morceaux.\nFaites revenir les oignons dans l'huile d'olive.\nAjoutez les poivrons puis les aubergines et les courgettes.\nAjoutez les tomates, l'ail, le thym et le laurier.\nLaissez mijoter 45 minutes à feu doux.\nSalez et poivrez.",
  "saumon-teriyaki":
    "Titre: Saumon teriyaki au riz\nIngrédients:\n4 pavés de saumon\n10 cl de sauce soja\n2 cuillères à soupe de miel\n1 gousse d'ail\ngingembre frais\n300 g de riz\ngraines de sésame\n2 oignons nouveaux\nPréparation:\nMélangez la sauce soja, le miel, l'ail et le gingembre râpés.\nFaites mariner le saumon 20 minutes.\nFaites cuire le riz.\nSaisissez le saumon à la poêle 3 minutes par face en arrosant de marinade.\nServez sur le riz, parsemé de sésame et d'oignons nouveaux.",
  houmous:
    "Titre: Houmous maison\nIngrédients:\n400 g de pois chiches cuits\n2 cuillères à soupe de tahini\n1 citron\n1 gousse d'ail\n4 cuillères à soupe d'huile d'olive\ncumin\nsel\nPréparation:\nMixez les pois chiches avec le tahini, le jus de citron et l'ail.\nAjoutez l'huile d'olive progressivement jusqu'à obtenir une texture lisse.\nAssaisonnez avec le cumin et le sel.\nServez avec un filet d'huile d'olive.",
};
for (const label of Object.keys(ENRICH_SOURCES)) {
  const candidates = collect("enrich", label);
  const source = ENRICH_SOURCES[label];
  const j = await judge(
    `enrich/${label}`,
    `Les candidats devaient enrichir la recette « ${label} » (métadonnées + tags parmi une liste prédéfinie stricte + prompt d'image en anglais). Évalue la justesse culinaire des tags (régimes STRICTS : pas de Végétarien/Végan si viande/poisson/produit animal), la cohérence temps/coût/complexité/saisons/servings, et un imagePrompt qui ne dépeint QUE les ingrédients listés.`,
    source,
    candidates,
    "- Pour ce cas, completeness = richesse pertinente des tags ; fidelity = aucune erreur factuelle culinaire ; format = imagePrompt en anglais conforme.",
  );
  judgements.enrich.push(j);
  console.log(`juge enrich/${label} — ${j.error ?? j.ranking?.join(" > ")}`);
}

await writeFile(path.join(OUT, "judgements.json"), JSON.stringify({ werRows, judgements }, null, 2));

// Agrégat : score moyen par modèle et par tâche.
console.log("\n=== Scores moyens du juge (complétude+fidélité+format, /30)");
for (const [task, list] of Object.entries(judgements)) {
  const byModel = {};
  for (const j of list) {
    if (j.error) continue;
    for (const s of j.scores) {
      const model = j.mapping[s.candidate];
      if (!model) continue;
      byModel[model] ??= { total: 0, n: 0, wins: 0 };
      byModel[model].total += s.completeness + s.fidelity + s.format;
      byModel[model].n++;
      if (j.mapping[j.ranking[0]] === model) byModel[model].wins += 1 / j.scores.length * j.scores.length;
    }
    const winner = j.mapping[j.ranking[0]];
    if (winner && byModel[winner]) byModel[winner].wins = (byModel[winner].wins ?? 0);
  }
  // wins recompté proprement :
  for (const m of Object.keys(byModel)) byModel[m].wins = 0;
  for (const j of list) {
    if (j.error) continue;
    const winner = j.mapping[j.ranking?.[0]];
    if (winner && byModel[winner]) byModel[winner].wins++;
  }
  console.log(`  ${task}:`);
  for (const [m, s] of Object.entries(byModel)) {
    console.log(`    ${m} — ${(s.total / s.n).toFixed(1)}/30 en moyenne, ${s.wins} victoire(s) sur ${list.filter((j) => !j.error).length}`);
  }
}
console.log(`\nDétail : ${path.join(OUT, "judgements.json")}`);
