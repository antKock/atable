#!/usr/bin/env node
// Rapport du banc « OCR sur l'appareil » : lit les sorties (bench-ocr-pool.mjs)
// et les jugements (judge-ocr-pool.mjs), puis donne
//  1. le score moyen /30 et les erreurs graves par variante et par catégorie ;
//  2. la moyenne pondérée par la répartition des cas (--weights=screenshot:0.7,…) ;
//  3. la justesse du `kind` de gpt-4o (étape 1) contre la catégorie du pool ;
//  4. la simulation de critères de secours (repasser par gpt-4o) : taux de
//     secours, erreurs non rattrapées, secours inutiles, score et coût obtenus.
// Usage : node scripts/bench/ocr-pool/report-ocr-pool.mjs [--weights=screenshot:0.7,printed_photo:0.25,handwritten:0.05] [--json]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadPool, OUT } from "./bench-ocr-pool.mjs";

const argv = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, "").split("="))
    .map(([k, v]) => [k, v ?? true]),
);
const WEIGHTS = Object.fromEntries(
  (argv.weights ?? "screenshot:0.7,printed_photo:0.25,handwritten:0.05")
    .split(",")
    .map((kv) => kv.split(":"))
    .map(([k, v]) => [k, Number(v)]),
);
// Écart de facturation constaté (Costs API vs estimation au token, analyse du 2026-09-18).
const BILLING_FACTOR = 1.21;
const JUDGE_NOISE = 2.7;
const CATS = ["screenshot", "printed_photo", "handwritten"];

const readJson = async (p) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
};

const pool = await loadPool();
let rows = [];
for (const c of pool) {
  const judge = await readJson(path.join(OUT, "_judge", `${c.id}.json`));
  if (!judge) continue;
  const outputs = {};
  for (const v of Object.keys(judge.scores))
    outputs[v] = await readJson(path.join(OUT, v, `${c.id}.json`));
  rows.push({ c, judge, outputs });
}
// Cible ambiguë : sur une page IMPRIMÉE à plusieurs recettes (vieux livres,
// magazines), une variante a extrait une recette voisine — on ne sait pas
// laquelle la personne visait. Comptés par défaut (une mauvaise recette reste
// un échec vécu) ; --sans-ambigus les retire pour isoler la qualité de LECTURE.
// Pas appliqué aux manuscrits : le juge y signale « autre recette » quand la
// lecture est du charabia, les retirer avantagerait Vision.
const ambiguous = rows.filter(
  (r) =>
    r.c.category === "printed_photo" && Object.values(r.judge.scores).some((s) => s.wrong_recipe),
);
if (argv["sans-ambigus"]) rows = rows.filter((r) => !ambiguous.includes(r));
console.log(
  `Pages imprimées à cible ambiguë ${argv["sans-ambigus"] ? "EXCLUES" : "incluses"} (${ambiguous.length}) : ${ambiguous.map((r) => r.c.id).join(", ") || "aucune"}\n`,
);
const variants = [...new Set(rows.flatMap((r) => Object.keys(r.judge.scores)))];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");

// ---------- 1. Scores par catégorie ----------
const byCat = {};
for (const cat of CATS) {
  const rs = rows.filter((r) => r.c.category === cat);
  byCat[cat] = { n: rs.length };
  for (const v of variants) {
    const s = rs.map((r) => r.judge.scores[v]).filter(Boolean);
    byCat[cat][v] = {
      score: mean(s.map((x) => x.total)),
      err: mean(s.map((x) => x.major_errors)),
      zeroErr: s.filter((x) => x.major_errors === 0).length / (s.length || 1),
    };
  }
}
console.log("=== 1. Score moyen /30 (erreurs graves par recette) par catégorie");
console.log(
  `${"variante".padEnd(14)}${CATS.map((c) => `${c} (n=${byCat[c].n})`.padEnd(26)).join("")}pondéré`,
);
const weighted = {};
for (const v of variants) {
  const w = CATS.reduce((s, c) => s + (WEIGHTS[c] ?? 0) * (byCat[c][v]?.score ?? 0), 0);
  const we = CATS.reduce((s, c) => s + (WEIGHTS[c] ?? 0) * (byCat[c][v]?.err ?? 0), 0);
  weighted[v] = { score: w, err: we };
  console.log(
    `${v.padEnd(14)}${CATS.map((c) => `${fmt(byCat[c][v].score)} (${fmt(byCat[c][v].err, 2)} err)`.padEnd(26)).join("")}${fmt(w)} (${fmt(we, 2)} err)`,
  );
}
console.log(`Pondération : ${JSON.stringify(WEIGHTS)} — bruit du juge ±${JUDGE_NOISE} pts`);

// Sous-types (captures web / app, scans anciens / mises en page modernes…)
console.log("\n=== Par sous-type (score moyen /30)");
const subtypes = [...new Set(rows.map((r) => `${r.c.category}/${r.c.subtype}`))].sort();
for (const st of subtypes) {
  const rs = rows.filter((r) => `${r.c.category}/${r.c.subtype}` === st);
  console.log(
    `  ${st.padEnd(34)} n=${String(rs.length).padEnd(3)} ${variants.map((v) => `${v} ${fmt(mean(rs.map((r) => r.judge.scores[v]?.total).filter((x) => x != null)))}`).join(" · ")}`,
  );
}

// ---------- 2. Justesse de `kind` ----------
console.log("\n=== 2. `kind` de gpt-4o contre la catégorie du pool");
const confusion = {};
for (const r of rows) {
  const k = r.outputs["gpt-4o"]?.output?.kind ?? "(absent)";
  confusion[r.c.category] ??= {};
  confusion[r.c.category][k] = (confusion[r.c.category][k] ?? 0) + 1;
}
for (const [cat, m] of Object.entries(confusion))
  console.log(`  ${cat.padEnd(14)} → ${JSON.stringify(m)}`);

// ---------- 3. Critères de secours ----------
// « Lecture mauvaise » : la variante texte fait nettement pire que gpt-4o sur le
// cas (au-delà de 2× le bruit du juge) OU commet au moins 2 erreurs graves de
// plus. Un secours sur un cas « non mauvais » est un secours inutile.
const isBad = (s, ref) =>
  ref.total - s.total > 2 * JUDGE_NOISE || s.major_errors - ref.major_errors >= 2;

const nIngr = (o) =>
  (o?.ingredients ?? "").split("\n").filter((l) => l.trim() && !l.startsWith("//")).length;
const nSteps = (o) =>
  (o?.steps ?? "").split("\n").filter((l) => l.trim() && !l.startsWith("//")).length;

const CRITERIA = {
  jamais: () => false,
  "qualité ≠ good": (o) => o.output.ocr_quality !== "good",
  "qualité = poor": (o) => o.output.ocr_quality === "poor",
  "confiance pondérée < 0,8": (o) => o.signals.weightedConf < 0.8,
  "confiance pondérée < 0,9": (o) => o.signals.weightedConf < 0.9,
  "part de caractères peu sûrs > 20 %": (o) => o.signals.lowConfCharShare > 0.2,
  "< 2 ingrédients ou 0 étape": (o) => nIngr(o.output) < 2 || nSteps(o.output) === 0,
  "qualité ≠ good OU < 2 ingr./0 étape": (o) =>
    o.output.ocr_quality !== "good" || nIngr(o.output) < 2 || nSteps(o.output) === 0,
  "qualité = poor OU confiance < 0,8": (o) =>
    o.output.ocr_quality === "poor" || o.signals.weightedConf < 0.8,
  "qualité ≠ good OU confiance < 0,8": (o) =>
    o.output.ocr_quality !== "good" || o.signals.weightedConf < 0.8,
  // Critère retenu (synthèse docs/specs/ocr-appareil/00-synthese.md §4)
  "poor OU (doubtful ET confiance < 0,9)": (o) =>
    o.output.ocr_quality === "poor" ||
    (o.output.ocr_quality === "doubtful" && o.signals.weightedConf < 0.9),
  toujours: () => true,
};

const costs = {};
for (const v of variants)
  costs[v] = mean(rows.map((r) => r.outputs[v]?.costUsd).filter((x) => x != null)) * BILLING_FACTOR;

const report = { byCat, weighted, confusion, criteria: {}, costs };
for (const base of variants.filter((v) => v.endsWith("lunaq"))) {
  console.log(`\n=== 3. Secours vers gpt-4o — base ${base} (pondéré par catégorie)`);
  console.log(
    `${"critère".padEnd(38)}${"secours".padEnd(10)}${"non rattr.".padEnd(12)}${"inutiles".padEnd(10)}${"score".padEnd(8)}${"err".padEnd(7)}coût/import`,
  );
  for (const [name, crit] of Object.entries(CRITERIA)) {
    const agg = { fb: 0, missed: 0, useless: 0, score: 0, err: 0, cost: 0 };
    const perCat = {};
    for (const cat of CATS) {
      const rs = rows.filter(
        (r) => r.c.category === cat && r.outputs[base] && r.judge.scores[base],
      );
      if (!rs.length) continue;
      let fb = 0,
        missed = 0,
        useless = 0,
        score = 0,
        err = 0,
        cost = 0;
      for (const r of rs) {
        const s = r.judge.scores[base];
        const ref = r.judge.scores["gpt-4o"];
        const bad = isBad(s, ref);
        const f = crit(r.outputs[base]);
        fb += f;
        if (!f && bad) missed++;
        if (f && !bad) useless++;
        score += f ? ref.total : s.total;
        err += f ? ref.major_errors : s.major_errors;
        cost +=
          r.outputs[base].costUsd * BILLING_FACTOR +
          (f ? r.outputs["gpt-4o"].costUsd * BILLING_FACTOR : 0);
      }
      const n = rs.length;
      perCat[cat] = {
        fb: fb / n,
        missed: missed / n,
        useless: useless / n,
        score: score / n,
        err: err / n,
        cost: cost / n,
      };
      const w = WEIGHTS[cat] ?? 0;
      for (const k of Object.keys(agg)) agg[k] += w * perCat[cat][k];
    }
    report.criteria[`${base} | ${name}`] = { ...agg, perCat };
    console.log(
      `${name.padEnd(38)}${`${fmt(agg.fb * 100, 0)} %`.padEnd(10)}${`${fmt(agg.missed * 100, 0)} %`.padEnd(12)}${`${fmt(agg.useless * 100, 0)} %`.padEnd(10)}${fmt(agg.score).padEnd(8)}${fmt(agg.err, 2).padEnd(7)}${fmt(agg.cost * 100, 3)} ¢`,
    );
    if (argv.detail)
      for (const [cat, p] of Object.entries(perCat))
        console.log(
          `    ${cat.padEnd(14)} secours ${fmt(p.fb * 100, 0)} % · non rattr. ${fmt(p.missed * 100, 0)} % · inutiles ${fmt(p.useless * 100, 0)} % · ${fmt(p.score)}/30`,
        );
  }
}

console.log("\n=== Coût moyen mesuré par appel (× 1,21 facturation réelle)");
for (const [v, c] of Object.entries(costs)) console.log(`  ${v.padEnd(14)} ${fmt(c * 100, 3)} ¢`);

if (argv.json) console.log(JSON.stringify(report, null, 1));
