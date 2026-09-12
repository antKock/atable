"use client";

// Graphiques du dashboard v3 (Recharts, composants client). Les tunnels, la
// table de cohortes et les tuiles sont rendus côté serveur (page.tsx) : ici
// seulement ce qui a besoin de SVG interactif.

import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  BarChart,
  LineChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useState } from "react";
import { PALETTE as P, FONT, MONO, axisProps, gridProps, cohortColor } from "@/lib/admin/palette";

/* eslint-disable @typescript-eslint/no-explicit-any */

const fr = (n: unknown) => (typeof n === "number" ? n.toLocaleString("fr-FR") : String(n ?? ""));

function Tip({ active, payload, label, suffix }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "rgba(251,248,241,0.97)", border: `1px solid ${P.border}`, borderRadius: 10, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 120 }}>
      {label != null && <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: P.muted, marginBottom: 8 }}>{label}</div>}
      {payload
        .filter((p: any) => p.value != null)
        .map((p: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i ? 5 : 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color || p.fill, flex: "none" }} />
            <span style={{ fontFamily: FONT, fontSize: 12.5, color: P.muted, flex: 1 }}>{p.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: P.ink }}>
              {fr(p.value)}
              {suffix || ""}
            </span>
          </div>
        ))}
    </div>
  );
}

export function Empty({ height = 200, sub }: { height?: number; sub?: string }) {
  return (
    <div className="chart-empty" style={{ height }}>
      <div className="ce-title">Données en cours d&apos;accumulation</div>
      <div className="ce-sub">{sub ?? "Cette métrique se remplit au fil de l'usage réel."}</div>
    </div>
  );
}

const total = (rows: any[], keys: string[]) => rows.reduce((s, r) => s + keys.reduce((a, k) => a + (Number(r[k]) || 0), 0), 0);

/** Sparkline nue (tuiles). */
export function Spark({ values, color = P.olive, height = 30 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  if (values.every((v) => v === 0)) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** North Star : aire 12 semaines. */
export function NorthStarChart({ labels, values, height = "100%" }: { labels: string[]; values: number[]; height?: number | `${number}%` }) {
  const data = labels.map((label, i) => ({ label, v: values[i] ?? 0 }));
  if (values.every((v) => v === 0)) return <Empty height={120} sub="Se remplit avec les jours actifs des personnes." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="gNs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.olive} stopOpacity={0.22} />
            <stop offset="100%" stopColor={P.olive} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={40} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="v" name="Cuisiniers actifs 28 j" stroke={P.olive} strokeWidth={2.2} fill="url(#gNs)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type Series = { key: string; name: string; color: string };

/** Barres empilées hebdo (personnes par canal, activation, mix des méthodes en %). */
export function StackedWeekly({
  data,
  series,
  height = 210,
  percent = false,
  markerLabel,
  markerGlyph,
  emptySub,
}: {
  data: any[];
  series: Series[];
  height?: number;
  percent?: boolean;
  /** Label d'axe X où poser un repère vertical. */
  markerLabel?: string | null;
  markerGlyph?: string;
  emptySub?: string;
}) {
  if (total(data, series.map((s) => s.key)) === 0) return <Empty height={height} sub={emptySub} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={30} />
        <YAxis {...axisProps} width={36} allowDecimals={false} domain={percent ? [0, 100] : undefined} tickFormatter={percent ? (v: number) => `${v}%` : undefined} />
        <Tooltip content={<Tip suffix={percent ? " %" : ""} />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="s" fill={s.color} radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined} maxBarSize={22} isAnimationActive={false} />
        ))}
        {markerLabel && <ReferenceLine x={markerLabel} stroke={P.faint} strokeDasharray="3 4" label={{ value: markerGlyph ?? "", position: "top", fontSize: 11, fill: P.muted }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Arrivées (fond gris) et activées (olive) par semaine d'arrivée. */
export function ActivationWeekly({ data, height = 210 }: { data: { label: string; arrivals: number; activated: number }[]; height?: number }) {
  if (total(data, ["arrivals"]) === 0) return <Empty height={height} sub="Se remplit avec les arrivées jugeables à J+7." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barGap={-18}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="arrivals" name="Arrivées" fill={P.grid} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Bar dataKey="activated" name="Activées" fill={P.oliveDeep} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Courbes de rétention M0 → M3, une par cohorte, repère marché en pointillé. */
export function RetentionCurves({ curves, refPct, height = 220 }: { curves: { month: string; label: string; points: (number | null)[] }[]; refPct?: number; height?: number }) {
  if (curves.length === 0) return <Empty height={height} sub="Une cohorte apparaît dès que son mois 1 est entièrement passé." />;
  const data = ["M0", "M1", "M2", "M3"].map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const c of curves) row[c.month] = c.points[i];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<Tip suffix=" %" />} />
        {refPct != null && <ReferenceLine y={refPct} stroke="#C9C2B2" strokeDasharray="2 3" />}
        {curves.map((c) => (
          <Line key={c.month} type="monotone" dataKey={c.month} name={c.label} stroke={cohortColor(c.month)} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Layer cake : cuisiniers actifs 28 j par mois d'arrivée. */
export function CohortCake({ data, keys, labels, height = 220 }: { data: any[]; keys: string[]; labels: string[]; height?: number }) {
  if (total(data, keys) === 0) return <Empty height={height} sub="Se remplit avec les jours actifs des personnes." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip content={<Tip />} />
        {keys.map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} name={labels[i]} stackId="g" stroke={P.surface} strokeWidth={1.5} fill={cohortColor(k)} fillOpacity={0.9} dot={false} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Distribution en barres (recettes par personne). */
export function Dist({ data, height = 170, color = P.olive }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  if (total(data, ["value"]) === 0) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="value" name="Personnes" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} label={{ position: "top", fontFamily: MONO, fontSize: 12, fill: P.ink }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mini-barres (14 jours) pour le bloc « 7 derniers jours ». La couleur de
 *  chaque barre dit si le jour est au-dessus (olive), égal (sable) ou en
 *  dessous (terracotta) de la médiane du MÊME jour de semaine sur les 4
 *  semaines précédentes — un dimanche bas n'est pas forcément anormal. La
 *  semaine précédente est atténuée. Info-bulle React immédiate. */
export function MiniBars({ values, days, refs, label, unit, height = 34 }: { values: number[]; days: string[]; refs: number[]; label: string; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const n = values.length;
  const fmtDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const weekday = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });
  const fmt = (v: number) => String(v).replace(".", ",");
  const status = (i: number) => (values[i] > refs[i] ? "above" : values[i] < refs[i] ? "below" : "equal");
  const color = (st: "above" | "below" | "equal") => (st === "above" ? P.olive : st === "below" ? P.terracotta : "#C9C2B2");
  const wording = (st: "above" | "below" | "equal") => (st === "above" ? "au-dessus de" : st === "below" ? "en dessous de" : "égal à");
  // Ancrage : à gauche sur le premier tiers, à droite sur le dernier, centré sinon — jamais coupé par le bord de la tuile.
  const anchor = (i: number) => (i < n / 3 ? "translateX(0)" : i > (2 * n) / 3 ? "translateX(-100%)" : "translateX(-50%)");
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }} aria-hidden="true">
        {values.map((v, i) => {
          const st = status(i);
          const active = hover === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default" }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(6, (v / max) * 100)}%`,
                  background: color(st),
                  borderRadius: 2,
                  opacity: active ? 1 : i >= n - 7 ? 0.95 : 0.45,
                  outline: active ? `2px solid ${P.ink}` : "none",
                  outlineOffset: 1,
                  transition: "opacity 80ms",
                }}
              />
            </div>
          );
        })}
      </div>
      {hover != null && days[hover] && (
        <div
          role="tooltip"
          className="mini-tip"
          onClick={() => setHover(null)}
          style={{
            // Desktop : flottante au-dessus des barres ; mobile (CSS .mini-tip) :
            // sous les barres, pleine largeur, texte qui replie.
            bottom: height + 8,
            left: `${((hover + 0.5) / n) * 100}%`,
            transform: anchor(hover),
            background: "rgba(251,248,241,0.98)",
            border: `1px solid ${P.border}`,
            borderRadius: 10,
            padding: "8px 11px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: P.muted }}>{fmtDay(days[hover])}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: color(status(hover)) === "#C9C2B2" ? P.ink : color(status(hover)) }}>
              {fmt(values[hover])}
              {unit ? ` ${unit}` : ""}
            </span>
            <span style={{ fontFamily: FONT, fontSize: 12, color: P.muted }}>{label.charAt(0).toLowerCase() + label.slice(1)}</span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: P.muted, marginTop: 3 }}>
            <b style={{ color: P.ink, fontWeight: 600 }}>{wording(status(hover))}</b> la médiane des 4 derniers {weekday(days[hover])}s : <span style={{ fontFamily: MONO }}>{fmt(refs[hover])}</span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.faint, marginTop: 2 }}>{hover >= n - 7 ? "7 derniers jours" : "semaine précédente"}</div>
        </div>
      )}
    </div>
  );
}

/** Taux du funnel App Store par semaine (3 courbes en %). */
export function StoreRates({ data, height = 200 }: { data: { label: string; imprToDl: number | null; dlToOpen: number | null; openToCarnet: number | null }[]; height?: number }) {
  if (data.every((d) => d.imprToDl == null && d.dlToOpen == null)) return <Empty height={height} sub="Se remplit avec les semaines de données Apple (depuis le 16 août)." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={30} />
        {/* Axe gauche : taux « pleins » (peuvent dépasser 100 % : ouvertures > téléchargements seuillés par Apple). Axe droit : impression → téléchargement (quelques %). */}
        <YAxis yAxisId="left" {...axisProps} width={40} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 20) * 20)]} tickFormatter={(v: number) => `${v}%`} />
        <YAxis yAxisId="right" orientation="right" {...axisProps} width={40} domain={[0, (max: number) => Math.max(5, Math.ceil(max))]} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<Tip suffix=" %" />} />
        <Line yAxisId="right" type="monotone" dataKey="imprToDl" name="Impression → téléchargement (axe droit)" stroke={P.ochre} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Line yAxisId="left" type="monotone" dataKey="dlToOpen" name="Téléchargement → 1ʳᵉ ouverture" stroke={P.olive} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        <Line yAxisId="left" type="monotone" dataKey="openToCarnet" name="Ouverture → 1er carnet" stroke={P.terracotta} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
