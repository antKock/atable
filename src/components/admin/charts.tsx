"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  BarChart,
  PieChart,
  RadialBarChart,
  Line,
  Area,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadialBar,
  PolarAngleAxis,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { PALETTE as P, FONT, MONO, axisTick, axisProps, gridProps } from "@/lib/admin/palette";

const fr = (n: unknown) => (typeof n === "number" ? n.toLocaleString("fr-FR") : String(n ?? ""));

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ---------- shared tooltip ---------- */
export function Tip({ active, payload, label, suffix }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "rgba(251,248,241,0.97)",
        backdropFilter: "blur(6px)",
        border: `1px solid ${P.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        minWidth: 120,
      }}
    >
      {label != null && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: P.muted,
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
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

/* ---------- empty / accumulating state ---------- */
export function ChartEmpty({ height = 220, sub }: { height?: number; sub?: string }) {
  return (
    <div className="chart-empty" style={{ height }}>
      <div className="ce-title">Données en cours d&apos;accumulation</div>
      <div className="ce-sub">{sub ?? "Cette métrique se remplit au fil de l'usage réel (heartbeat)."}</div>
    </div>
  );
}

const sum = (arr: any[], keys: string[]) =>
  arr.reduce((s, r) => s + keys.reduce((a, k) => a + (Number(r[k]) || 0), 0), 0);

/* ---------- repères d'époque partagés ----------
   Barre verticale = changement de définition/mesure (un avant/après à garder
   en tête en lisant la courbe). Zone grisée = période NON mesurée (rien à lire
   du tout). Les libellés vivent dans les notes de bas de carte, pas sur le
   tracé. NB : Recharts ne reconnaît que ses propres éléments comme enfants —
   d'où des props inline dans chaque chart plutôt qu'un composant wrapper. */
export type NotMeasuredRange = { from: string; to: string } | null | undefined;

const epochMarkerProps = (glyph: string) => ({
  stroke: P.faint,
  strokeDasharray: "3 4",
  label: { value: glyph, position: "top" as const, fontSize: 12, fill: P.muted },
});

const notMeasuredProps = { fill: P.grid, fillOpacity: 0.35, stroke: "none" } as const;

/* ---------- donut side legend ---------- */
function LegendList({ items, unit = "" }: { items: any[]; unit?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, paddingRight: 4 }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: "none" }} />
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: P.muted, flex: 1, lineHeight: 1.2 }}>{d.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: P.ink }}>
            {fr(d.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- KPI sparkline ---------- */
export function Sparkline({ data, color = P.olive, height = 34 }: { data: any[]; color?: string; height?: number }) {
  if (!data || !data.length) return null;
  const id = `spark-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ==================== 01 — FUNNEL DÉMO → CARNET ==================== */

/**
 * Liste de barres horizontales HTML (funnel démo, partage, funnel de
 * récupération) : quelques valeurs étiquetées, pas besoin de Recharts.
 */
export function HBarList({
  rows,
  colors,
  height,
}: {
  rows: { label: string; value: number; hint?: string }[];
  colors?: string[];
  height?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const defaultColors = [P.oliveSoft, P.olive, P.oliveDeep, P.terracotta];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: height, justifyContent: "center", padding: "4px 0" }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 40%) 1fr", gap: 10, alignItems: "center" }}>
          <div style={{ fontFamily: FONT, fontSize: 12, color: P.muted, textAlign: "right", lineHeight: 1.25 }}>{r.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: `${Math.max(3, (r.value / max) * 100)}%`,
                maxWidth: "calc(100% - 64px)",
                height: 18,
                borderRadius: 4,
                background: (colors ?? defaultColors)[i % (colors ?? defaultColors).length],
              }}
            />
            <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 500, color: P.ink, whiteSpace: "nowrap" }}>
              {fr(r.value)}
              {r.hint && <span style={{ fontFamily: FONT, fontSize: 10.5, color: P.faint, marginLeft: 6 }}>{r.hint}</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Essais démo (barres) + conversions en 1er carnet (ligne).
export function ChartTrialsDaily({
  data,
  marker,
  notMeasuredBefore,
  height = 240,
}: {
  data: any[];
  marker?: string | null;
  notMeasuredBefore?: NotMeasuredRange;
  height?: number;
}) {
  if (sum(data, ["trials", "conversions"]) === 0)
    return <ChartEmpty height={height} sub="Les essais démo apparaissent dès la première session « Essayer l'app »." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<Tip />} />
        {notMeasuredBefore && <ReferenceArea x1={notMeasuredBefore.from} x2={notMeasuredBefore.to} {...notMeasuredProps} />}
        <Bar dataKey="trials" name="Essais démo" fill={P.oliveSoft} radius={[2, 2, 0, 0]} maxBarSize={10} />
        <Line type="monotone" dataKey="conversions" name="Conversions" stroke={P.terracotta} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        {marker && <ReferenceLine x={marker} {...epochMarkerProps("➁")} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Recettes ajoutées en démo par jour (agrégat 032, consolidé chaque nuit).
export function ChartDemoActivity({ data, height = 210 }: { data: any[]; height?: number }) {
  if (sum(data, ["recettes"]) === 0)
    return <ChartEmpty height={height} sub="Se remplit à mesure que le rollup nocturne consolide l'activité démo (migration 032)." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={36} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="recettes" name="Recettes ajoutées en démo" fill={P.sage} radius={[3, 3, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==================== 02 — PERSONNES ACTIVES ==================== */

export function ChartWauMau({ data, marker, height = 260 }: { data: any[]; marker?: string | null; height?: number }) {
  if (sum(data, ["wau", "mau"]) === 0) return <ChartEmpty height={height} sub="WAU/MAU se construit dès que les personnes reviennent (heartbeat)." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gMau" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.olive} stopOpacity={0.2} />
            <stop offset="100%" stopColor={P.olive} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<Tip />} />
        {/* Ancienne métrique appareils en filigrane : l'écart avec MAU personnes
            visualise le bruit des identités fantômes. */}
        <Line type="monotone" dataKey="mauDevices" name="MAU appareils (ancienne métrique)" stroke={P.faint} strokeWidth={1.6} strokeDasharray="4 5" dot={false} activeDot={{ r: 3 }} />
        <Area type="monotone" dataKey="mau" name="MAU personnes" stroke={P.olive} strokeWidth={2.2} fill="url(#gMau)" dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="wau" name="WAU personnes" stroke={P.terracotta} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        {marker && <ReferenceLine x={marker} {...epochMarkerProps("➀")} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ChartStickiness({ data, marker, height = 172 }: { data: any[]; marker?: string | null; height?: number }) {
  if (sum(data, ["stickiness"]) === 0) return <ChartEmpty height={height} sub="Le ratio WAU/MAU apparaît avec les premiers retours d'appareils." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gSticky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.sage} stopOpacity={0.25} />
            <stop offset="100%" stopColor={P.sage} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={36} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<Tip suffix=" %" />} />
        <Area type="monotone" dataKey="stickiness" name="Stickiness" stroke={P.sage} strokeWidth={2} fill="url(#gSticky)" dot={false} activeDot={{ r: 4 }} />
        {marker && <ReferenceLine x={marker} {...epochMarkerProps("➀")} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Distribution générique en barres verticales sur {bin, value} — fréquence
 * d'usage, appareils/personne, carnets/personne, recettes/carnet.
 */
export function ChartBins({
  data,
  name,
  color = P.olive,
  height = 220,
  emptySub,
}: {
  data: any[];
  name: string;
  color?: string;
  height?: number;
  emptySub?: string;
}) {
  if (sum(data, ["value"]) === 0) return <ChartEmpty height={height} sub={emptySub ?? "La distribution se remplit avec l'usage réel."} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="bin" {...axisProps} />
        <YAxis {...axisProps} width={44} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="value" name={name} fill={color} radius={[5, 5, 0, 0]} maxBarSize={54} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Parc cumulé — personnes + carnets, une seule échelle (mêmes ordres de
// grandeur). Les recettes cumulées, d'échelle incomparable, vivent en
// section 04 (décision maquette v2 : pas de double axe).
export function ChartParc({ data, marker, height = 280 }: { data: any[]; marker?: string | null; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gParcOwn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.olive} stopOpacity={0.18} />
            <stop offset="100%" stopColor={P.olive} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gParcCar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.sage} stopOpacity={0.2} />
            <stop offset="100%" stopColor={P.sage} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={48} allowDecimals={false} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="personnes" name="Personnes (total)" stroke={P.olive} strokeWidth={2.2} fill="url(#gParcOwn)" dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="carnets" name="Carnets (total)" stroke={P.sage} strokeWidth={2} fill="url(#gParcCar)" dot={false} activeDot={{ r: 4 }} />
        {marker && <ReferenceLine x={marker} {...epochMarkerProps("➀")} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ==================== 03 — CARNETS & CERCLES ==================== */

// Personnes par carnet, empilées membre/invité (remplace la « taille des
// foyers » qui comptait des cookie jars).
export function ChartPeoplePerCarnet({ data, height = 220 }: { data: any[]; height?: number }) {
  if (sum(data, ["membres", "invites"]) === 0)
    return <ChartEmpty height={height} sub="Se remplit avec les memberships (modèle owners, Lot 0)." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="bin" {...axisProps} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="membres" name="Membres" stackId="p" fill={P.olive} maxBarSize={48} />
        <Bar dataKey="invites" name="Invités" stackId="p" fill={P.ochre} maxBarSize={48} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==================== 04 — CONTENU & PARTAGE ==================== */

export function ChartRecipeCreation({ data, height = 250 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gCreate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.olive} stopOpacity={0.22} />
            <stop offset="100%" stopColor={P.olive} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="total" name="Recettes créées" stroke={P.olive} strokeWidth={2} fill="url(#gCreate)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ChartAddMethods({ data, height = 210 }: { data: any[]; height?: number }) {
  if (sum(data, ["value"]) === 0) return <ChartEmpty height={height} sub="La méthode d'ajout est enregistrée sur les nouvelles recettes." />;
  return (
    <div style={{ display: "flex", alignItems: "center", height, gap: 8 }}>
      <div style={{ flex: "0 0 56%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Tip suffix=" %" />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <LegendList items={data} unit="%" />
    </div>
  );
}

export function ChartMethodMix({ data, height = 210 }: { data: any[]; height?: number }) {
  if (!data.length) return <ChartEmpty height={height} sub="Le mix mensuel apparaît avec l'historique des nouvelles recettes." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
        <Tooltip content={<Tip suffix=" %" />} cursor={{ fill: "rgba(110,122,56,0.05)" }} />
        <Bar dataKey="manual" name="Saisie manuelle" stackId="m" fill={P.olive} maxBarSize={40} />
        <Bar dataKey="url" name="Import URL" stackId="m" fill={P.ochre} maxBarSize={40} />
        <Bar dataKey="photo" name="Photo" stackId="m" fill={P.terracotta} maxBarSize={40} />
        <Bar dataKey="voice" name="Vocal" stackId="m" fill={P.sage} maxBarSize={40} />
        <Bar dataKey="shared" name="Partagée" stackId="m" fill={P.clay} maxBarSize={40} />
        <Bar dataKey="unknown" name="Indéterminé" stackId="m" fill="#C9C2B2" maxBarSize={40} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartTopHouseholds({ data, height = 250 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={P.grid} strokeDasharray="2 5" horizontal={false} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="name" {...axisProps} width={120} tick={{ ...axisTick, fontSize: 11.5, fill: P.muted }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(110,122,56,0.06)" }} />
        <Bar dataKey="recettes" name="Recettes" fill={P.olive} radius={[0, 5, 5, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==================== Rétention & jauges ==================== */

export function ChartRetention({ data, cohorts, height = 250 }: { data: any[]; cohorts: string[]; height?: number }) {
  const colors = [P.olive, P.ochre, P.clay];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<Tip suffix=" %" />} />
        {cohorts.map((c, i) => (
          <Line
            key={c}
            type="monotone"
            dataKey={c}
            name={`Cohorte ${cap(c)}`}
            stroke={colors[i % colors.length]}
            strokeWidth={i === 0 ? 2.4 : 2}
            strokeDasharray={i === 2 ? "4 3" : undefined}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GaugeRadial({ value, color = P.olive, height = 190, label, big }: { value: number; color?: string; height?: number; label?: string; big?: boolean }) {
  const data = [{ name: label || "v", value }];
  const gid = `gauge-${(label || "v").replace(/\s/g, "")}`;
  return (
    <div style={{ position: "relative", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={220} endAngle={-40} barSize={14}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: P.grid }} dataKey="value" cornerRadius={8} fill={`url(#${gid})`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          transform: "translateY(8%)",
        }}
      >
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: big ? 40 : 32, color: P.ink, lineHeight: 1 }}>
          {value}
          <span style={{ fontSize: big ? 20 : 16, color: P.muted }}>%</span>
        </div>
        {label && <div style={{ fontFamily: FONT, fontSize: 11.5, color: P.muted, marginTop: 6 }}>{label}</div>}
      </div>
    </div>
  );
}

/* ==================== 06 — QUALITÉ & COÛT IA ==================== */

export function ChartAiPipeline({ data, success, height = 200 }: { data: any[]; success: number; height?: number }) {
  if (sum(data, ["value"]) === 0) return <ChartEmpty height={height} sub="Aucune recette enrichie pour l'instant." />;
  return (
    <div style={{ display: "flex", alignItems: "center", height, gap: 8 }}>
      <div style={{ flex: "0 0 54%", height: "100%", position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Tip suffix=" %" />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, color: P.olive, lineHeight: 1 }}>
            {String(success).replace(".", ",")}%
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.muted, marginTop: 3 }}>succès</div>
        </div>
      </div>
      <LegendList items={data} unit="%" />
    </div>
  );
}

// Daily OpenAI spend (USD), stacked by usage type.
export function ChartAiCostTrend({
  data,
  notMeasuredBefore,
  height = 230,
}: {
  data: any[];
  notMeasuredBefore?: NotMeasuredRange;
  height?: number;
}) {
  if (sum(data, ["total"]) === 0)
    return <ChartEmpty height={height} sub="Le coût IA se remplit dès le prochain import ou enrichissement (en USD)." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={36} />
        <YAxis {...axisProps} width={48} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip content={<Tip suffix=" $" />} />
        {notMeasuredBefore && <ReferenceArea x1={notMeasuredBefore.from} x2={notMeasuredBefore.to} {...notMeasuredProps} />}
        <Area type="monotone" dataKey="ocr" name="Lecture OCR" stackId="c" stroke={P.ochre} fill={P.ochre} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="metadata" name="Métadonnées" stackId="c" stroke={P.sage} fill={P.sage} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="image" name="Génération image" stackId="c" stroke={P.terracotta} fill={P.terracotta} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="import_url" name="Import web" stackId="c" stroke={P.clay} fill={P.clay} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="import_instagram" name="Import Instagram" stackId="c" stroke={P.olive} fill={P.olive} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="import_crawler" name="Import web (anti-blocage)" stackId="c" stroke={P.oliveSoft} fill={P.oliveSoft} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="import_voice" name="Import vocal" stackId="c" stroke={P.oliveDeep} fill={P.oliveDeep} fillOpacity={0.25} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="demo" name="Démo (toutes catégories)" stackId="c" stroke="#C9C2B2" fill="#C9C2B2" fillOpacity={0.35} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// OpenAI spend share by usage type (donut, USD).
export function ChartCostByType({ data, height = 200 }: { data: any[]; height?: number }) {
  if (sum(data, ["value"]) === 0) return <ChartEmpty height={height} sub="Aucune dépense IA sur la période." />;
  return (
    <div style={{ display: "flex", alignItems: "center", height, gap: 8 }}>
      <div style={{ flex: "0 0 50%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="88%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Tip suffix=" $" />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <LegendList items={data} unit=" $" />
    </div>
  );
}

export function ChartPlatforms({ data, height = 200 }: { data: any[]; height?: number }) {
  if (sum(data, ["value"]) === 0) return <ChartEmpty height={height} sub="La plateforme se renseigne sur les nouvelles recettes (via l'appareil créateur)." />;
  return (
    <div style={{ display: "flex", alignItems: "center", height, gap: 8 }}>
      <div style={{ flex: "0 0 54%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="88%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Tip suffix=" %" />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <LegendList items={data} unit="%" />
    </div>
  );
}
