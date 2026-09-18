// Gabarits HTML des captures « appli » fabriquées (lus par build-screenshots.mjs).
// Chaque gabarit renvoie une page 390×844 : barre d'état fixe, en-tête d'appli,
// un conteneur défilant #scroll (le contenu), éventuellement une barre du bas.
// Le texte affiché vient de `c.display` (ou de `c.truth` pour les gabarits
// structurés) : il doit correspondre exactement à la vérité terrain.

const FONT = `-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif`;

function shell({ statusBar, bg, fg, header = "", footer = "", body, css = "" }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;width:390px;height:844px;overflow:hidden;background:${bg};color:${fg};font-family:${FONT};-webkit-font-smoothing:antialiased}
  .screen{display:flex;flex-direction:column;height:844px}
  #scroll{flex:1;overflow-y:auto;scrollbar-width:none}
  #scroll::-webkit-scrollbar{display:none}
  ${css}
  </style></head><body><div class="screen">${statusBar}${header}<div id="scroll">${body}</div>${footer}</div></body></html>`;
}

// Mise en forme légère d'un texte brut : liens de hashtags, retours à la ligne.
function richText(text, esc, { hashtagColor } = {}) {
  let h = esc(text);
  if (hashtagColor)
    h = h.replace(/(#[\p{L}\p{N}_]+)/gu, `<span style="color:${hashtagColor}">$1</span>`);
  return h.replace(/\n/g, "<br>");
}

// --- Apple Notes -------------------------------------------------------------
function notes(c, { statusBar, esc }) {
  const d = !!c.dark;
  const bg = d ? "#000" : "#fff";
  const fg = d ? "#fff" : "#000";
  const accent = "#e2a300";
  const header = `<div style="height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;color:${accent};font-size:17px">
    <span style="display:flex;align-items:center;gap:4px"><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="${accent}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(c.folder ?? "Notes")}</span>
    <span style="display:flex;gap:22px;align-items:center">
      <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 2v12M6 7l5-5 5 5M4 11v8h14v-8" stroke="${accent}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="${accent}" stroke-width="1.8" fill="none"/><circle cx="7.5" cy="12" r="1.4" fill="${accent}"/><circle cx="12" cy="12" r="1.4" fill="${accent}"/><circle cx="16.5" cy="12" r="1.4" fill="${accent}"/></svg>
    </span></div>`;
  const footer = `<div style="height:84px;border-top:0.5px solid ${d ? "#333" : "#ddd"};display:flex;justify-content:space-around;padding-top:12px;color:${accent};font-size:22px">
    <span>☑︎</span><span>📎</span><span>✎</span><span>✍︎</span></div>`;
  // Lignes : "# Titre" (titre), "## Sous-titre" (en-tête), "- " (puce),
  // "[ ] " (case à cocher), "1. " (liste numérotée), texte brut sinon.
  const lines = c.display.split("\n").map((l) => {
    if (l.startsWith("# "))
      return `<div style="font-size:28px;font-weight:700;margin:6px 0 10px">${esc(l.slice(2))}</div>`;
    if (l.startsWith("## "))
      return `<div style="font-size:20px;font-weight:600;margin:14px 0 4px">${esc(l.slice(3))}</div>`;
    if (l.startsWith("[ ] "))
      return `<div style="display:flex;gap:10px;align-items:flex-start;margin:5px 0"><span style="flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid ${d ? "#666" : "#bbb"};margin-top:1px"></span><span>${esc(l.slice(4))}</span></div>`;
    if (l.startsWith("- "))
      return `<div style="display:flex;gap:10px;margin:2px 0"><span style="flex:none">•</span><span>${esc(l.slice(2))}</span></div>`;
    const m = l.match(/^(\d+)\. (.*)$/);
    if (m)
      return `<div style="display:flex;gap:8px;margin:3px 0"><span style="flex:none;min-width:18px">${m[1]}.</span><span>${esc(m[2])}</span></div>`;
    if (!l.trim()) return `<div style="height:12px"></div>`;
    return `<div style="margin:2px 0">${esc(l)}</div>`;
  });
  const date = `<div style="text-align:center;color:#8e8e93;font-size:13px;margin:6px 0 8px">${esc(c.date ?? "12 septembre 2026 à 18:42")}</div>`;
  return shell({
    statusBar,
    bg,
    fg,
    header,
    footer,
    body: `${date}<div style="padding:0 20px 40px;font-size:17px;line-height:1.35">${lines.join("")}</div>`,
  });
}

// --- iMessage / WhatsApp -------------------------------------------------------
function messages(c, { statusBar, esc }) {
  const wa = c.look === "WhatsApp";
  const d = !!c.dark;
  const bg = wa ? (d ? "#0b141a" : "#efe7de") : d ? "#000" : "#fff";
  const fg = d ? "#e9edef" : "#000";
  const inBg = wa ? (d ? "#202c33" : "#fff") : d ? "#262628" : "#e9e9eb";
  const outBg = wa ? (d ? "#005c4b" : "#d9fdd3") : "#0a84ff";
  const outFg = wa ? fg : "#fff";
  const header = wa
    ? `<div style="height:56px;display:flex;align-items:center;gap:10px;padding:0 12px;background:${d ? "#1f2c34" : "#f6f6f6"};border-bottom:0.5px solid ${d ? "#222" : "#ddd"}">
        <svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="${d ? "#e9edef" : "#007aff"}" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>
        <span style="color:${d ? "#e9edef" : "#007aff"};font-size:17px">12</span>
        <div style="width:36px;height:36px;border-radius:50%;background:${c.avatarColor ?? "#c7a17a"};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600">${esc(c.contact[0])}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:16px">${esc(c.contact)}</div><div style="font-size:12px;color:#8696a0">${esc(c.presence ?? "en ligne")}</div></div>
        <span style="font-size:20px;color:${d ? "#e9edef" : "#007aff"}">📹</span><span style="font-size:20px;color:${d ? "#e9edef" : "#007aff"}">📞</span></div>`
    : `<div style="height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;background:${d ? "#1c1c1e" : "#f6f6f6"};border-bottom:0.5px solid ${d ? "#333" : "#ddd"}">
        <svg style="position:absolute;left:14px;top:30px" width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="#0a84ff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(#a5abb9,#858994);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:20px">${esc(
          c.contact
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2),
        )}</div>
        <div style="font-size:12px;margin-top:4px">${esc(c.contact)} ›</div></div>`;
  const footer = wa
    ? `<div style="height:84px;display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:${d ? "#1f2c34" : "#f6f6f6"}"><span style="font-size:24px;color:#8696a0">＋</span><div style="flex:1;height:36px;border-radius:18px;background:${d ? "#2a3942" : "#fff"}"></div><span style="font-size:22px">📷</span><span style="font-size:22px">🎙️</span></div>`
    : `<div style="height:84px;display:flex;align-items:flex-start;gap:10px;padding:8px 12px"><span style="width:34px;height:34px;border-radius:50%;background:${d ? "#333" : "#e9e9eb"};display:flex;align-items:center;justify-content:center;font-size:22px;color:#8e8e93">+</span><div style="flex:1;height:36px;border-radius:18px;border:1px solid ${d ? "#444" : "#ccc"};color:#8e8e93;padding:8px 14px;font-size:16px">iMessage</div></div>`;
  const parts = c.messages.map((m) => {
    if (m.day)
      return `<div style="text-align:center;font-size:12px;color:#8e8e93;margin:14px 0 8px">${esc(m.day)}</div>`;
    const out = m.from === "me";
    const time = wa
      ? `<span style="float:right;font-size:11px;color:${d ? "#8696a0" : "#667781"};margin:8px 0 -4px 10px">${esc(m.time ?? "18:42")}${out ? " ✓✓" : ""}</span>`
      : "";
    return `<div style="display:flex;justify-content:${out ? "flex-end" : "flex-start"};margin:3px 0">
      <div style="max-width:78%;padding:${wa ? "6px 9px" : "8px 13px"};border-radius:${wa ? "8px" : "18px"};background:${out ? outBg : inBg};color:${out ? outFg : fg};font-size:${wa ? "16px" : "17px"};line-height:1.3;white-space:normal;word-wrap:break-word">${richText(m.text, esc)}${time}</div></div>`;
  });
  return shell({
    statusBar,
    bg,
    fg,
    header,
    footer,
    body: `<div style="padding:4px 12px 16px">${parts.join("")}</div>`,
  });
}

// --- Instagram --------------------------------------------------------------
function instagram(c, { statusBar, esc }) {
  const d = !!c.dark;
  const bg = d ? "#000" : "#fff";
  const fg = d ? "#f5f5f5" : "#000";
  const header = `<div style="height:44px;display:flex;align-items:center;gap:14px;padding:0 14px;border-bottom:0.5px solid ${d ? "#262626" : "#dbdbdb"}">
    <svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="${fg}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
    <div style="flex:1;text-align:center;font-weight:600;font-size:16px;margin-right:26px">Publications</div></div>`;
  const footer = `<div style="height:84px;border-top:0.5px solid ${d ? "#262626" : "#dbdbdb"};display:flex;justify-content:space-around;padding-top:12px;font-size:24px">
    <span>⌂</span><span>⌕</span><span>⊕</span><span>▶︎</span><span style="width:26px;height:26px;border-radius:50%;background:${c.avatar}"></span></div>`;
  const icons = `<div style="display:flex;gap:16px;padding:10px 14px 4px;font-size:25px;align-items:center">
    <svg width="26" height="24" viewBox="0 0 26 24"><path d="M13 22S2 15 2 8a5.5 5.5 0 0 1 11-1 5.5 5.5 0 0 1 11 1c0 7-11 14-11 14z" stroke="${fg}" stroke-width="2" fill="none"/></svg>
    <svg width="24" height="24" viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z" stroke="${fg}" stroke-width="2" fill="none"/></svg>
    <svg width="24" height="24" viewBox="0 0 24 24"><path d="M22 3L2 10l8 3 3 8 9-18zM10 13l5-5" stroke="${fg}" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>
    <span style="flex:1"></span>
    <svg width="20" height="24" viewBox="0 0 20 24"><path d="M3 2h14v20l-7-6-7 6z" stroke="${fg}" stroke-width="2" fill="none" stroke-linejoin="round"/></svg></div>`;
  const photo = `<div style="height:${c.photoHeight ?? 390}px;background:${c.photoBg};display:flex;align-items:center;justify-content:center;font-size:120px">${c.photoEmoji ?? ""}</div>`;
  const body = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px">
      <div style="width:34px;height:34px;border-radius:50%;padding:2px;background:linear-gradient(45deg,#feda75,#d62976,#4f5bd5)"><div style="width:100%;height:100%;border-radius:50%;border:2px solid ${bg};background:${c.avatar}"></div></div>
      <div style="flex:1;font-weight:600;font-size:14px">${esc(c.username)}${c.verified ? ' <span style="color:#3897f0">✔︎</span>' : ""}<div style="font-weight:400;font-size:12px">${esc(c.location ?? "")}</div></div>
      <span style="font-size:18px">•••</span></div>
    ${photo}${icons}
    <div style="padding:2px 14px;font-size:14px;font-weight:600">${esc(c.likes)}</div>
    <div style="padding:4px 14px 10px;font-size:14px;line-height:1.4"><b>${esc(c.username)}</b> ${richText(c.display, esc, { hashtagColor: d ? "#e0f1ff" : "#00376b" })}</div>
    <div style="padding:0 14px 6px;font-size:14px;color:#8e8e8e">${esc(c.commentsLabel ?? "Voir les 214 commentaires")}</div>
    <div style="padding:0 14px 20px;font-size:12px;color:#8e8e8e">${esc(c.when ?? "3 septembre")}</div>`;
  return shell({ statusBar, bg, fg, header, footer, body });
}

// --- Appli de recettes (fiche structurée) -----------------------------------
function recipeApp(c, { statusBar, esc }) {
  const t = c.truth;
  const accent = c.accent ?? "#ff5a36";
  const header = `<div style="height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:17px;color:${accent}">
    <span>‹ ${esc(c.backLabel ?? "Recettes")}</span><span style="display:flex;gap:18px"><span>♡</span><span>⇪</span></span></div>`;
  const footer = `<div style="height:84px;border-top:0.5px solid #ddd;display:flex;justify-content:space-around;padding-top:10px;font-size:10px;color:#8e8e93;text-align:center">
    ${["Accueil", "Recherche", "Planning", "Courses", "Profil"].map((l, i) => `<div style="color:${i === 0 ? accent : "#8e8e93"}"><div style="font-size:22px">${["⌂", "⌕", "▦", "☰", "◯"][i]}</div>${l}</div>`).join("")}</div>`;
  let ing = "";
  for (const line of t.ingredients) {
    if (line.startsWith("// ")) {
      ing += `<div style="font-weight:700;font-size:15px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.4px;color:#555">${esc(line.slice(3))}</div>`;
      continue;
    }
    // Quantité en gras dans une colonne à gauche, puis le nom (façon Jow &
    // co). Le texte lu de gauche à droite reste exactement la ligne de vérité.
    const m = line.match(c.qtyRe ?? /^$/);
    const [qty, name] = m ? [m[1], m[2]] : ["", line];
    ing += `<div style="display:flex;gap:12px;padding:11px 0;border-bottom:0.5px solid #e5e5ea;font-size:16px"><span style="flex:none;width:96px;font-weight:700">${esc(qty)}</span><span>${esc(name)}</span></div>`;
  }
  let steps = "";
  let n = 0;
  for (const s of t.steps) {
    if (s.startsWith("// ")) {
      steps += `<div style="font-weight:700;font-size:15px;margin:16px 0 4px;text-transform:uppercase;color:#555">${esc(s.slice(3))}</div>`;
      continue;
    }
    n++;
    steps += `<div style="display:flex;gap:12px;margin:12px 0"><span style="flex:none;width:28px;height:28px;border-radius:50%;background:${accent};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px">${n}</span><span style="font-size:16px;line-height:1.4">${esc(s)}</span></div>`;
  }
  const body = `
    <div style="height:${c.photoHeight ?? 220}px;background:${c.photoBg};display:flex;align-items:center;justify-content:center;font-size:90px">${c.photoEmoji ?? ""}</div>
    <div style="padding:16px 18px 30px">
      <div style="font-size:26px;font-weight:800;line-height:1.15">${esc(t.title)}</div>
      <div style="display:flex;gap:14px;color:#6c6c70;font-size:14px;margin:8px 0 14px">${(c.meta ?? []).map((m) => `<span>${esc(m)}</span>`).join("")}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:#f2f2f7;border-radius:12px;padding:10px 14px;font-size:16px">
        <span>${esc(c.servingsLabel)}</span><span style="display:flex;gap:14px;align-items:center;font-weight:600"><span style="color:${accent};font-size:22px">−</span>${t.servings}<span style="color:${accent};font-size:22px">+</span></span></div>
      <div style="font-size:21px;font-weight:700;margin:22px 0 6px">${esc(c.ingredientsLabel)}</div>${ing}
      <div style="font-size:21px;font-weight:700;margin:24px 0 4px">${esc(c.stepsLabel)}</div>${steps}
      ${t.notes ? `<div style="background:#fff6e5;border-radius:12px;padding:12px 14px;font-size:15px;margin-top:14px"><b>${esc(c.notesLabel ?? "Astuce")}</b><br>${esc(t.notes)}</div>` : ""}
    </div>`;
  return shell({ statusBar, bg: "#fff", fg: "#1c1c1e", header, footer, body });
}

// --- PDF ouvert dans l'app Fichiers ------------------------------------------
function pdfViewer(c, { statusBar, esc }) {
  const header = `<div style="height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:17px;color:#007aff;background:#f9f9f9;border-bottom:0.5px solid #ccc">
    <span>OK</span><span style="color:#000;font-weight:600;font-size:15px">${esc(c.fileName)}</span><span>⇪</span></div>`;
  const body = `<div style="background:#8e8e93;padding:10px 8px 40px">
    <div style="background:#fff;padding:26px 22px 40px;font-family:Georgia,'Times New Roman',serif;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.3)">${c.html}</div>
    <div style="text-align:center;color:#fff;font:12px ${FONT};margin-top:8px">1 sur 1</div></div>`;
  return shell({ statusBar, bg: "#8e8e93", fg: "#000", header, body });
}

export function renderApp(c, ctx) {
  switch (c.subtype) {
    case "app-notes":
      return notes(c, ctx);
    case "app-messages":
      return messages(c, ctx);
    case "instagram":
      return instagram(c, ctx);
    case "app-other":
      return c.look === "PDF (app Fichiers)" ? pdfViewer(c, ctx) : recipeApp(c, ctx);
    default:
      throw new Error(`sous-type inconnu : ${c.subtype}`);
  }
}
