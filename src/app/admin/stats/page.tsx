import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getDashboardData, type KpiCard, type Signal } from "@/lib/admin/queries";
import { PALETTE as P } from "@/lib/admin/palette";
import FilterBar from "@/components/admin/FilterBar";
import {
  Sparkline,
  ChartWauMau,
  ChartStickiness,
  ChartLoginFreq,
  ChartAcquisition,
  ChartParc,
  ChartHouseholdSize,
  ChartRecipeCreation,
  ChartRecipesPerHousehold,
  ChartAddMethods,
  ChartMethodMix,
  ChartTopHouseholds,
  ChartRetention,
  GaugeRadial,
  ChartAiPipeline,
  ChartAiCostTrend,
  ChartCostByType,
  ChartPlatforms,
} from "@/components/admin/charts";
import "./dashboard.css";

export const dynamic = "force-dynamic";

// USD formatter — OpenAI bills in dollars, so the cost section stays in $.
const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`;

function Cocotte({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <g stroke="var(--d-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55">
        <path d="M28 17 Q30 13 28 9 Q26 5 28 1" />
        <path d="M40 15 Q42 11 40 7 Q38 3 40 -1" />
        <path d="M52 17 Q54 13 52 9 Q50 5 52 1" />
      </g>
      <rect x="3" y="38" width="6" height="9" rx="3" fill="var(--d-accent)" />
      <rect x="71" y="38" width="6" height="9" rx="3" fill="var(--d-accent)" />
      <path d="M9 36 Q9 32 13 32 L67 32 Q71 32 71 36 L71 56 Q71 64 61 64 L19 64 Q9 64 9 56 Z" fill="var(--d-accent)" />
      <path d="M10 30 Q10 22 40 22 Q70 22 70 30 Z" fill="var(--d-accent)" opacity="0.78" />
      <circle cx="40" cy="19" r="2.5" fill="var(--d-accent)" opacity="0.78" />
    </svg>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {up ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
    </svg>
  );
}

function Kpi({ k }: { k: KpiCard }) {
  return (
    <div className="kpi">
      <div className="klabel">{k.label}</div>
      <div className="ksub">{k.sub}</div>
      <div className="kval">{k.value}</div>
      {k.total && <div className="ktotal-line">/ {k.total} au total</div>}
      {k.delta != null && (
        <div className={"kdelta " + (k.positive ? "pos" : "neg")}>
          <Arrow up={!!k.positive} /> {k.delta > 0 ? "+" : ""}
          {String(k.delta).replace(".", ",")}
          {k.suffix ? " " + k.suffix : " %"}
        </div>
      )}
      {k.spark && k.spark.length > 0 && (
        <div className="kspark">
          <Sparkline data={k.spark} color={k.positive === false ? P.terracotta : P.olive} height={34} />
        </div>
      )}
    </div>
  );
}

function SignalTile({ s }: { s: Signal }) {
  return (
    <div className={"signal" + (s.warn ? " warn" : "")}>
      <div className="sval">{s.value}</div>
      <div className="slabel">{s.label}</div>
      <div className="shint">{s.hint}</div>
    </div>
  );
}

function Card({
  title,
  sub,
  badge,
  span = 6,
  children,
  footer,
}: {
  title: string;
  sub?: string;
  badge?: string;
  span?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ gridColumn: `span ${span}` }}>
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {badge && <span className="card-badge">{badge}</span>}
      </div>
      {children}
      {footer}
    </div>
  );
}

function SectionHead({ n, title, meta }: { n: string; title: string; meta?: string }) {
  return (
    <div className="section-head">
      <span className="n">{n}</span>
      <h2>{title}</h2>
      {meta && <span className="meta">{meta}</span>}
    </div>
  );
}

type LegendItem = { label: string; color: string; dash?: boolean };
function LegendInline({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend-inline">
      {items.map((it) => (
        <div className="li" key={it.label}>
          <span className={"sw" + (it.dash ? " dash" : "")} style={{ background: it.dash ? undefined : it.color, color: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const hdrs = await headers();
  if (!isAdmin(hdrs.get("x-household-id"))) notFound();

  const sp = await searchParams;
  const rawPlatform = typeof sp.platform === "string" ? sp.platform : undefined;
  const platform = rawPlatform === "ios" || rawPlatform === "android" || rawPlatform === "web" ? rawPlatform : null;

  const data = await getDashboardData({ platform });
  const dormant = data.signals.find((s) => s.warn)?.value ?? "0";

  return (
    <div className="mijote-dash">
      <div className="topbar">
        <div className="brand">
          <Cocotte size={24} />
          <span className="name">Mijote</span>
          <span className="sep" />
          <span className="ctx">Dashboard d&apos;usage</span>
        </div>
        <div className="topbar-right">
          <span className="toplink" style={{ color: "var(--d-faint)" }}>
            Données réelles · prod
          </span>
          <button className="btn-ghost" type="button">
            Exporter
          </button>
        </div>
      </div>

      <FilterBar />

      <div className="page">
        {/* KPI row */}
        <div className="kpi-row">
          {data.kpis.map((k) => (
            <Kpi key={k.id} k={k} />
          ))}
        </div>

        {/* Signals */}
        <div className="signals">
          {data.signals.map((s) => (
            <SignalTile key={s.label} s={s} />
          ))}
        </div>

        {/* 01 — Activité & fidélité */}
        <div className="section">
          <SectionHead n="01" title="Activité & fidélité" meta="Reviennent-ils, et à quelle fréquence ?" />
          <div className="cards">
            <Card
              span={8}
              title="Appareils actifs — WAU / MAU"
              sub="Fenêtre glissante 7 j / 30 j, échantillonnée par jour sur 90 jours"
              badge="WAU · MAU"
              footer={<LegendInline items={[{ label: "MAU", color: P.olive }, { label: "WAU", color: P.terracotta }]} />}
            >
              <ChartWauMau data={data.wauMau} height={260} />
            </Card>
            <Card span={4} title="Stickiness" sub="Ratio WAU / MAU — fidélité d'usage">
              <ChartStickiness data={data.wauMau} height={172} />
            </Card>
            <Card span={6} title="Fréquence de connexion" sub="Distribution : nb de jours actifs / mois / appareil">
              <ChartLoginFreq data={data.loginFrequency} height={220} />
            </Card>
            <Card span={6} title="Profondeur d'usage" sub="Recettes ajoutées par jour actif & signaux de churn">
              <div style={{ display: "flex", gap: 20, height: 220, alignItems: "stretch" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
                  <div>
                    <div style={{ fontFamily: "var(--d-mono)", fontSize: 38, fontWeight: 500, lineHeight: 1 }}>
                      {String(data.depth.toFixed(1)).replace(".", ",")}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--d-muted)", marginTop: 6 }}>recettes / jour actif</div>
                  </div>
                  <div style={{ height: 1, background: "var(--d-border)" }} />
                  <div>
                    <div style={{ fontFamily: "var(--d-mono)", fontSize: 38, fontWeight: 500, lineHeight: 1, color: "var(--d-neg)" }}>{dormant}</div>
                    <div style={{ fontSize: 12.5, color: "var(--d-muted)", marginTop: 6 }}>foyers dormants (+30 j)</div>
                  </div>
                </div>
                <div style={{ flex: "0 0 50%", borderLeft: "1px solid var(--d-border)", paddingLeft: 18 }}>
                  <ChartStickiness data={data.wauMau} height={200} />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 02 — Croissance */}
        <div className="section">
          <SectionHead n="02" title="Croissance" meta="L'usage progresse-t-il dans le temps ?" />
          <div className="cards">
            <Card
              span={12}
              title="Évolution du parc — totaux cumulés"
              sub="Foyers, appareils et recettes accumulés depuis le lancement"
              badge="North star"
              footer={
                <LegendInline
                  items={[
                    { label: "Appareils (total)", color: P.olive },
                    { label: "Foyers (total)", color: P.sage },
                    { label: "Recettes (total)", color: P.terracotta, dash: true },
                  ]}
                />
              }
            >
              <ChartParc data={data.parc} height={280} />
            </Card>
            <Card
              span={8}
              title="Nouveaux appareils & foyers"
              sub="Acquisition quotidienne (flux, non cumulé)"
              footer={
                <LegendInline
                  items={[
                    { label: "Nouveaux appareils", color: P.olive },
                    { label: "Nouveaux foyers", color: P.ochre, dash: true },
                  ]}
                />
              }
            >
              <ChartAcquisition data={data.acquisition} height={250} />
            </Card>
            <Card span={4} title="Taille des foyers" sub="Nb d'appareils par foyer">
              <ChartHouseholdSize data={data.householdSize} height={250} />
            </Card>
          </div>
        </div>

        {/* 03 — Contenu */}
        <div className="section">
          <SectionHead n="03" title="Contenu — recettes" meta="Comment les foyers remplissent l'app" />
          <div className="cards">
            <Card span={7} title="Volume de création de recettes" sub="Tendance quotidienne">
              <ChartRecipeCreation data={data.recipeCreation} height={250} />
            </Card>
            <Card span={5} title="Recettes par foyer" sub="Distribution">
              <ChartRecipesPerHousehold data={data.recipesPerHousehold} height={250} />
            </Card>
            <Card span={4} title="Méthodes d'ajout" sub="Répartition globale">
              <ChartAddMethods data={data.addMethods} height={210} />
            </Card>
            <Card span={4} title="Évolution du mix des méthodes" sub="L'import URL prend-il de l'ampleur ?">
              <ChartMethodMix data={data.addMethodsOverTime} height={210} />
            </Card>
            <Card span={4} title="Top foyers" sub="Classement par nb de recettes">
              <ChartTopHouseholds data={data.topHouseholds} height={250} />
            </Card>
          </div>
        </div>

        {/* 04 — Engagement & activation */}
        <div className="section">
          <SectionHead n="04" title="Engagement & activation" meta="Vue cohorte légère" />
          <div className="cards">
            <Card span={3} title="Activation 7 jours" sub="% nouveaux foyers ≥ 1 recette">
              <GaugeRadial value={data.activationPct} color={P.olive} height={190} label="à 7 j" big />
            </Card>
            <Card
              span={9}
              title="Rétention par cohorte"
              sub="% de foyers encore actifs N semaines après création"
              footer={
                <LegendInline
                  items={data.retentionCohorts.map((c, i) => ({
                    label: `Cohorte ${c.charAt(0).toUpperCase() + c.slice(1)}`,
                    color: [P.olive, P.ochre, P.clay][i % 3],
                    dash: i === 2,
                  }))}
                />
              }
            >
              <ChartRetention data={data.retention} cohorts={data.retentionCohorts} height={250} />
            </Card>
          </div>
        </div>

        {/* 05 — Qualité & coût IA */}
        <div className="section">
          <SectionHead n="05" title="Qualité & coût IA" meta="Pipeline d'enrichissement & dépense OpenAI — spécifique Mijote" />
          <div className="cards">
            <Card span={8} title="Coût IA / jour par usage" sub="Dépense OpenAI quotidienne, empilée par type d'appel (USD)" badge="USD">
              <ChartAiCostTrend data={data.aiCost.daily} height={230} />
            </Card>
            <Card span={4} title="Répartition par usage" sub="Part de la dépense — 30 j">
              <ChartCostByType data={data.aiCost.byType} height={200} />
            </Card>
            <Card
              span={4}
              title="Économie unitaire"
              sub="Coût moyen sur 30 j"
              footer={
                <div className="cost-recon">
                  {data.aiCost.billed30d != null
                    ? `Facturé OpenAI (org.) : ${money(data.aiCost.billed30d)} · instrumenté : ${money(data.aiCost.total30d)}`
                    : `Total instrumenté : ${money(data.aiCost.total30d)}`}
                </div>
              }
            >
              <div className="cost-stats">
                <div className="cost-stat">
                  <span className="cs-val">{money(data.aiCost.costPerRecipe)}</span>
                  <span className="cs-lab">/ recette enrichie</span>
                </div>
                <div className="cost-stat">
                  <span className="cs-val">{money(data.aiCost.costPerImage)}</span>
                  <span className="cs-lab">/ image générée</span>
                </div>
                <div className="cost-stat">
                  <span className="cs-val">{data.aiCost.imagesCount.toLocaleString("fr-FR")}</span>
                  <span className="cs-lab">images · {data.aiCost.callsTotal.toLocaleString("fr-FR")} appels (30 j)</span>
                </div>
              </div>
            </Card>
            <Card span={4} title="Pipeline d'enrichissement" sub="Taux de succès / échec des appels">
              <ChartAiPipeline data={data.aiPipeline} success={data.aiPipeline[0]?.value ?? 0} height={200} />
            </Card>
            <Card span={4} title="Couverture" sub="Recettes enrichies vs brutes">
              <GaugeRadial value={data.coveragePct} color={P.sage} height={190} label="enrichies" />
            </Card>
            <Card span={4} title="Répartition par plateforme" sub="Angle de lecture transverse">
              <ChartPlatforms data={data.platforms} height={200} />
            </Card>
            <Card
              span={12}
              title="Échecs d'enrichissement"
              sub="Recettes dont le pipeline IA a échoué (20 dernières) — relancer via batch-enrich"
              badge={data.enrichmentFailures.length > 0 ? String(data.enrichmentFailures.length) : undefined}
            >
              {data.enrichmentFailures.length === 0 ? (
                <div className="fail-empty">Aucun échec d&apos;enrichissement — pipeline au vert.</div>
              ) : (
                <div className="fail-table">
                  <div className="fail-row fail-head">
                    <span>Recette</span>
                    <span>Foyer</span>
                    <span>Échec</span>
                    <span>Dernière activité</span>
                  </div>
                  {data.enrichmentFailures.map((f) => (
                    <div className="fail-row" key={f.id}>
                      <span className="fail-title">{f.title}</span>
                      <span>{f.household}</span>
                      <span className="fail-part">{f.failedPart}</span>
                      <span>{f.updatedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
