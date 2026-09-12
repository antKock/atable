// Digest hebdo (spec stats v3 §4.9) : le bloc 1 en texte, envoyé le lundi.
// Rendu pur depuis `Overview` (assembleV3) — une seule définition des chiffres
// entre la page et l'e-mail. Texte brut + HTML minimal, 15 lignes, lisible sur
// téléphone, aucun graphique.

import type { Overview } from "@/lib/admin/v3/assemble";

export type Digest = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderDigest(o: Overview, opts: { weekLabel: string; statsUrl: string }): Digest {
  const ns = o.northStar;
  const delta = `${ns.delta >= 0 ? "+" : ""}${ns.delta}`;
  const health = o.health.ok
    ? "Santé : tout est au vert (pipeline IA, crons, démo)."
    : `Santé : ${[!o.health.pipeline.ok && `pipeline IA — ${o.health.pipeline.detail}`, !o.health.crons.ok && `crons — ${o.health.crons.detail}`, !o.health.demo.ok && `démo — ${o.health.demo.detail}`].filter(Boolean).join(" ; ")}.`;

  const lines: string[] = [
    `Mijote — ${opts.weekLabel}`,
    "",
    `Cuisiniers actifs (28 j) : ${ns.value} (${delta} vs 4 semaines plus tôt, ${ns.fourWeeksAgo}) · ${ns.engaged} ont ajouté ou consulté une recette · ${ns.total} personnes au total`,
    "",
    ...o.tiles.map((t) => `${t.label} : ${t.value}${t.unit ? ` ${t.unit}` : ""}${t.fragile ? " (fragile)" : ""} — ${t.compare}`),
    "",
    "Ce qui a bougé :",
    ...(o.moved.length ? o.moved.map((m) => `- ${m}`) : ["- rien de notable cette semaine"]),
    "",
    health,
    "",
    `Dashboard : ${opts.statsUrl}`,
  ];
  const text = lines.join("\n");

  const row = (label: string, value: string, sub: string, fragile?: boolean) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #e8e0cc"><div style="font-size:12px;color:#6b6e68">${esc(label)}</div><div style="font-family:ui-monospace,Menlo,monospace;font-size:22px;${fragile ? "color:#9a968c" : "color:#1a1a18"}">${esc(value)}</div><div style="font-size:12px;color:#6b6e68">${esc(sub)}</div></td></tr>`;

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f1ecdf;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf8f1;border:1px solid #e8e0cc;border-radius:14px">
<tr><td style="padding:22px 22px 6px">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6e7a38;font-weight:600">Mijote · ${esc(opts.weekLabel)}</div>
  <div style="font-size:12px;color:#6b6e68;margin-top:6px">North Star · cuisiniers actifs · 28 jours</div>
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:48px;line-height:1;margin-top:4px">${ns.value}</div>
  <div style="font-size:13px;color:${ns.delta < 0 ? "#b85c3d" : "#5d6a2e"};font-weight:600;margin-top:4px">${esc(delta)} vs 4 semaines plus tôt (${ns.fourWeeksAgo})</div>
  <div style="font-size:12.5px;color:#6b6e68;margin-top:2px">dont ${ns.engaged} ont ajouté ou consulté une recette · ${ns.total} personnes au total</div>
</td></tr>
<tr><td style="padding:6px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${o.tiles.map((t) => row(t.label, `${t.value}${t.unit ? ` ${t.unit}` : ""}`, t.compare, t.fragile)).join("")}
</table></td></tr>
<tr><td style="padding:14px 22px 4px">
  <div style="font-size:13px;font-weight:600">Ce qui a bougé</div>
  <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.5">${o.moved.length ? o.moved.map((m) => `<li>${esc(m)}</li>`).join("") : "<li>rien de notable cette semaine</li>"}</ul>
</td></tr>
<tr><td style="padding:12px 22px 22px">
  <div style="font-size:12.5px;color:${o.health.ok ? "#5d6a2e" : "#b85c3d"}">${esc(health)}</div>
  <div style="margin-top:14px"><a href="${esc(opts.statsUrl)}" style="display:inline-block;background:#6e7a38;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600">Ouvrir le dashboard</a></div>
</td></tr>
</table></td></tr></table></body></html>`;

  return {
    subject: `Mijote — ${opts.weekLabel} : ${ns.value} cuisiniers actifs (${delta})${o.health.ok ? "" : " · ⚠ santé"}`,
    text,
    html,
  };
}
