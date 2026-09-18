// Pool OCR Mijote — gabarits HTML/CSS de pages de livres et magazines de cuisine
// modernes (famille B de la catégorie « pages imprimées photographiées »).
//
// Chaque gabarit reçoit un cas de printed-modern.json et renvoie une ou deux pages
// HTML autonomes (polices système macOS, photos locales en file://). Le texte de la
// recette (titre, ingrédients, étapes, notes) est injecté À L'IDENTIQUE depuis
// `truth` : c'est ce qui fait de la vérité terrain un « texte injecté ».
//
// Les éléments hors recette (folio, titre courant, chapeau, recette voisine,
// publicité) sont volontaires : ce sont des pièges réels pour l'extraction.
//
// Gabarits : livre-colonne, magazine-3col, magazine-2col, livre-epure, fiche,
// photo-haut, pas-a-pas, livre-us.

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Libellés d'interface imprimés (hors vérité terrain, sauf mention).
const L = {
  fr: {
    ingredients: "Ingrédients",
    steps: "Préparation",
    prep: "Préparation",
    cook: "Cuisson",
    rest: "Repos",
    serves: (n) => `Pour ${n} personnes`,
    note: "Remarque",
    step: "Étape",
    cont: "Suite de la recette page suivante",
    contd: "(suite)",
  },
  en: {
    ingredients: "Ingredients",
    steps: "Method",
    prep: "Prep",
    cook: "Cook",
    rest: "Rest",
    serves: (n) => `Serves ${n}`,
    note: "Note",
    step: "Step",
    cont: "Continued on next page",
    contd: "(continued)",
  },
};

// Textes « voisins » (pièges) : rédigés pour le banc, hors vérité terrain.
const NEIGHBORS = {
  tian: {
    title: "Tian de légumes du soleil",
    text: "Préchauffez le four à 180 °C. Taillez en rondelles fines deux courgettes, trois tomates et deux pommes de terre. Rangez-les en rosace dans un plat huilé en alternant les couleurs, glissez entre les rangs quelques lamelles d'oignon…",
  },
  cornbread: {
    title: "Skillet Cornbread",
    text: "Heat a 10-inch cast-iron skillet in a 400°F oven. In a bowl, whisk 1 cup cornmeal, 1 cup flour, 1 tablespoon baking powder and a pinch of salt. In another bowl, beat 2 eggs with 1 cup buttermilk and…",
  },
  "autre-recette": {
    title: "Compote pommes-rhubarbe",
    ingredients: ["500 g de rhubarbe", "3 pommes", "80 g de sucre", "1 gousse de vanille"],
    text: "Épluchez la rhubarbe et coupez-la en tronçons. Faites-la compoter 15 minutes avec les pommes en dés, le sucre et la vanille fendue. Écrasez à la fourchette et laissez refroidir. Servez frais, avec un yaourt ou un sablé.",
  },
};

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { -webkit-font-smoothing: antialiased; }
  .page { position: relative; overflow: hidden; }
  ol, ul { list-style: none; }
`;

function doc(css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

function metaLine(c, sep = " · ") {
  const l = L[c.lang];
  const m = c.meta ?? {};
  return [
    m.prep && `${l.prep} ${m.prep}`,
    m.rest && `${l.rest} ${m.rest}`,
    m.cook && `${l.cook} ${m.cook}`,
  ]
    .filter(Boolean)
    .join(sep);
}

function servesText(c) {
  if (c.variant?.yield) return c.variant.yield;
  return c.truth.servings ? L[c.lang].serves(c.truth.servings) : "";
}

// Encadré astuce : libellé + texte ; sinon les notes de la vérité terrain.
function tipBox(c, cls = "tip") {
  const text = c.tip ?? c.truth.notes;
  if (!text) return "";
  const label = c.tip_label ?? L[c.lang].note;
  return `<div class="${cls}"><div class="tip-label">${esc(label)}</div><p>${esc(text)}</p></div>`;
}

const photoTag = (c, photos, cls) =>
  c.variant?.photo
    ? `<img class="${cls}" src="${photos[c.variant.photo]}">`
    : `<div class="${cls} aplat"></div>`;

// ---------------------------------------------------------------------------
// 1. Livre : colonne ingrédients à gauche, étapes numérotées à droite
// ---------------------------------------------------------------------------
function livreColonne(c) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 640px; height: 900px; background: #fbf8f2; font-family: "${v.font}", serif; color: #2a2522; padding: 48px 46px 40px; }
    .run { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8b8178; border-bottom: 1px solid #d8d0c4; padding-bottom: 6px; }
    .band { height: ${v.band ?? 100}px; margin: 22px -46px 0; background: linear-gradient(120deg, ${v.accent}, ${v.accent}cc 60%, #f1e2c8); }
    h1 { font-size: 34px; line-height: 1.1; margin: 22px 0 6px; color: ${v.accent}; font-weight: 600; }
    .intro { font-style: italic; font-size: 13.5px; line-height: 1.45; color: #5b524b; margin-bottom: 10px; }
    .meta { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #6c625a; margin-bottom: 18px; }
    .cols { display: grid; grid-template-columns: 200px 1fr; gap: 26px; }
    .ing { background: ${v.accent}14; padding: 14px 14px; border-top: 3px solid ${v.accent}; }
    h2 { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; margin-bottom: 10px; }
    .ing li { font-size: 12.5px; line-height: 1.35; margin-bottom: 7px; }
    .ing li.sub { font-weight: 700; margin-top: 10px; }
    .steps li { font-size: 12.5px; line-height: 1.42; margin-bottom: 8px; display: grid; grid-template-columns: 24px 1fr; }
    .steps li b { color: ${v.accent}; font-size: 15px; }
    .tip { margin-top: 12px; border-left: 3px solid ${v.accent}; padding: 6px 12px; font-size: 12px; line-height: 1.4; background: #fff; }
    .tip-label { font-weight: 700; text-transform: uppercase; font-size: 10.5px; letter-spacing: 1.5px; color: ${v.accent}; margin-bottom: 3px; }
    .folio { position: absolute; bottom: 20px; right: 46px; font-size: 12px; color: #8b8178; }
  `;
  const ings = t.ingredients
    .map((i) => (i.endsWith(":") ? `<li class="sub">${esc(i)}</li>` : `<li>${esc(i)}</li>`))
    .join("");
  const steps = t.steps.map((s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`).join("");
  const body = `<div class="page">
    <div class="run"><span>${esc(v.book)}</span><span>${esc(v.chapter)}</span></div>
    <div class="band"></div>
    <h1>${esc(t.title)}</h1>
    ${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ""}
    <div class="meta">${esc([servesText(c), metaLine(c)].filter(Boolean).join(" · "))}</div>
    <div class="cols">
      <div class="ing"><h2>${l.ingredients}</h2><ul>${ings}</ul></div>
      <div><h2>${l.steps}</h2><ol class="steps">${steps}</ol>${t.notes ? tipBox(c) : ""}</div>
    </div>
    <div class="folio">${v.folio}</div>
  </div>`;
  const pages = [{ html: doc(css, body), width: 640, height: 900 }];
  if (v.facing === "autre-recette")
    pages.facing = {
      html: doc(css, facingOtherRecipe(v, c)),
      width: 640,
      height: 900,
      side: "left",
    };
  return pages;
}

function facingOtherRecipe(v) {
  const n = NEIGHBORS["autre-recette"];
  return `<div class="page">
    <div class="run"><span>${v.folio - 1}</span><span>${esc(v.book)}</span></div>
    <h1 style="margin-top:40px">${esc(n.title)}</h1>
    <div class="meta">Pour 4 personnes · Préparation 10 min · Cuisson 15 min</div>
    <div class="cols">
      <div class="ing"><h2>Ingrédients</h2><ul>${n.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>
      <div><h2>Préparation</h2><p style="font-size:13px;line-height:1.5">${esc(n.text)}</p></div>
    </div>
    <div class="band" style="height:330px;margin-top:40px;background:linear-gradient(160deg,#c9577a,#e8a0a8 55%,#f6dfc9)"></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// 2. Magazine 3 colonnes : chapeau, lettrine, encadré, recette voisine
// ---------------------------------------------------------------------------
function magazine3col(c, photos) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const n = NEIGHBORS[v.neighbor];
  const css = `
    .page { width: 820px; height: 1090px; background: #fff; font-family: "Charter", "Georgia", serif; color: #1d1d1d; padding: 34px 40px; }
    .top { display: flex; justify-content: space-between; align-items: baseline; font-family: "Helvetica Neue", sans-serif; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 5px; }
    .top b { color: ${v.accent}; }
    .rubric { font-family: "Helvetica Neue", sans-serif; font-weight: 700; color: ${v.accent}; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-top: 18px; }
    h1 { font-family: "Bodoni 72", "Didot", serif; font-size: 50px; line-height: 1; margin: 6px 0 10px; }
    .chapo { font-size: 16px; line-height: 1.4; font-style: italic; color: #444; margin-bottom: 10px; max-width: 640px; }
    .meta { font-family: "Helvetica Neue", sans-serif; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; color: #555; padding: 5px 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin-bottom: 14px; }
    .hero { width: 100%; height: 230px; object-fit: cover; margin-bottom: 14px; display: block; }
    .hero.aplat { background: radial-gradient(circle at 30% 40%, #d9a441, #b8452e 45%, #3f5d2a 90%); }
    .cols { column-count: 3; column-gap: 24px; column-rule: 1px solid #e2e2e2; font-size: 12px; line-height: 1.5; text-align: justify; hyphens: auto; }
    .box { background: ${v.accent}15; border: 1px solid ${v.accent}66; padding: 10px 11px; margin-bottom: 12px; break-inside: avoid; text-align: left; }
    .cols h3 { break-after: avoid; }
    .box h3, .cols h3 { font-family: "Helvetica Neue", sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; margin: 0 0 6px; }
    .box li { margin-bottom: 3px; padding-left: 10px; text-indent: -10px; }
    .box li::before { content: "• "; color: ${v.accent}; }
    .steps p { margin-bottom: 7px; }
    .steps p b { font-family: "Helvetica Neue", sans-serif; color: ${v.accent}; margin-right: 4px; }
    .tip { break-inside: avoid; border-top: 2px solid ${v.accent}; padding-top: 6px; margin: 10px 0 12px; font-style: italic; }
    .tip-label { font-style: normal; font-family: "Helvetica Neue", sans-serif; font-weight: 700; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; color: ${v.accent}; }
    .neighbor { break-before: column; border-top: 4px solid #111; padding-top: 8px; }
    .neighbor h2 { font-family: "Bodoni 72", serif; font-size: 24px; line-height: 1.05; margin-bottom: 6px; }
    .ad { margin-top: 12px; padding: 12px; background: #111; color: #fff; font-family: "Futura", sans-serif; text-align: center; font-size: 13px; letter-spacing: 1px; }
    .folio { position: absolute; bottom: 16px; left: 40px; font-family: "Helvetica Neue", sans-serif; font-size: 11px; }
  `;
  const notes = t.notes ? tipBox(c) : "";
  const body = `<div class="page">
    <div class="top"><span><b>${esc(v.magazine)}</b></span><span>${esc(v.issue)}</span></div>
    <div class="rubric">${esc(v.rubric)}</div>
    <h1>${esc(t.title)}</h1>
    ${c.intro ? `<p class="chapo">${esc(c.intro)}</p>` : ""}
    <div class="meta">${esc([servesText(c), metaLine(c)].filter(Boolean).join("  |  "))}</div>
    ${photoTag(c, photos, "hero")}
    <div class="cols">
      <div class="box"><h3>${l.ingredients}</h3><ul>${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>
      <h3>${l.steps}</h3>
      <div class="steps">${t.steps.map((s, i) => `<p><b>${i + 1}.</b>${esc(s)}</p>`).join("")}</div>
      ${notes}
      <div class="neighbor"><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p>
        <div class="ad">${c.lang === "fr" ? "ABONNEZ-VOUS<br>1 an = 11 numéros · 39 €" : "SUBSCRIBE TODAY<br>12 issues for $24"}</div></div>
    </div>
    <div class="folio">${v.folio} · ${esc(v.magazine)}</div>
  </div>`;
  return [{ html: doc(css, body), width: 820, height: 1090 }];
}

// ---------------------------------------------------------------------------
// 3. Magazine 2 colonnes avec colonne latérale colorée
// ---------------------------------------------------------------------------
function magazine2col(c) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 820px; height: 1090px; background: #fffdf8; font-family: "Avenir Next", sans-serif; color: #232323; display: grid; grid-template-columns: 250px 1fr; }
    .side { background: ${v.accent}; color: #1b1405; padding: 40px 24px; }
    .side .rub { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700; }
    .side h2 { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin: 36px 0 10px; border-bottom: 2px solid #1b1405; padding-bottom: 4px; }
    .side li { font-size: 13px; line-height: 1.35; margin-bottom: 8px; }
    .side .meta { margin-top: 24px; font-size: 12px; line-height: 1.6; font-weight: 600; }
    .main { padding: 40px 38px; }
    .top { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #777; display: flex; justify-content: space-between; }
    h1 { font-family: "Rockwell", "Superclarendon", serif; font-size: 42px; line-height: 1.05; margin: 26px 0 12px; }
    .chapo { font-size: 15px; line-height: 1.45; color: #555; margin-bottom: 20px; }
    .aplat { height: 250px; border-radius: 4px; margin-bottom: 20px; background: radial-gradient(ellipse at 40% 45%, #f2b33d, #d86a1f 50%, #5b2c12 95%); }
    .steps { column-count: 2; column-gap: 26px; font-size: 13px; line-height: 1.5; }
    .steps li { break-inside: avoid; margin-bottom: 10px; }
    .steps li b { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: ${v.accent}; text-align: center; line-height: 22px; font-size: 12px; margin-right: 6px; }
    .tip { margin-top: 16px; border: 2px dashed ${v.accent}; padding: 10px 14px; font-size: 12.5px; line-height: 1.45; }
    .tip-label { font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-size: 11px; margin-bottom: 4px; }
    .folio { position: absolute; bottom: 18px; right: 38px; font-size: 11px; color: #777; }
  `;
  const body = `<div class="page">
    <div class="side"><div class="rub">${esc(v.rubric)}</div>
      <h2>${l.ingredients}</h2><ul>${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      <div class="meta">${esc(servesText(c))}<br>${esc(metaLine(c, "\n")).replaceAll("\n", "<br>")}</div></div>
    <div class="main">
      <div class="top"><span>${esc(v.magazine)}</span><span>${esc(v.issue)}</span></div>
      <h1>${esc(t.title)}</h1>
      ${c.intro ? `<p class="chapo">${esc(c.intro)}</p>` : ""}
      <div class="aplat"></div>
      <ol class="steps">${t.steps.map((s, i) => `<li><b>${i + 1}</b>${esc(s)}</li>`).join("")}</ol>
      ${tipBox(c)}
    </div>
    <div class="folio">${v.folio}</div>
  </div>`;
  return [{ html: doc(css, body), width: 820, height: 1090 }];
}

// ---------------------------------------------------------------------------
// 4. Livre épuré : grand titre, ingrédients en deux colonnes, encadré
// ---------------------------------------------------------------------------
function livreEpure(c) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 640px; height: 900px; background: #fdfcf9; font-family: "${v.font}", serif; color: #222; padding: 60px 56px 40px; }
    .kicker { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: ${v.accent}; text-align: center; }
    h1 { font-size: 40px; font-weight: 400; text-align: center; margin: 10px 0 8px; }
    .rule { width: 60px; height: 2px; background: ${v.accent}; margin: 0 auto 12px; }
    .intro { text-align: center; font-style: italic; font-size: 14px; line-height: 1.45; color: #555; margin: 0 20px 14px; }
    .meta { text-align: center; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #666; margin-bottom: 20px; }
    h2 { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: ${v.accent}; margin: 10px 0 8px; font-weight: 400; }
    .ing { column-count: 2; column-gap: 30px; font-size: 13px; line-height: 1.4; margin-bottom: 16px; }
    .ing li { break-inside: avoid; padding: 3px 0; border-bottom: 1px dotted #ccc; }
    .steps p { font-size: 13px; line-height: 1.5; margin-bottom: 8px; text-align: justify; }
    .steps p b { color: ${v.accent}; font-size: 16px; margin-right: 6px; }
    .tip { margin-top: 10px; background: ${v.accent}1a; padding: 10px 14px; font-size: 12.5px; line-height: 1.4; }
    .tip-label { font-size: 10.5px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; margin-bottom: 3px; }
    .folio { position: absolute; bottom: 22px; width: 100%; left: 0; text-align: center; font-size: 12px; color: #888; }
  `;
  const body = `<div class="page">
    <div class="kicker">${esc(v.book)}</div>
    <h1>${esc(t.title)}</h1><div class="rule"></div>
    ${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ""}
    <div class="meta">${esc([servesText(c), metaLine(c)].filter(Boolean).join(" — "))}</div>
    <h2>${l.ingredients}</h2><ul class="ing">${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <h2>${l.steps}</h2><div class="steps">${t.steps.map((s, i) => `<p><b>${i + 1}</b>${esc(s)}</p>`).join("")}</div>
    ${tipBox(c)}
    <div class="folio">${v.folio}</div>
  </div>`;
  const pages = [{ html: doc(css, body), width: 640, height: 900 }];
  if (v.facing === "photo-aplat")
    pages.facing = {
      html: doc(
        css +
          `.full{position:absolute;inset:0;background:radial-gradient(circle at 45% 55%,#e9b35c,#b8662b 40%,#5e2a14 80%,#2b140b)} .q{position:absolute;bottom:60px;left:0;width:100%;text-align:center;color:#fff;font-size:30px;letter-spacing:2px}`,
        `<div class="page"><div class="full"></div><div class="q">${esc(v.facingText)}</div></div>`,
      ),
      width: 640,
      height: 900,
      side: "left",
    };
  return pages;
}

// ---------------------------------------------------------------------------
// 5. Fiche cartonnée paysage (collection de fiches recettes)
// ---------------------------------------------------------------------------
function fiche(c, photos) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 1000px; height: 660px; background: #fffaf0; font-family: "${v.font}", sans-serif; color: #262626; border: 14px solid ${v.accent}; padding: 22px 26px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${v.accent}; padding-bottom: 8px; }
    .coll { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; font-weight: 700; }
    h1 { font-size: 30px; line-height: 1.1; margin-top: 2px; }
    .diff { font-size: 12px; text-align: right; color: #555; line-height: 1.5; }
    .diff i { color: ${v.accent}; font-style: normal; letter-spacing: 3px; font-size: 15px; }
    .grid { display: grid; grid-template-columns: 300px 1fr; gap: 26px; margin-top: 14px; }
    .ph { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 10px; display: block; }
    .ph.aplat { background: linear-gradient(135deg, #f0d9a8, ${v.accent}); }
    h2 { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; margin-bottom: 6px; }
    .ing li { font-size: 12.5px; line-height: 1.3; padding: 2px 0 2px 14px; position: relative; }
    .ing li::before { content: "■"; position: absolute; left: 0; font-size: 8px; top: 5px; color: ${v.accent}; }
    .ing li.sub { padding-left: 0; font-weight: 700; margin-top: 6px; }
    .ing li.sub::before { content: ""; }
    .steps li { font-size: 13px; line-height: 1.45; margin-bottom: 7px; counter-increment: s; padding-left: 26px; position: relative; }
    .steps li::before { content: counter(s); position: absolute; left: 0; top: 0; width: 19px; height: 19px; border-radius: 50%; background: ${v.accent}; color: #fff; font-size: 11px; text-align: center; line-height: 19px; font-weight: 700; }
    .tip { margin-top: 8px; font-size: 12px; line-height: 1.4; color: #444; border-top: 1px dashed ${v.accent}; padding-top: 6px; }
    .tip-label { display: inline; font-weight: 700; color: ${v.accent}; margin-right: 6px; }
    .tip p { display: inline; }
  `;
  const stars = "★".repeat(v.stars) + "☆".repeat(3 - v.stars);
  const ings = t.ingredients
    .map((i) => (i.endsWith(":") ? `<li class="sub">${esc(i)}</li>` : `<li>${esc(i)}</li>`))
    .join("");
  const body = `<div class="page">
    <div class="head"><div><div class="coll">${esc(v.collection)}</div><h1>${esc(t.title)}</h1></div>
      <div class="diff">${esc(servesText(c))}<br>${esc(metaLine(c))}<br><i>${stars}</i></div></div>
    <div class="grid">
      <div>${v.photo ? photoTag(c, photos, "ph") : ""}<h2>${l.ingredients}</h2><ul class="ing">${ings}</ul></div>
      <div><h2>${l.steps}</h2><ol class="steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>${t.notes ? tipBox(c) : ""}</div>
    </div>
  </div>`;
  return [{ html: doc(css, body), width: 1000, height: 660 }];
}

// ---------------------------------------------------------------------------
// 6. Photo pleine largeur en haut, texte en deux colonnes dessous
// ---------------------------------------------------------------------------
function photoHaut(c, photos) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 640px; height: 900px; background: #fff; font-family: "${v.font}", serif; color: #202020; }
    .ph { width: 100%; height: 330px; object-fit: cover; display: block; }
    .txt { padding: 18px 40px 30px; }
    h1 { font-size: 30px; line-height: 1.1; color: ${v.accent}; }
    .meta { font-family: "Helvetica Neue", sans-serif; font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #777; margin: 6px 0 12px; }
    .cols { display: grid; grid-template-columns: 180px 1fr; gap: 22px; }
    h2 { font-family: "Helvetica Neue", sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; color: ${v.accent}; }
    .ing li { font-size: 11.5px; line-height: 1.35; margin-bottom: 5px; }
    .steps li { font-size: 12px; line-height: 1.45; margin-bottom: 6px; }
    .steps li b { font-family: "Helvetica Neue", sans-serif; color: ${v.accent}; margin-right: 5px; }
    .tip { margin-top: 8px; padding: 7px 10px; background: ${v.accent}18; font-size: 11.5px; line-height: 1.4; }
    .tip-label { font-family: "Helvetica Neue", sans-serif; font-weight: 700; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: ${v.accent}; }
    .folio { position: absolute; bottom: 14px; left: 40px; font-family: "Helvetica Neue", sans-serif; font-size: 11px; color: #999; }
  `;
  const body = `<div class="page">
    ${photoTag(c, photos, "ph")}
    <div class="txt">
      <h1>${esc(t.title)}</h1>
      <div class="meta">${esc([servesText(c), metaLine(c)].filter(Boolean).join(" · "))}</div>
      <div class="cols">
        <div><h2>${l.ingredients}</h2><ul class="ing">${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>
        <div><h2>${l.steps}</h2><ol class="steps">${t.steps.map((s, i) => `<li><b>${i + 1}.</b>${esc(s)}</li>`).join("")}</ol>${c.tip ? tipBox(c) : ""}</div>
      </div>
    </div>
    <div class="folio">${v.folio} — ${esc(v.book)}</div>
  </div>`;
  return [{ html: doc(css, body), width: 640, height: 900 }];
}

// ---------------------------------------------------------------------------
// 7. Pas-à-pas magazine sur deux pages (étapes en vignettes numérotées)
// ---------------------------------------------------------------------------
function pasAPas(c) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 820px; height: 1090px; background: #fff; font-family: "${v.font}", sans-serif; color: #1c1c1c; padding: 36px 40px; }
    .top { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; font-weight: 700; border-bottom: 3px solid ${v.accent}; padding-bottom: 6px; }
    h1 { font-size: 52px; line-height: 1; margin: 22px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
    .chapo { font-size: 16px; line-height: 1.4; color: #444; margin-bottom: 14px; }
    .meta { display: flex; gap: 22px; font-size: 13px; margin-bottom: 18px; }
    .meta span { background: ${v.accent}; color: #fff; padding: 4px 10px; border-radius: 12px; }
    .ingbox { border: 2px solid #1c1c1c; padding: 14px 18px; margin-bottom: 22px; }
    .ingbox h2, h2 { font-size: 15px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
    .ingbox ul { column-count: 2; column-gap: 28px; }
    .ingbox li { font-size: 13.5px; line-height: 1.35; margin-bottom: 6px; break-inside: avoid; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
    .card .img { height: 150px; border-radius: 4px; margin-bottom: 8px; }
    .card .n { font-size: 30px; font-weight: 700; color: ${v.accent}; line-height: 1; }
    .card p { font-size: 13px; line-height: 1.45; }
    .tip { margin-top: 26px; background: #1c1c1c; color: #fff; padding: 16px 20px; font-size: 14px; line-height: 1.45; }
    .tip-label { color: ${v.accent}; filter: brightness(1.6); font-weight: 700; text-transform: uppercase; letter-spacing: 2px; font-size: 12px; margin-bottom: 4px; }
    .cont { margin-top: 14px; text-align: right; font-size: 12px; font-style: italic; color: #666; }
    .folio { position: absolute; bottom: 16px; right: 40px; font-size: 11px; }
    .ad { margin-top: 26px; height: 250px; background: linear-gradient(135deg,#f4f0e6,#e6dcc6); display: flex; align-items: center; justify-content: center; font-size: 26px; font-family: "Didot", serif; color: #6d5a3c; text-align: center; line-height: 1.3; }
  `;
  const hues = ["#e8c8a0", "#d9a07a", "#c7836a", "#b86e55", "#a65d47", "#8f4f3d"];
  const card = (s, i) =>
    `<div class="card"><div class="img" style="background:linear-gradient(145deg,${hues[i % 6]},${hues[(i + 2) % 6]})"></div><div class="n">${i + 1}</div><p>${esc(s)}</p></div>`;
  const split = v.split;
  const p1 = `<div class="page">
    <div class="top"><span>${esc(v.magazine)}</span><span>${l.step} ${c.lang === "fr" ? "par" : "by"} ${l.step.toLowerCase()}</span></div>
    <h1>${esc(t.title)}</h1>
    ${c.intro ? `<p class="chapo">${esc(c.intro)}</p>` : ""}
    <div class="meta"><span>${esc(servesText(c))}</span>${c.meta.prep ? `<span>${l.prep} ${esc(c.meta.prep)}</span>` : ""}${c.meta.cook ? `<span>${l.cook} ${esc(c.meta.cook)}</span>` : ""}</div>
    <div class="ingbox"><h2>${l.ingredients}</h2><ul>${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>
    <div class="grid">${t.steps.slice(0, split).map(card).join("")}</div>
    <div class="cont">${l.cont} →</div>
    <div class="folio">${v.folio}</div>
  </div>`;
  const p2 = `<div class="page">
    <div class="top"><span>${esc(v.magazine)}</span><span>${esc(t.title)} ${l.contd}</span></div>
    <div class="grid" style="margin-top:30px">${t.steps
      .slice(split)
      .map((s, i) => card(s, i + split))
      .join("")}</div>
    ${tipBox(c)}
    <div class="ad">${c.lang === "fr" ? "Le mois prochain :<br>spécial conserves maison" : "Next month:<br>the preserving issue"}</div>
    <div class="folio">${v.folio + 1}</div>
  </div>`;
  return [
    { html: doc(css, p1), width: 820, height: 1090 },
    { html: doc(css, p2), width: 820, height: 1090 },
  ];
}

// ---------------------------------------------------------------------------
// 8. Livre anglo-saxon : « Serves / Prep / Cook », mesures US, méthode numérotée
//    (sur deux pages si `pages: 2` : photo + ingrédients, puis méthode)
// ---------------------------------------------------------------------------
function livreUS(c, photos) {
  const v = c.variant;
  const l = L[c.lang];
  const t = c.truth;
  const css = `
    .page { width: 640px; height: 900px; background: #fbfaf7; font-family: "${v.font}", serif; color: #1f1f1f; padding: 50px 50px 40px; }
    .run { font-family: "Gill Sans", sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #999; }
    h1 { font-size: 36px; line-height: 1.05; margin: 18px 0 10px; color: ${v.accent}; }
    .intro { font-size: 14px; line-height: 1.5; color: #444; margin-bottom: 14px; }
    .stats { display: flex; gap: 0; border-top: 1px solid #bbb; border-bottom: 1px solid #bbb; margin-bottom: 18px; font-family: "Gill Sans", sans-serif; }
    .stats div { flex: 1; padding: 6px 0; text-align: center; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; border-right: 1px solid #ddd; }
    .stats div:last-child { border-right: 0; }
    .stats b { display: block; font-size: 14px; letter-spacing: 0; text-transform: none; color: ${v.accent}; }
    h2 { font-family: "Gill Sans", sans-serif; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: ${v.accent}; margin-bottom: 8px; }
    .ing li { font-size: 13.5px; line-height: 1.4; padding: 3px 0; border-bottom: 1px solid #eee; }
    .steps li { font-size: 13.5px; line-height: 1.5; margin-bottom: 10px; display: grid; grid-template-columns: 26px 1fr; }
    .steps li b { font-family: "Gill Sans", sans-serif; color: ${v.accent}; }
    .ph { width: calc(100% + 100px); margin: -50px -50px 18px; height: 320px; object-fit: cover; display: block; }
    .tip { margin-top: 12px; border: 1px solid ${v.accent}; padding: 10px 14px; font-size: 12.5px; line-height: 1.45; }
    .tip-label { font-family: "Gill Sans", sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${v.accent}; margin-bottom: 3px; }
    .two { display: grid; grid-template-columns: 210px 1fr; gap: 26px; }
    .folio { position: absolute; bottom: 20px; right: 50px; font-family: "Gill Sans", sans-serif; font-size: 11px; color: #999; }
  `;
  const stats = `<div class="stats"><div>${c.lang === "fr" ? "Portions" : "Yield"}<b>${esc(servesText(c))}</b></div>${c.meta.prep ? `<div>${l.prep}<b>${esc(c.meta.prep)}</b></div>` : ""}${c.meta.cook ? `<div>${l.cook}<b>${esc(c.meta.cook)}</b></div>` : ""}</div>`;
  const ing = `<h2>${l.ingredients}</h2><ul class="ing">${t.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  const steps = `<h2>${l.steps}</h2><ol class="steps">${t.steps.map((s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`).join("")}</ol>`;
  if ((c.pages ?? 1) === 1) {
    const body = `<div class="page"><div class="run">${esc(v.book)}</div><h1>${esc(t.title)}</h1>
      ${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ""}${stats}
      <div class="two"><div>${ing}</div><div>${steps}${tipBox(c)}</div></div>
      <div class="folio">${v.folio}</div></div>`;
    return [{ html: doc(css, body), width: 640, height: 900 }];
  }
  const p1 = `<div class="page">${v.photo ? `<img class="ph" src="${photos[v.photo]}">` : ""}
    <div class="run">${esc(v.book)}</div><h1>${esc(t.title)}</h1>
    ${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ""}${stats}${ing}
    <div class="folio">${v.folio}</div></div>`;
  const p2 = `<div class="page"><div class="run">${esc(v.book)} — ${esc(t.title)}</div>
    <div style="height:24px"></div>${steps}${tipBox(c)}
    <div class="folio">${v.folio + 1}</div></div>`;
  return [
    { html: doc(css, p1), width: 640, height: 900 },
    { html: doc(css, p2), width: 640, height: 900 },
  ];
}

export const TEMPLATES = {
  "livre-colonne": livreColonne,
  "magazine-3col": magazine3col,
  "magazine-2col": magazine2col,
  "livre-epure": livreEpure,
  fiche,
  "photo-haut": photoHaut,
  "pas-a-pas": pasAPas,
  "livre-us": livreUS,
};

/** Pages HTML d'un cas (une par image). `photos` : clé → URL file:// locale. */
export function renderCase(c, photos) {
  const fn = TEMPLATES[c.template];
  if (!fn) throw new Error(`gabarit inconnu : ${c.template}`);
  return fn(c, photos);
}
