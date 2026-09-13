// Briques serveur du dashboard v3 (pas de "use client") : barre, cartes,
// tunnels, définitions dépliables, grands chiffres. Partagées par
// /admin/stats, /admin/explorer et /admin/sante.

import type { ReactNode } from "react";
import { type Ratio, nLabel, pctLabel } from "@/lib/admin/v3/ratio";

export function Topbar({ current, dataDate }: { current: "stats" | "explorer" | "sante"; dataDate: string }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="name">Mijote</span>
        <span className="ctx">Dashboard</span>
      </div>
      <div className="toplinks">
        <span>
          Données au <b>{dataDate}</b> · Apple J-1 · 12 semaines
        </span>
        <a href="/admin/stats" className={current === "stats" ? "active" : undefined}>Pilotage</a>
        <a href="/admin/explorer" className={current === "explorer" ? "active" : undefined}>Explorer</a>
        <a href="/admin/sante" className={current === "sante" ? "active" : undefined}>Santé</a>
      </div>
    </div>
  );
}

export function SectionHead({ n, title, q }: { n: string; title: string; q?: string }) {
  return (
    <div className="section-head">
      <span className="n">{n}</span>
      <h2>{title}</h2>
      {q && <span className="q">{q}</span>}
    </div>
  );
}

/** ⓘ dépliable : définition, formule, réserve. */
export function Def({ children }: { children: ReactNode }) {
  return (
    <details className="def">
      <summary aria-label="Définition">i</summary>
      <div>{children}</div>
    </details>
  );
}

export function Card({
  title,
  sub,
  span = 6,
  def,
  tag,
  children,
  footer,
}: {
  title: string;
  sub?: string;
  span?: number;
  def?: ReactNode;
  tag?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="card" style={{ gridColumn: `span ${span}` }}>
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {tag}
        {def && <Def>{def}</Def>}
      </div>
      {children}
      {footer}
    </div>
  );
}

export type FunnelRow = { label: string; value: number; hint?: string; color?: string };

const FUNNEL_COLORS = ["#A8B490", "#6E7A38", "#5D6A2E", "#B85C3D", "#C0922F"];

export function Funnel({ rows }: { rows: FunnelRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="funnel">
      {rows.map((r, i) => (
        <div className="frow" key={r.label}>
          <div className="l">{r.label}</div>
          <div className="b">
            <div className="bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color ?? FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
            <span className="v">
              {r.value.toLocaleString("fr-FR")}
              {r.hint && <small>{r.hint}</small>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ligne « libellé · barre · n / N » (activation par méthode, sources). */
export function BarRow({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color?: string }) {
  return (
    <div className="r">
      <span>{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: value === 0 ? "var(--d-grid)" : color }} />
      </div>
      <span className="v">{text}</span>
    </div>
  );
}

export function BigStats({ stats }: { stats: { value: ReactNode; label: string; hint?: ReactNode }[] }) {
  return (
    <div className="big">
      {stats.map((s, i) => (
        <div key={s.label} style={{ display: "contents" }}>
          {i > 0 && <div className="hr" />}
          <div className="bs">
            <div className="v">{s.value}</div>
            <div className="l">{s.label}</div>
            {s.hint && <div className="h">{s.hint}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** « 22 % » + « 2 / 9 » — grisé si fragile. */
export function RatioText({ r, big }: { r: Ratio; big?: boolean }) {
  const title = r.margin != null ? `N = ${r.total} : marge ± ${r.margin} pts` : undefined;
  return (
    <span title={title} style={r.fragile ? { color: "var(--d-faint)" } : undefined}>
      {pctLabel(r)}
      {big ? <small> {nLabel(r)}</small> : <span style={{ fontFamily: "var(--d-sans)", fontSize: 11, color: "var(--d-faint)", marginLeft: 6 }}>{nLabel(r)}</span>}
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
