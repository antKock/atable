#!/usr/bin/env node
// Pool de test OCR — partie « captures d'écran » (banc Apple Vision + LLM texte
// contre gpt-4o vision). AUCUN appel à un modèle ici : la vérité terrain vient
// du balisage JSON-LD `Recipe` des pages (pages web) ou du texte injecté (rendus
// fabriqués façon Notes / Messages / Instagram / appli).
//
// Produit :
//  - scripts/bench/fixtures/ocr-pool/screenshot/<id>-<n>.jpg   (JPEG q85, 780×1688)
//  - scripts/bench/fixtures/ocr-pool/truth/<id>.json            (vérité terrain)
//  - scripts/bench/fixtures/ocr-pool/screenshot-log.json        (journal : écartés, scores)
//  - scripts/bench/ocr-pool/manifest-screenshot.json            (métadonnées versionnées)
//
// Usage :
//   node scripts/bench/ocr-pool/build-screenshots.mjs              # tout
//   node scripts/bench/ocr-pool/build-screenshots.mjs --web        # pages web seulement
//   node scripts/bench/ocr-pool/build-screenshots.mjs --app        # rendus fabriqués seulement
//   node scripts/bench/ocr-pool/build-screenshots.mjs --only id1,id2
//   node scripts/bench/ocr-pool/build-screenshots.mjs --instagram  # tente les pages Instagram publiques
//
// Relançable : chaque cas traité remplace son entrée dans le manifeste ; un cas
// écarté (JSON-LD absent ou différent de l'affichage, site bloqué) en est retiré.
// Les pages évoluent : une relance peut donner des captures un peu différentes.
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { WEB_CASES, APP_CASES, INSTAGRAM_PROBES } from "./screenshot-cases.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POOL = path.join(HERE, "..", "fixtures", "ocr-pool");
const SHOT_DIR = path.join(POOL, "screenshot");
const TRUTH_DIR = path.join(POOL, "truth");
const MANIFEST = path.join(HERE, "manifest-screenshot.json");
const LOG = path.join(POOL, "screenshot-log.json");
const TODAY = new Date().toISOString().slice(0, 10);

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// Écran iPhone 390×844 CSS px @2x. Dans Safari, la page n'occupe que la zone
// entre la barre d'état (47 px) et la barre d'outils du bas (80 px) : on rend la
// page dans 390×717 puis on l'encadre d'une barre d'état + barre Safari, pour que
// la capture ressemble à une vraie capture d'écran d'iPhone.
const SCREEN = { width: 390, height: 844 };
const STATUS_H = 47;
const SAFARI_H = 80;
const PAGE_VIEWPORT = { width: 390, height: SCREEN.height - STATUS_H - SAFARI_H };
const LICENSE_WEB =
  "droit d'auteur de l'éditeur — capture pour test interne non diffusé (exception de fouille de textes et de données, art. L122-5-3 CPI), images hors git";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const doWeb = !args.includes("--app") && !args.includes("--instagram");
const doApp = !args.includes("--web") && !args.includes("--instagram");
const doInsta = args.includes("--instagram");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Bandeaux de consentement : copie de tryConsent (prepare-fixtures.mjs), élargie
// aux CMP anglophones (OneTrust, Google Funding Choices, TrustArc…).
// ---------------------------------------------------------------------------
const CONSENT_TEXTS = [
  "Tout accepter",
  "Accepter & Fermer",
  "Accepter et fermer",
  "Accepter et continuer",
  "J'accepte",
  "Accepter",
  "Accept All",
  "Accept all",
  "Accept All Cookies",
  "Accept Cookies",
  "I Accept",
  "I agree",
  "Agree",
  "AGREE",
  "Accept",
  "Consent",
];
const CONSENT_SELECTORS = [
  "#didomi-notice-agree-button",
  "#onetrust-accept-btn-handler",
  "button.fc-cta-consent",
  "#truste-consent-button",
  "#axeptio_btn_acceptAll",
  "button.sd-cmp-3cRQ2",
  'button[aria-label*="accepter" i]',
  'button[aria-label*="accept all" i]',
];

// Libellés d'acceptation (apostrophe droite ou typographique), cherchés par rôle.
const CONSENT_ROLE_RE =
  /^\s*(j.accepte|tout accepter|accepter( et| &) (fermer|continuer)|accepter|accept all( & continue| cookies)?|accept & continue|accept cookies|i accept|i agree|agree|accept)\s*$/i;

// Passe rapide (rôle + libellé seulement), rejouée à chaque tranche : certains
// bandeaux n'apparaissent qu'au premier défilement.
async function quickConsent(page) {
  for (const frame of page.frames()) {
    try {
      const el = frame.getByRole("button", { name: CONSENT_ROLE_RE }).first();
      if (await el.isVisible({ timeout: 150 })) {
        await el.click({ timeout: 1000 });
        return true;
      }
    } catch {
      /* rien ici */
    }
  }
  return false;
}

async function tryConsent(page) {
  // Les frames de CMP d'abord (Sourcepoint, TrustArc…), la page ensuite.
  const frames = [...page.frames().filter((f) => f !== page.mainFrame()), page.mainFrame()];
  for (const frame of frames) {
    try {
      const el = frame.getByRole("button", { name: CONSENT_ROLE_RE }).first();
      if (await el.isVisible({ timeout: 300 })) {
        await el.click({ timeout: 1500 });
        return true;
      }
    } catch {
      /* pas de bouton reconnu dans cette frame */
    }
  }
  for (const frame of frames) {
    for (const sel of CONSENT_SELECTORS) {
      try {
        const el = frame.locator(sel).first();
        if (await el.isVisible({ timeout: 300 })) {
          await el.click({ timeout: 1500 });
          return true;
        }
      } catch {
        /* frame morte ou sélecteur absent */
      }
    }
    for (const text of CONSENT_TEXTS) {
      try {
        const el = frame
          .locator(`button, a, div[role="button"], span, div`, { hasText: text })
          .locator(`text="${text}"`)
          .first();
        if (await el.isVisible({ timeout: 300 })) {
          await el.click({ timeout: 1500 });
          return true;
        }
      } catch {
        /* on tente la frame/texte suivant */
      }
    }
  }
  return false;
}

// Interstitiels publicitaires (vignette Google & co) : l'utilisateur tape
// « Fermer ». Ils vivent dans des iframes, hors de portée du DOM de la page.
async function closeInterstitials(page) {
  let n = 0;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    for (const loc of [
      frame.locator("#dismiss-button"),
      frame.getByRole("button", { name: /^\s*(fermer|close|close ad)\s*$/i }),
    ]) {
      try {
        const el = loc.first();
        if (await el.isVisible({ timeout: 200 })) {
          await el.click({ timeout: 1000 });
          n++;
          break;
        }
      } catch {
        /* rien à fermer ici */
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Code exécuté dans la page : lecture du JSON-LD, appariement JSON-LD ↔ DOM,
// contrôle de visibilité. Tout est installé sur window.__bench.
// ---------------------------------------------------------------------------
function installBenchHelpers() {
  const decode = (s) => {
    const ta = document.createElement("textarea");
    ta.innerHTML = String(s ?? "");
    let t = ta.value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
    ta.innerHTML = t; // entités doublement encodées (&amp;eacute;)
    t = ta.value;
    return t
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  };
  const oneLine = (s) =>
    decode(s)
      .replace(/\s*\n\s*/g, " ")
      .trim();
  const types = (o) => [].concat(o?.["@type"] ?? []).map(String);

  function findRecipe(node, depth = 0) {
    if (!node || depth > 6) return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = findRecipe(n, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    if (types(node).includes("Recipe")) return node;
    for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
      const r = findRecipe(node[k], depth + 1);
      if (r) return r;
    }
    return null;
  }

  function readJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try {
        data = JSON.parse(s.textContent);
      } catch {
        try {
          data = JSON.parse(s.textContent.replace(/[\u0000-\u001f]+/g, " "));
        } catch {
          continue;
        }
      }
      const r = findRecipe(data);
      if (r) return r;
    }
    return null;
  }

  // Aplatit recipeInstructions en [{text}|{section}].
  function flattenSteps(ri) {
    const out = [];
    const stripNum = (t) => t.replace(/^\s*(?:étape\s*)?\d+\s*[.)/:-]\s*/i, "").trim();
    const walk = (x) => {
      if (x == null) return;
      if (typeof x === "string") {
        for (const line of decode(x).split(/\n+/)) {
          const t = stripNum(line);
          if (t) out.push({ text: t });
        }
        return;
      }
      if (Array.isArray(x)) return x.forEach(walk);
      const ty = types(x);
      if (ty.includes("HowToSection")) {
        if (x.name) out.push({ section: oneLine(x.name) });
        return walk(x.itemListElement);
      }
      if (ty.includes("ItemList")) return walk(x.itemListElement);
      const t = x.text ?? x.description ?? x.name;
      if (t != null) {
        const lines = decode(t).split(/\n+/).map(stripNum).filter(Boolean);
        for (const line of lines) out.push({ text: line });
      }
    };
    walk(ri);
    return out;
  }

  const norm = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/œ/g, "oe")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const toks = (s) => new Set(norm(s).split(" ").filter(Boolean));

  function isRendered(el) {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }

  // Appariement : pour chaque élément JSON-LD, l'élément DOM rendu dont le texte
  // lui ressemble le plus (F1 sur les mots). Préférence au plus petit élément et
  // à l'ordre du document (après l'élément précédent).
  function match(recipe) {
    const all = [...document.body.querySelectorAll("*")].filter((el) => {
      if (/^(SCRIPT|STYLE|NOSCRIPT|svg|SVG|IFRAME|TEMPLATE)$/.test(el.tagName)) return false;
      if (el.closest("[data-bench-chrome]")) return false;
      const t = el.innerText;
      return t && t.length >= 2 && t.length <= 2500 && isRendered(el);
    });
    const cands = all.map((el, idx) => ({ el, idx, t: toks(el.innerText) }));
    const find = (text, prevIdx) => {
      const it = toks(text);
      if (!it.size) return null;
      let best = null;
      for (const c of cands) {
        let inter = 0;
        for (const w of it) if (c.t.has(w)) inter++;
        if (!inter) continue;
        const rec = inter / it.size;
        const prec = inter / c.t.size;
        let f1 = (2 * rec * prec) / (rec + prec);
        const score = f1 + (c.idx >= prevIdx ? 0.03 : 0) + c.idx * 1e-9 * -1;
        if (
          !best ||
          score > best.score + 1e-6 ||
          (Math.abs(score - best.score) < 1e-6 && c.t.size < best.c.t.size)
        )
          best = { c, score, f1, rec, prec };
      }
      return best;
    };
    const items = [];
    let prev = 0;
    const name = oneLine(recipe.name ?? "");
    const ingredients = []
      .concat(recipe.recipeIngredient ?? recipe.ingredients ?? [])
      .map(oneLine)
      .filter(Boolean);
    const steps = flattenSteps(recipe.recipeInstructions);
    // Lignes-titres glissées dans recipeIngredient (« Ingrédients », « Pour la
    // pâte : ») : pas des ingrédients. La première est jetée, les autres
    // deviennent un titre de section rattaché à l'ingrédient suivant.
    const isHeader = (t) =>
      /^ingr[ée]dients?\s*:?$/i.test(t) || (/:\s*$/.test(t) && !/\d/.test(t) && t.length <= 60);
    const heads = {};
    const plainIngredients = [];
    for (const t of ingredients) {
      if (isHeader(t)) {
        if (!/^ingr[ée]dients?\s*:?$/i.test(t))
          heads[plainIngredients.length] = t.replace(/\s*:\s*$/, "");
      } else plainIngredients.push(t);
    }
    const ingMatches = plainIngredients.map((text, j) => {
      const b = find(text, prev);
      if (b && b.f1 >= 0.6) prev = b.c.idx;
      return { text, b, ok: !!(b && b.f1 >= 0.6), head: heads[j] ?? null };
    });
    // Ordre d'affichage (certains sites, en grille, n'affichent pas les
    // ingrédients dans l'ordre du JSON-LD) ; les non-appariés restent en fin.
    ingMatches
      .map((m, j) => ({ ...m, j }))
      .sort((a, b) => (a.ok ? a.b.c.idx : 1e9 + a.j) - (b.ok ? b.b.c.idx : 1e9 + b.j))
      .forEach(({ text, b, ok, head }, i) => {
        items.push({
          key: `i${i}`,
          kind: "ingredient",
          text,
          head,
          f1: b?.f1 ?? 0,
          rec: b?.rec ?? 0,
          el: ok ? b.c.el : null,
        });
      });
    prev = 0;
    steps.forEach((s, i) => {
      if (s.section) {
        items.push({ key: `h${i}`, kind: "section", text: s.section, el: null, f1: 1 });
        return;
      }
      // Les étapes longues sont parfois découpées en plusieurs paragraphes :
      // on accepte un appariement par rappel si l'élément contient toute l'étape.
      const b = find(s.text, prev);
      const ok = b && (b.f1 >= 0.6 || (b.rec >= 0.9 && b.c.t.size <= toks(s.text).size * 2.5));
      if (ok) prev = b.c.idx;
      items.push({
        key: `s${i}`,
        kind: "step",
        text: s.text,
        f1: b?.f1 ?? 0,
        rec: b?.rec ?? 0,
        el: ok ? b.c.el : null,
      });
    });
    // Titre : le h1 visible.
    const h1 = [...document.querySelectorAll("h1")].find(isRendered) ?? null;
    // Sections d'ingrédients : titres courts situés entre deux ingrédients
    // appariés, à l'intérieur du conteneur commun de la liste.
    const ingEls = items.filter((x) => x.kind === "ingredient" && x.el).map((x) => x.el);
    const groups = [];
    if (ingEls.length >= 2) {
      let lca = ingEls[0].parentElement;
      while (lca && !ingEls.every((e) => lca.contains(e))) lca = lca.parentElement;
      if (lca && lca !== document.body) {
        const ingSet = new Set(ingEls);
        const heads = [
          ...lca.querySelectorAll(
            'h2,h3,h4,h5,h6,strong,b,dt,[class*="group-name"],[class*="group-title"],[class*="groupName"],[class*="subtitle"],[class*="section-title"]',
          ),
        ].filter((h) => {
          if (!isRendered(h)) return false;
          if ([...ingSet].some((e) => e.contains(h) || h.contains(e))) return false;
          const t = h.innerText.trim();
          if (t.length < 2 || t.length > 70) return false;
          if (
            /ingr[ée]dients?\b|^\d+\s|servings?|portions?|personnes?|people|serves|makes|convert|metric|us customary|cups?\b|^\d/i.test(
              t,
            )
          )
            return false;
          // avant au moins un ingrédient, après le premier ingrédient ou en tête de liste
          return ingEls.some(
            (e) => h.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
        });
        // on ne garde que les titres « les plus externes » (évite b dans h4)
        for (const h of heads) {
          if (heads.some((o) => o !== h && o.contains(h))) continue;
          // position : index du premier ingrédient qui suit
          const nextIng = items.findIndex(
            (x) =>
              x.kind === "ingredient" &&
              x.el &&
              h.compareDocumentPosition(x.el) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
          if (nextIng < 0) continue;
          const text = h.innerText
            .trim()
            .replace(/\s+/g, " ")
            .replace(/\s*:\s*$/, "");
          if (groups.some((g) => g.before === nextIng)) continue;
          groups.push({ text, before: nextIng, el: h });
        }
      }
    }
    // N'accepter des groupes que s'il y en a au moins un qui coupe la liste
    // (un seul titre en tête de liste = le plus souvent « Pour 4 personnes » ou
    // un intitulé du bloc, pas une section).
    const firstIng = items.findIndex((x) => x.kind === "ingredient");
    const realGroups = groups.some((g) => g.before > firstIng) ? groups : [];
    const map = {};
    for (const it of items) if (it.el) map[it.key] = it.el;
    realGroups.forEach((g, i) => (map[`g${i}`] = g.el));
    if (h1) map.title = h1;
    // Le nom de la recette répété ailleurs (titre de la fiche WPRM/Tasty, bandeau)
    // compte aussi comme titre visible.
    const nameKeys = new Set([norm(name), h1 ? norm(h1.innerText) : ""].filter(Boolean));
    let t = 0;
    for (const c of cands) {
      if (c.el === h1 || t >= 6) continue;
      if (
        nameKeys.has(norm(c.el.innerText)) &&
        ![...c.el.children].some((ch) => nameKeys.has(norm(ch.innerText ?? "")))
      )
        map[`title${t++}`] = c.el;
    }
    window.__benchMap = map;
    return {
      name,
      h1: h1?.innerText?.trim() ?? null,
      recipeYield: recipe.recipeYield ?? null,
      items: items.map(({ el, ...rest }) => ({ ...rest, matched: kindOk(rest, el) })),
      groups: realGroups.map((g, i) => ({ key: `g${i}`, text: g.text, before: g.before })),
    };
    function kindOk(it, el) {
      return it.kind === "section" ? true : !!el;
    }
  }

  // Visible = entièrement dans la fenêtre ET pas recouvert (bandeau, pub
  // collante…) aux deux extrémités du texte.
  function visibleNow(el) {
    if (!el || !el.isConnected || !isRendered(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0) return false;
    if (r.top < -1 || r.bottom > innerHeight + 1) return false;
    // Trois abscisses (début, milieu, fin de ligne) : un petit bouton flottant
    // (partage, favori) sur le bord ne masque pas toute la ligne.
    const clampX = (x) => Math.min(Math.max(x, 1), innerWidth - 2);
    const xs = [
      r.left + Math.min(24, r.width / 2),
      r.left + r.width / 2,
      r.right - Math.min(24, r.width / 2),
    ].map(clampX);
    for (const y of [r.top + Math.min(6, r.height / 2), r.bottom - Math.min(6, r.height / 2)]) {
      const ok = xs.some((x) => {
        const hit = document.elementFromPoint(x, y);
        return hit && (el.contains(hit) || hit.contains(el));
      });
      if (!ok) return false;
    }
    return true;
  }

  function visibility() {
    const out = {};
    for (const [k, el] of Object.entries(window.__benchMap ?? {})) out[k] = visibleNow(el);
    return out;
  }

  function topOf(key) {
    const el = window.__benchMap?.[key];
    if (!el || !el.isConnected) return null;
    return el.getBoundingClientRect().top + scrollY;
  }

  // Texte réellement visible dans la fenêtre (pour le rendement).
  function visibleText() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts = [];
    const range = document.createRange();
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!n.textContent.trim()) continue;
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName) || !isRendered(p)) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.height > 0 && r.top >= 0 && r.bottom <= innerHeight) parts.push(n.textContent.trim());
    }
    // Les compteurs de portions sont souvent des <input> (valeur hors DOM texte).
    for (const inp of document.querySelectorAll(
      'input[type="number"], input[type="text"], input:not([type])',
    )) {
      const r = inp.getBoundingClientRect();
      if (inp.value && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight)
        parts.push(`[[input:${inp.value}]]`);
    }
    return parts.join(" ");
  }

  // Ce que fermerait un utilisateur : modale plein écran (newsletter, mur de
  // consentement résiduel) et lecteur vidéo flottant. Les en-têtes collants et
  // les bannières de pub basses (< 130 px) restent : ils font partie du réalisme.
  function dismissOverlays() {
    let n = 0;
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (vis <= 0) continue;
      if (r.right <= 0 || r.left >= innerWidth) continue;
      // Tout ce qui flotte et mesure ≥ 100 px de haut : modale, invite de
      // notifications, Google One Tap, lecteur vidéo, pub flottante.
      const floating = vis >= 100 && r.width >= 80;
      const isHeader = r.top <= 5 && r.height < 140;
      const holdsRecipe = Object.values(window.__benchMap ?? {}).some((m) => el.contains(m));
      if (floating && !isHeader && !holdsRecipe && !el.querySelector("h1")) {
        el.style.setProperty("display", "none", "important");
        n++;
      }
    }
    // Verrou de défilement laissé par une modale (overflow hidden, body fixe).
    for (const root of [document.documentElement, document.body]) {
      const cs = getComputedStyle(root);
      if (cs.overflowY === "hidden" || cs.overflow === "hidden")
        root.style.setProperty("overflow", "auto", "important");
      if (cs.position === "fixed") {
        root.style.setProperty("position", "static", "important");
        root.style.setProperty("top", "auto", "important");
      }
    }
    return n;
  }

  // Hauteur masquée en haut de la fenêtre par un en-tête fixe/collant.
  function coveredTop() {
    let y = 0;
    for (let i = 0; i < 6; i++) {
      const hit = document.elementFromPoint(innerWidth / 2, y + 2);
      let e = hit;
      let fixed = false;
      while (e && e !== document.body) {
        const p = getComputedStyle(e).position;
        if (p === "fixed" || p === "sticky") {
          fixed = true;
          break;
        }
        e = e.parentElement;
      }
      if (!fixed) break;
      const b = e.getBoundingClientRect().bottom;
      if (b <= y + 1 || b > innerHeight * 0.5) break;
      y = b;
    }
    return y;
  }

  window.__bench = {
    readJsonLd,
    match,
    visibility,
    topOf,
    visibleText,
    dismissOverlays,
    coveredTop,
  };
}

// ---------------------------------------------------------------------------
// Cadre iPhone : barre d'état + barre Safari autour de la capture de la page.
// ---------------------------------------------------------------------------
function statusBarHtml({ dark = false, time = "9:41" } = {}) {
  const c = dark ? "#fff" : "#000";
  return `<div style="height:${STATUS_H}px;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 44px;font:600 17px -apple-system,'SF Pro Text',system-ui;color:${c}">
  <span>${time}</span>
  <span style="display:flex;gap:6px;align-items:center">
    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5l2.6-3a3.6 3.6 0 0 0-5.2 0zM3.5 6.6l1.3 1.5a4.6 4.6 0 0 1 6.4 0l1.3-1.5a6.6 6.6 0 0 0-9 0zM.6 3.5l1.3 1.5a8.8 8.8 0 0 1 12.2 0l1.3-1.5a10.8 10.8 0 0 0-14.8 0z" fill="${c}"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="${c}" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="${c}"/><rect x="24.5" y="4.5" width="1.5" height="4" rx=".7" fill="${c}" opacity=".4"/></svg>
  </span></div>`;
}

function frameHtml({ imgB64, domain, dark }) {
  const bg = dark ? "#1c1c1e" : "#f2f2f7";
  const pill = dark ? "#3a3a3c" : "#fff";
  const txt = dark ? "#fff" : "#000";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${SCREEN.width}px;height:${SCREEN.height}px;overflow:hidden;background:${bg}}
  img{display:block;width:${PAGE_VIEWPORT.width}px;height:${PAGE_VIEWPORT.height}px}
  .bar{height:${SAFARI_H}px;padding:8px 14px 0;box-sizing:border-box}
  .pill{height:44px;border-radius:12px;background:${pill};display:flex;align-items:center;justify-content:center;gap:6px;font:400 16px -apple-system,system-ui;color:${txt};box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .home{width:134px;height:5px;border-radius:3px;background:${txt};margin:18px auto 0}
  </style></head><body data-bench-chrome>
  <div style="background:${dark ? "#000" : "#fff"}">${statusBarHtml({ dark })}</div>
  <img src="data:image/png;base64,${imgB64}">
  <div class="bar"><div class="pill"><span style="font-size:13px;opacity:.6">AA</span>&nbsp;<svg width="11" height="13" viewBox="0 0 11 13"><rect x="1" y="5.5" width="9" height="7" rx="1.5" fill="${txt}" opacity=".7"/><path d="M3 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="${txt}" opacity=".7" fill="none" stroke-width="1.4"/></svg>${domain}</div></div>
  </body></html>`;
}

async function framed(framer, pngBuf, domain, outPath, dark = false) {
  await framer.setContent(frameHtml({ imgB64: pngBuf.toString("base64"), domain, dark }), {
    waitUntil: "load",
  });
  await framer.screenshot({ path: outPath, type: "jpeg", quality: 85 });
}

// ---------------------------------------------------------------------------
// Pages web
// ---------------------------------------------------------------------------
function parseServings(y) {
  const v = [].concat(y ?? [])[0];
  if (v == null) return null;
  const m = String(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function servingsVisible(n, text) {
  if (n == null) return false;
  const re = new RegExp(
    `(?:\\b${n}\\s*(?:pers|personne|portion|part|parts|serving|people|pi[eè]ce|biscuit|cookie|muffin|cr[eê]pe|verrine|galette|pancake|bouch[ée]e|tranche|slice|piece|cup|bowl|x|-)|(?:serves|servings?|yield|makes|pour|portions?|personnes?|parts?)\\s*:?\\s*(?:\\(?\\s*)${n}\\b)`,
    "i",
  );
  if (re.test(text)) return true;
  // Compteur de portions en <input> : le mot « personnes/servings… » et la
  // valeur de l'input dans la même capture.
  const word =
    /\b(pers\.?|personnes?|portions?|parts?|servings?|serves|people|yield|makes)\b/i.test(text);
  return word && text.includes(`[[input:${n}]]`);
}

async function scrollThrough(page) {
  // Déclenche les chargements paresseux (images, pubs) puis revient en haut.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 30000); y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);
}

async function captureWeb(ctx, framer, c) {
  const page = await ctx.newPage();
  const log = { id: c.id, url: c.url };
  try {
    const resp = await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    log.status = resp?.status();
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await sleep(2500);
    let consent = false;
    for (let round = 0; round < 4 && !consent; round++) {
      consent = await tryConsent(page);
      await sleep(consent ? 1200 : 1200);
    }
    log.consent = consent;
    await page.evaluate(installBenchHelpers);
    log.dismissed = await page.evaluate(() => window.__bench.dismissOverlays());
    const recipe = await page.evaluate(() => window.__bench.readJsonLd());
    if (!recipe) throw new Error("pas de JSON-LD Recipe");
    log.finalUrl = page.url();
    await scrollThrough(page);
    if (await quickConsent(page)) log.consent = true;
    await page.evaluate(installBenchHelpers); // au cas où une navigation SPA l'aurait perdu
    log.dismissed += await page.evaluate(() => window.__bench.dismissOverlays());
    const m = await page.evaluate(() => window.__bench.match(window.__bench.readJsonLd()));
    const ing = m.items.filter((x) => x.kind === "ingredient");
    const stp = m.items.filter((x) => x.kind === "step");
    const ingOk = ing.filter((x) => x.matched).length / Math.max(ing.length, 1);
    const stpOk = stp.filter((x) => x.matched).length / Math.max(stp.length, 1);
    log.jsonld = {
      name: m.name,
      ingredients: ing.length,
      steps: stp.length,
      ingMatch: +ingOk.toFixed(2),
      stepMatch: +stpOk.toFixed(2),
    };
    log.unmatched = m.items
      .filter((x) => !x.matched)
      .map((x) => `${x.key} (${x.f1.toFixed(2)}) ${x.text.slice(0, 80)}`);
    if (!ing.length || !stp.length)
      throw new Error("JSON-LD incomplet (ingrédients ou étapes vides)");
    if (ingOk < 0.85 || stpOk < 0.85)
      throw new Error(
        `JSON-LD ≠ affichage (ingrédients ${Math.round(ingOk * 100)} %, étapes ${Math.round(stpOk * 100)} %)`,
      );

    // Ordre de lecture : titre, groupes/ingrédients, étapes.
    const order = [
      "title",
      ...m.items.filter((x) => x.matched && x.kind !== "section").map((x) => x.key),
    ];
    for (const g of m.groups) order.splice(order.indexOf(`i${g.before}`), 0, g.key);
    const seen = new Set();
    const shots = [];
    const texts = [];
    const firstIngKey = m.items.find((x) => x.kind === "ingredient" && x.matched).key;
    let target =
      c.start === "title"
        ? Math.max(0, ((await page.evaluate((k) => window.__bench.topOf(k), "title")) ?? 0) - 110)
        : Math.max(
            0,
            (await page.evaluate((k) => window.__bench.topOf(k), firstIngKey)) -
              (c.startOffset ?? 230),
          );
    let lastY = -1;
    for (let n = 1; n <= c.slices; n++) {
      await page.evaluate((y) => window.scrollTo(0, y), target);
      await sleep(1400);
      if (await quickConsent(page)) {
        log.consent = true;
        await sleep(800);
      }
      log.dismissed += await closeInterstitials(page);
      log.dismissed += await page.evaluate(() => window.__bench.dismissOverlays());
      await sleep(200);
      const y = await page.evaluate(() => scrollY);
      if (y <= lastY) break; // bas de page atteint
      lastY = y;
      const margin = (await page.evaluate(() => window.__bench.coveredTop())) + 40;
      // Visibilité mesurée avant ET après la capture : un bandeau qui surgit
      // entre les deux (lecteur vidéo, pub) rend l'élément « non visible ».
      const vis0 = await page.evaluate(() => window.__bench.visibility());
      const png = await page.screenshot({ type: "png" });
      shots.push(png);
      const vis1 = await page.evaluate(() => window.__bench.visibility());
      const vis = Object.fromEntries(Object.keys(vis0).map((k) => [k, vis0[k] && vis1[k]]));
      const before = seen.size;
      for (const [k, v] of Object.entries(vis)) if (v) seen.add(k);
      if (n > 1 && seen.size === before) {
        // Tranche qui n'apporte rien (pied de page, pubs) : on ne la garde pas.
        shots.pop();
        (log.slices ??= []).push({ y, dropped: true });
        break;
      }
      (log.slices ??= []).push({
        y,
        margin,
        visible: Object.keys(vis)
          .filter((k) => vis[k])
          .join(" "),
        tops: Object.fromEntries(
          await page.evaluate(() =>
            Object.entries(window.__benchMap).map(([k, el]) => [
              k,
              Math.round(el.getBoundingClientRect().top),
            ]),
          ),
        ),
      });
      texts.push(await page.evaluate(() => window.__bench.visibleText()));
      const remaining = order.filter((k) => !seen.has(k));
      if (!remaining.length) break;
      // Tranche suivante : l'élément pas encore vu le plus haut (sous le haut de
      // la fenêtre actuelle) arrive juste sous l'en-tête collant (`margin`).
      // Ce qui a été dépassé sans être vu (masqué par une pub) est abandonné.
      const tops = await page.evaluate(
        (keys) => keys.map((k) => window.__bench.topOf(k)),
        remaining,
      );
      const below = tops.filter((t) => t != null && t >= y + margin - 4);
      let next = below.length ? Math.min(...below) - margin : y + PAGE_VIEWPORT.height - 120;
      if (next <= y + 40) next = y + PAGE_VIEWPORT.height - 120;
      target = next;
    }
    // Titre vu : le h1 ou une répétition exacte du nom de la recette.
    if ([...seen].some((k) => k.startsWith("title"))) seen.add("title");

    // Vérité restreinte au visible.
    const ingredients = [];
    const steps = [];
    let pendingSection = null;
    for (const it of m.items) {
      if (it.kind === "ingredient") {
        const g = m.groups.find((gg) => `i${gg.before}` === it.key);
        if (g && seen.has(g.key) && seen.has(it.key)) ingredients.push(`// ${g.text}`);
        else if (!g && it.head && seen.has(it.key)) ingredients.push(`// ${it.head}`);
        if (seen.has(it.key)) ingredients.push(it.text);
      } else if (it.kind === "section") pendingSection = it.text;
      else if (it.kind === "step" && seen.has(it.key)) {
        if (pendingSection) steps.push(`// ${pendingSection}`);
        pendingSection = null;
        steps.push(it.text);
      } else if (it.kind === "step") pendingSection = pendingSection; // section conservée pour l'étape suivante visible
    }
    const matchedIng = ing.filter((x) => x.matched);
    const matchedStp = stp.filter((x) => x.matched);
    const truncated =
      matchedIng.some((x) => !seen.has(x.key)) || matchedStp.some((x) => !seen.has(x.key));
    const servingsN = parseServings(m.recipeYield);
    const truth = {
      id: c.id,
      category: "screenshot",
      lang: c.lang,
      title: seen.has("title") ? m.name || m.h1 : null,
      ingredients,
      steps,
      notes: null,
      servings: texts.some((t) => servingsVisible(servingsN, t)) ? servingsN : null,
      truncated,
    };
    if (!ingredients.length && !steps.length) throw new Error("rien de visible dans les captures");

    // Écriture : cadre iPhone + JPEG q85.
    const images = [];
    const domain = new URL(log.finalUrl).hostname.replace(/^www\./, "");
    for (let i = 0; i < shots.length; i++) {
      const rel = `screenshot/${c.id}-${i + 1}.jpg`;
      await framed(framer, shots[i], domain, path.join(POOL, rel));
      images.push(rel);
    }
    await writeFile(path.join(TRUTH_DIR, `${c.id}.json`), JSON.stringify(truth, null, 2) + "\n");
    const dropped = m.items.filter((x) => !x.matched && x.kind !== "section").length;
    log.ok = true;
    log.images = images.length;
    log.visible = {
      ingredients: ingredients.filter((x) => !x.startsWith("//")).length,
      steps: steps.filter((x) => !x.startsWith("//")).length,
    };
    return {
      ok: true,
      log,
      entry: {
        id: c.id,
        category: "screenshot",
        subtype: "web-mobile",
        lang: c.lang,
        images,
        truth: `truth/${c.id}.json`,
        source_url: c.url,
        source_site: domain,
        license: LICENSE_WEB,
        provenance: `capture Playwright iPhone 390×844@2x (Safari simulé : barre d'état + barre d'adresse) le ${TODAY}, ${images.length} tranche${images.length > 1 ? "s" : ""} ${c.start === "title" ? "depuis le titre" : "depuis les ingrédients"}, bandeau cookies ${consent ? "fermé" : "non détecté"}${log.dismissed ? `, ${log.dismissed} surcouche(s) fermée(s) (modale / lecteur vidéo flottant)` : ""}`,
        truth_method: truncated ? "json-ld-restreint-au-visible" : "json-ld",
        notes:
          [
            c.note,
            truncated
              ? `capture incomplète : ${log.visible.ingredients}/${ing.length} ingrédients et ${log.visible.steps}/${stp.length} étapes visibles`
              : null,
            !seen.has("title") ? "titre hors champ (title: null)" : null,
            dropped
              ? `${dropped} élément(s) JSON-LD non retrouvé(s) à l'affichage, écarté(s) de la vérité`
              : null,
            m.groups.length
              ? `sections d'ingrédients lues dans le DOM (${m.groups.map((g) => g.text).join(", ")})`
              : null,
          ]
            .filter(Boolean)
            .join(" ; ") || null,
      },
    };
  } catch (err) {
    log.ok = false;
    log.error = err.message;
    // Capture de diagnostic (hors manifeste) pour comprendre l'échec.
    try {
      await mkdir(path.join(POOL, "debug"), { recursive: true });
      await page.screenshot({ path: path.join(POOL, "debug", `${c.id}.png`) });
    } catch {
      /* page fermée */
    }
    return { ok: false, log };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Rendus fabriqués (Notes, Messages, WhatsApp, Instagram, appli)
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function captureApp(browser, c) {
  const ctx = await browser.newContext({
    viewport: SCREEN,
    deviceScaleFactor: 2,
    userAgent: IPHONE_UA,
    colorScheme: c.dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  try {
    const { renderApp } = await import("./screenshot-app-templates.mjs");
    const html = renderApp(c, {
      statusBar: statusBarHtml({ dark: !!c.dark, time: c.time ?? "9:41" }),
      esc,
    });
    await page.setContent(html, { waitUntil: "load" });
    await sleep(300);
    // Le conteneur défilant (#scroll) sous la barre d'état fixe : on capture
    // l'écran, puis on défile d'un écran moins un recouvrement.
    const images = [];
    const scrollH = await page.evaluate(() => {
      const s = document.getElementById("scroll");
      return { total: s.scrollHeight, view: s.clientHeight };
    });
    const nMax = c.slices ?? Math.ceil((scrollH.total - 40) / (scrollH.view - 120));
    // Pour une conversation, l'écran s'ouvre en bas du fil : on part du haut
    // seulement si le cas le demande.
    for (let n = 0; n < nMax; n++) {
      const top = await page.evaluate(
        ({ n, fromBottom }) => {
          const s = document.getElementById("scroll");
          const step = s.clientHeight - 120;
          s.scrollTop = fromBottom ? s.scrollHeight - s.clientHeight - n * step : n * step;
          return s.scrollTop;
        },
        { n, fromBottom: !!c.fromBottom },
      );
      const rel = `screenshot/${c.id}-${n + 1}.jpg`;
      await page.screenshot({ path: path.join(POOL, rel), type: "jpeg", quality: 85 });
      images.push(rel);
      // Moins de ~100 px encore cachés (marges, date) : l'utilisateur s'arrête là.
      if (!c.fromBottom && top + scrollH.view >= scrollH.total - 100) break;
      if (c.fromBottom && top <= 60) break;
    }
    if (c.fromBottom) images.reverse(); // l'utilisateur envoie de haut en bas
    // Renomme dans l'ordre de lecture.
    if (c.fromBottom) {
      const { rename } = await import("node:fs/promises");
      for (let i = 0; i < images.length; i++)
        await rename(path.join(POOL, images[i]), path.join(POOL, images[i] + ".tmp"));
      for (let i = 0; i < images.length; i++) {
        const rel = `screenshot/${c.id}-${i + 1}.jpg`;
        await rename(path.join(POOL, images[i] + ".tmp"), path.join(POOL, rel));
        images[i] = rel;
      }
    }
    const truth = {
      id: c.id,
      category: "screenshot",
      lang: c.lang,
      title: c.truth.title ?? null,
      ingredients: c.truth.ingredients,
      steps: c.truth.steps,
      notes: c.truth.notes ?? null,
      servings: c.truth.servings ?? null,
      truncated: false,
    };
    await writeFile(path.join(TRUTH_DIR, `${c.id}.json`), JSON.stringify(truth, null, 2) + "\n");
    return {
      ok: true,
      log: { id: c.id, ok: true, images: images.length },
      entry: {
        id: c.id,
        category: "screenshot",
        subtype: c.subtype,
        lang: c.lang,
        images,
        truth: `truth/${c.id}.json`,
        source_url: c.source_url ?? null,
        source_site: c.source_site ?? null,
        license: c.license,
        provenance: `rendu HTML local façon ${c.look} (Playwright iPhone 390×844@2x${c.dark ? ", mode sombre" : ""}) le ${TODAY}, ${images.length} capture${images.length > 1 ? "s" : ""}`,
        truth_method: "texte-injecte",
        notes: c.note ?? null,
      },
    };
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Instagram : tentative honnête sans connexion, sans contournement.
// ---------------------------------------------------------------------------
async function probeInstagram(browser) {
  const ctx = await browser.newContext({
    viewport: SCREEN,
    deviceScaleFactor: 2,
    userAgent: IPHONE_UA,
    locale: "fr-FR",
  });
  const out = [];
  for (const url of INSTAGRAM_PROBES) {
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(4000);
      const info = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        login: /log in|connecte|connexion|sign up|inscri/i.test(
          document.body.innerText.slice(0, 4000),
        ),
        text: document.body.innerText.slice(0, 600),
      }));
      const shot = path.join(POOL, "instagram-probe", `${out.length + 1}.jpg`);
      await mkdir(path.dirname(shot), { recursive: true });
      await page.screenshot({ path: shot, type: "jpeg", quality: 70 });
      out.push({ url, status: resp?.status(), ...info, shot });
    } catch (e) {
      out.push({ url, error: e.message });
    } finally {
      await page.close();
    }
    await sleep(2000);
  }
  await ctx.close();
  return out;
}

// ---------------------------------------------------------------------------
async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  await mkdir(TRUTH_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : [];
  const logAll = existsSync(LOG) ? JSON.parse(await readFile(LOG, "utf8")) : {};
  const byId = new Map(manifest.map((e) => [e.id, e]));
  const browser = await chromium.launch();

  if (doInsta) {
    const r = await probeInstagram(browser);
    logAll.instagram = { date: TODAY, results: r };
    console.log(JSON.stringify(r, null, 2));
  }

  const drop = async (id) => {
    byId.delete(id);
    await rm(path.join(TRUTH_DIR, `${id}.json`), { force: true });
    for (let i = 1; i <= 6; i++) await rm(path.join(SHOT_DIR, `${id}-${i}.jpg`), { force: true });
  };

  if (doWeb) {
    const ctxFor = {};
    for (const lang of ["fr", "en"]) {
      ctxFor[lang] = await browser.newContext({
        viewport: PAGE_VIEWPORT,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPHONE_UA,
        locale: lang === "fr" ? "fr-FR" : "en-US",
        extraHTTPHeaders: {
          "Accept-Language": lang === "fr" ? "fr-FR,fr;q=0.9" : "en-US,en;q=0.9",
        },
      });
    }
    // Cadre rendu en DPR 2 : l'image @2x de la page reste nette (780×1688 en sortie).
    const frameCtx2 = await browser.newContext({ viewport: SCREEN, deviceScaleFactor: 2 });
    const framer2 = await frameCtx2.newPage();
    for (const c of WEB_CASES) {
      if (only && !only.includes(c.id)) continue;
      await drop(c.id);
      const r = await captureWeb(ctxFor[c.lang], framer2, c);
      logAll[c.id] = r.log;
      if (r.ok) byId.set(c.id, r.entry);
      console.log(
        r.ok
          ? `OK  ${c.id} — ${r.entry.images.length} img, ${r.log.visible.ingredients}/${r.log.jsonld.ingredients} ingr., ${r.log.visible.steps}/${r.log.jsonld.steps} étapes${r.entry.truth_method.includes("restreint") ? " (tronqué)" : ""}`
          : `ÉCARTÉ ${c.id} — ${r.log.error}`,
      );
      await sleep(1500);
    }
    for (const ctx of Object.values(ctxFor)) await ctx.close();
    await frameCtx2.close();
  }

  if (doApp) {
    for (const c of APP_CASES) {
      if (only && !only.includes(c.id)) continue;
      await drop(c.id);
      const r = await captureApp(browser, c);
      logAll[c.id] = r.log;
      byId.set(c.id, r.entry);
      console.log(`OK  ${c.id} — ${r.entry.images.length} img (${c.subtype})`);
    }
  }

  await browser.close();
  // Manifeste : ordre stable (pages web puis rendus), cas connus seulement.
  const orderIds = [...WEB_CASES, ...APP_CASES].map((c) => c.id);
  const out = orderIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
  await writeFile(MANIFEST, JSON.stringify(out, null, 2) + "\n");
  await writeFile(LOG, JSON.stringify(logAll, null, 2) + "\n");
  const imgs = out.reduce((s, e) => s + e.images.length, 0);
  console.log(
    `\nManifeste : ${out.length} cas, ${imgs} images → ${path.relative(process.cwd(), MANIFEST)}`,
  );
}

await main();
