#!/usr/bin/env node
// Pool de test OCR — partie « pages de livres ou de magazines imprimées,
// photographiées au téléphone » (banc Apple Vision + LLM texte contre gpt-4o
// vision). AUCUN appel à un modèle ici : la vérité terrain est indépendante des
// modèles testés.
//
// Deux familles :
//  A. vraies pages numérisées de livres de cuisine du domaine public
//     (Internet Archive, Gallica) — printed-scans.json : pages à télécharger,
//     vérité = transcription relue à l'œil (OCR d'archive comme base) ;
//  B. mises en page modernes (livre, magazine, fiche) composées en HTML/CSS et
//     rendues par Playwright — printed-modern.json + printed-templates.mjs :
//     vérité = texte injecté, à l'identique.
// Puis distort-printed.py simule la photo à main levée (perspective, courbure,
// double page, table, lumière chaude, ombre, flou, bruit, JPEG) avec une graine
// fixe par image : les sorties sont reproductibles.
//
// Produit (fixtures ignorées par git) :
//  - scripts/bench/fixtures/ocr-pool/printed/<id>-<n>.jpg        (JPEG q85, côté long ≤ 2048)
//  - scripts/bench/fixtures/ocr-pool/printed/clean/<id>-<n>.jpg  (page(s) cible(s) avant déformation)
//  - scripts/bench/fixtures/ocr-pool/printed/_src/…              (téléchargements et rendus, cache)
//  - scripts/bench/fixtures/ocr-pool/truth/<id>.json             (vérité terrain)
//  - scripts/bench/ocr-pool/manifest-printed.json                (métadonnées versionnées)
//
// Usage :
//   node scripts/bench/ocr-pool/build-printed.mjs               # tout
//   node scripts/bench/ocr-pool/build-printed.mjs --only id1,id2
//   node scripts/bench/ocr-pool/build-printed.mjs --scans       # famille A seulement
//   node scripts/bench/ocr-pool/build-printed.mjs --modern      # famille B seulement
// Prérequis : uv (numpy + opencv tirés à la volée), Playwright (chromium) du repo.
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderCase } from "./printed-templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const POOL = path.join(REPO, "scripts/bench/fixtures/ocr-pool");
const OUT = path.join(POOL, "printed");
const SRC = path.join(OUT, "_src");
const TRUTH = path.join(POOL, "truth");
const MANIFEST = path.join(HERE, "manifest-printed.json");
const UA = "MijoteOcrBench/1.0 (banc interne, contact kocken.anthony@gmail.com)";

const args = process.argv.slice(2);
const only =
  args
    .find((a) => a.startsWith("--only"))
    ?.split(/[= ]/)[1]
    ?.split(",") ?? (args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null);
const doScans = !args.includes("--modern");
const doModern = !args.includes("--scans");
const wanted = (id) => !only || only.includes(id);

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

async function download(url, dest) {
  if (await exists(dest)) return;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10000) throw new Error(`réponse trop courte (${buf.length} octets)`);
      await writeFile(dest, buf);
      if (url.includes("gallica.bnf.fr")) await new Promise((r) => setTimeout(r, 3000)); // politesse
      console.log(`  ↓ ${path.basename(dest)} (${Math.round(buf.length / 1024)} Ko)`);
      return;
    } catch (e) {
      if (attempt >= 5) throw new Error(`${url} : ${e.message}`);
      // Gallica limite le débit (429) : on patiente franchement avant de réessayer
      await new Promise((r) => setTimeout(r, (e.status === 429 ? 30000 : 4000) * (attempt + 1)));
    }
  }
}

// Graine stable par image : l'ordre ou le nombre de cas n'influe pas sur les tirages.
const seedOf = (key) => parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16);

const rel = (p) => path.relative(POOL, p).split(path.sep).join("/");

async function main() {
  for (const d of [
    OUT,
    path.join(OUT, "clean"),
    path.join(SRC, "scans"),
    path.join(SRC, "photos"),
    path.join(SRC, "html"),
    path.join(SRC, "render"),
    TRUTH,
  ])
    await mkdir(d, { recursive: true });

  const scans = JSON.parse(
    await readFile(path.join(HERE, "printed-scans.json"), "utf8"),
  ).cases.filter((c) => wanted(c.id));
  const modern = JSON.parse(await readFile(path.join(HERE, "printed-modern.json"), "utf8"));
  const modernCases = modern.cases.filter((c) => wanted(c.id));

  const jobs = []; // pour distort-printed.py
  const entries = new Map(); // id → entrée de manifeste (images complétées après la distorsion)

  // ---------------- Famille A : scans ----------------
  if (doScans) {
    console.log(`Famille A — ${scans.length} cas`);
    for (const c of scans) {
      const files = [];
      const preps = c.pages.map((p) => p.prep ?? null);
      for (const p of c.pages) {
        const dest = path.join(SRC, "scans", p.file);
        await download(p.url, dest);
        files.push(dest);
      }
      const images = [];
      const clean = [];
      c.shots.forEach((shot, k) => {
        const n = k + 1;
        const out = path.join(OUT, `${c.id}-${n}.jpg`);
        const targets = shot.pages.filter((i) => c.target.includes(i));
        const cleanOut = targets.map((_, j) =>
          path.join(
            OUT,
            "clean",
            targets.length > 1 ? `${c.id}-${n}-p${j + 1}.jpg` : `${c.id}-${n}.jpg`,
          ),
        );
        jobs.push({
          id: c.id,
          pages: shot.pages.map((i) => files[i]),
          prep: shot.pages.map((i) => preps[i]),
          clean_prep: targets.map((i) => preps[i]),
          profile: shot.profile,
          seed: seedOf(`${c.id}#${n}`),
          out,
          clean_pages: targets.map((i) => files[i]),
          clean_out: cleanOut,
          binding: null,
        });
        images.push(rel(out));
        clean.push(...cleanOut.map(rel));
      });
      entries.set(c.id, {
        id: c.id,
        category: "printed_photo",
        subtype: "scan-ancien",
        lang: c.lang,
        images,
        clean_images: clean,
        truth: `truth/${c.id}.json`,
        source_url: c.source_url,
        source_title: c.source_title,
        source_date: c.source_date,
        license: c.license,
        license_url: c.license_url,
        provenance: `${c.pages.map((p) => `${p.label} ← ${p.url}`).join(" ; ")} ; ${c.pages.some((p) => p.prep) ? "bords de numérisation recadrés (et niveaux du microfilm ramenés à un papier clair si « paper »), voir `prep` dans printed-scans.json" : "page(s) complète(s), non recadrée(s)"}, puis photo simulée (distort-printed.py)`,
        distortions: [],
        difficulty: c.difficulty,
        truth_method: c.truth_method,
        notes: c.notes,
        _truth: c.truth,
      });
    }
  }

  // ---------------- Famille B : mises en page modernes ----------------
  if (doModern && modernCases.length) {
    console.log(`Famille B — ${modernCases.length} cas`);
    const photos = {};
    for (const [key, ph] of Object.entries(modern.photos)) {
      const dest = path.join(SRC, "photos", ph.file);
      await download(ph.url, dest);
      photos[key] = pathToFileURL(dest).href;
    }
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const shoot = async (html, width, height, name) => {
      const htmlPath = path.join(SRC, "html", `${name}.html`);
      const png = path.join(SRC, "render", `${name}.png`);
      await writeFile(htmlPath, html);
      await page.setViewportSize({ width, height });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      // garde-fou : aucun texte ne doit déborder de la page (il serait absent de l'image)
      const overflow = await page.evaluate(() => {
        const el = document.querySelector(".page");
        return Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth);
      });
      if (overflow > 1) throw new Error(`${name} : le contenu déborde de la page de ${overflow}px`);
      await page.locator(".page").screenshot({ path: png });
      return png;
    };
    for (const c of modernCases) {
      const rendered = renderCase(c, photos);
      const facing = rendered.facing
        ? await shoot(
            rendered.facing.html,
            rendered.facing.width,
            rendered.facing.height,
            `${c.id}-facing`,
          )
        : null;
      const images = [];
      const clean = [];
      for (let i = 0; i < rendered.length; i++) {
        const n = i + 1;
        const png = await shoot(
          rendered[i].html,
          rendered[i].width,
          rendered[i].height,
          `${c.id}-${n}`,
        );
        const out = path.join(OUT, `${c.id}-${n}.jpg`);
        const cleanOut = path.join(OUT, "clean", `${c.id}-${n}.jpg`);
        jobs.push({
          id: c.id,
          pages: facing ? [facing, png] : [png],
          profile: c.profile,
          seed: seedOf(`${c.id}#${n}`),
          out,
          clean_pages: [png],
          clean_out: [cleanOut],
          binding: null,
        });
        images.push(rel(out));
        clean.push(rel(cleanOut));
      }
      const photo = c.variant?.photo ? modern.photos[c.variant.photo] : null;
      const srcLabel =
        c.source === "rédigée pour le banc" ? "rédigée pour le banc" : c.source_title;
      entries.set(c.id, {
        id: c.id,
        category: "printed_photo",
        subtype: "mise-en-page-moderne",
        lang: c.lang,
        images,
        clean_images: clean,
        truth: `truth/${c.id}.json`,
        source_url: c.source_url,
        source_title: srcLabel,
        source_date:
          c.source === "rédigée pour le banc"
            ? "2026"
            : (c.source_title.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null),
        license: c.license,
        license_url: c.license_url,
        provenance:
          `gabarit « ${c.template} » (printed-templates.mjs) rendu par Playwright/Chromium à 2× ; texte injecté depuis printed-modern.json` +
          (facing
            ? " ; photographiée en double page avec une page d'en face composée pour le banc"
            : "") +
          (photo
            ? ` ; photo « ${photo.file} » de ${photo.author}, ${photo.license} (${photo.page})`
            : " ; illustration = aplat/dégradé CSS"),
        distortions: [],
        difficulty: c.difficulty,
        truth_method: "texte-injecte",
        notes: modernNotes(c, facing),
        _truth: c.truth,
      });
    }
    await browser.close();
  }

  // ---------------- Distorsion « photo au téléphone » ----------------
  const jobsFile = path.join(SRC, "jobs.json");
  await writeFile(jobsFile, JSON.stringify(jobs, null, 1));
  console.log(`Distorsion de ${jobs.length} image(s)…`);
  const stdout = execFileSync(
    "uv",
    [
      "run",
      "-q",
      "--with",
      "numpy",
      "--with",
      "opencv-python-headless",
      "python",
      path.join(HERE, "distort-printed.py"),
      jobsFile,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
  const results = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  for (const r of results) {
    const job = jobs.find((j) => j.out === r.out);
    const e = entries.get(job.id);
    const n = path.basename(r.out, ".jpg").split("-").pop();
    e.distortions.push(...r.distortions.map((d) => (e.images.length > 1 ? `img${n}:${d}` : d)));
  }

  // ---------------- Vérités + manifeste ----------------
  for (const e of entries.values()) {
    const t = e._truth;
    const truth = {
      id: e.id,
      category: "printed_photo",
      lang: e.lang,
      title: t.title,
      ingredients: t.ingredients,
      steps: t.steps,
      notes: t.notes ?? null,
      servings: t.servings ?? null,
      truncated: false,
      ...(t.format ? { format: t.format } : { format: "liste" }),
    };
    await writeFile(path.join(TRUTH, `${e.id}.json`), JSON.stringify(truth, null, 2) + "\n");
    delete e._truth;
  }
  const previous = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, "utf8")) : [];
  const merged = [...previous.filter((p) => !entries.has(p.id)), ...entries.values()];
  const order = (id) => (id.startsWith("print-mod-") ? 1 : 0);
  merged.sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  await writeFile(MANIFEST, JSON.stringify(merged, null, 2) + "\n");
  console.log(
    `OK — ${entries.size} cas, ${jobs.length} images ; manifeste : ${path.relative(REPO, MANIFEST)}`,
  );
}

function modernNotes(c, facing) {
  const parts = [];
  const tpl = {
    "livre-colonne":
      "livre moderne : bandeau de couleur, colonne ingrédients sur fond teinté à gauche, étapes numérotées à droite, titre courant et folio",
    "magazine-3col":
      "page de magazine en 3 colonnes : chapeau, encadré ingrédients, étapes en paragraphes numérotés, puis début d'une AUTRE recette et une publicité dans la 3e colonne (piège)",
    "magazine-2col":
      "magazine : colonne latérale colorée (ingrédients, portions, temps), étapes numérotées sur deux colonnes, encadré en pointillés",
    "livre-epure":
      "livre épuré : grand titre centré, ingrédients sur deux colonnes, étapes en paragraphes numérotés, encadré",
    fiche:
      "fiche recette cartonnée paysage (bordure épaisse, niveau de difficulté en étoiles, pastilles numérotées)",
    "photo-haut":
      "livre : photo pleine largeur en haut, ingrédients et étapes en deux colonnes dessous",
    "pas-a-pas":
      "magazine « pas à pas » : vignettes illustrées numérotées, recette sur DEUX pages (étapes 1-3 puis 4-6 + conseil + publicité)",
    "livre-us": "livre anglo-saxon : bandeau Yield / Prep / Cook, mesures US",
  }[c.template];
  parts.push(tpl);
  if (c.pages === 2) parts.push("recette sur deux pages (2 images)");
  if (facing) {
    parts.push(
      c.variant.facing === "autre-recette"
        ? "photographiée en double page : la page de gauche porte une autre recette complète (« Compote pommes-rhubarbe », piège)"
        : "photographiée en double page : page de gauche = illustration pleine page avec un titre de chapitre",
    );
  }
  if (c.intro) parts.push("chapeau d'introduction imprimé hors vérité terrain");
  if (c.source?.startsWith("wikibooks"))
    parts.push("texte Wikibooks : fautes d'origine conservées");
  return parts.join(" ; ") + ".";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
