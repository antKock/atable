import { notFound } from "next/navigation";
import { isAdminForHouseholds } from "@/lib/admin/auth";
import { getOwnerContext, householdIds as ownerHouseholdIds } from "@/lib/auth/owner-context";
import { getDashboardData, getHouseholdsForPicker, type KpiCard, type Signal } from "@/lib/admin/queries";
import { resolvePeriod, isPeriodKey } from "@/lib/admin/periods";
import { PALETTE as P } from "@/lib/admin/palette";
import FilterBar from "@/components/admin/FilterBar";
import {
  Sparkline,
  HBarList,
  ChartTrialsDaily,
  ChartDemoActivity,
  ChartWauMau,
  ChartStickiness,
  ChartBins,
  ChartParc,
  ChartPeoplePerCarnet,
  ChartRecipeCreation,
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

// Tuile « grands chiffres » empilés (profondeur, frictions, adoption invité…).
function BigStats({ stats }: { stats: { value: string; label: string; hint?: string; warn?: boolean }[] }) {
  return (
    <div className="big-stats">
      {stats.map((s, i) => (
        <div key={s.label} style={{ display: "contents" }}>
          {i > 0 && <div className="hr" />}
          <div className="big-stat">
            <div className="bs-val" style={s.warn ? { color: "var(--d-neg)" } : undefined}>{s.value}</div>
            <div className="bs-lab">{s.label}</div>
            {s.hint && <div className="bs-hint">{s.hint}</div>}
          </div>
        </div>
      ))}
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
  const owner = await getOwnerContext();
  if (!owner || !isAdminForHouseholds(ownerHouseholdIds(owner))) notFound();

  const sp = await searchParams;
  const rawPlatform = typeof sp.platform === "string" ? sp.platform : undefined;
  const platform = rawPlatform === "ios" || rawPlatform === "android" || rawPlatform === "web" ? rawPlatform : null;
  const period = isPeriodKey(sp.period) ? sp.period : undefined;
  const householdIds = typeof sp.hh === "string" ? sp.hh.split(",").filter(Boolean) : null;

  const [data, households] = await Promise.all([
    getDashboardData({ platform, period, householdIds }),
    getHouseholdsForPicker(),
  ]);
  const periodSpan = resolvePeriod(period).span;

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
        </div>
      </div>

      <FilterBar households={households} />

      <div className="page">
        {/* KPI row — ordre du parcours : acquisition → conversion → activation
            → engagement → contenu → qualité */}
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

        {/* 01 — Funnel démo → carnet */}
        <div className="section">
          <SectionHead n="01" title="Funnel démo → carnet" meta="L'étape clé : de l'essai anonyme au premier carnet" />
          <div className="cards">
            <Card
              span={5}
              title="Funnel des 30 derniers jours"
              sub="Chaque essai = une session démo créée (« Essayer l'app »)"
              footer={
                <div className="chart-note">
                  Historique disponible depuis la pose du marqueur de conversion (migration 032) —{" "}
                  <b>aucun rattrapage du passé possible</b>.
                </div>
              }
            >
              <HBarList
                height={200}
                rows={data.funnel.map((s) => ({
                  label: s.label,
                  value: s.value,
                  hint: `${Math.round(s.pct)} %`,
                }))}
              />
            </Card>
            <Card
              span={7}
              title="Essais & conversions par jour"
              sub={`Volume d'essais démo (barres) et conversions en 1er carnet (ligne) · ${periodSpan}`}
              badge="global"
              footer={
                <LegendInline
                  items={[
                    { label: "Essais démo / jour", color: P.oliveSoft },
                    { label: "Conversions / jour", color: P.terracotta },
                  ]}
                />
              }
            >
              <ChartTrialsDaily data={data.demoDaily} height={240} />
            </Card>
            <Card span={4} title="Délai avant conversion" sub="Temps entre la 1ʳᵉ session démo et la création du carnet (toutes conversions)">
              <ChartBins data={data.ttc} name="Conversions" height={210} emptySub="Se remplit avec les premières conversions marquées (032)." />
            </Card>
            <Card
              span={4}
              title="Activité en démo"
              sub="Recettes ajoutées par les visiteurs démo · 30 j — consolidé chaque nuit avant la purge"
            >
              <ChartDemoActivity data={data.demoActivityDaily} height={210} />
            </Card>
            <Card
              span={8}
              title="Essais par source"
              sub="Attribution UTM captée sur la landing (034) · 30 j — « (organique) » = sans UTM"
            >
              <HBarList
                height={200}
                rows={data.acquisitionSources.map((s) => ({
                  label: [s.source, s.campaign, s.content].filter(Boolean).join(" · "),
                  value: s.trials,
                  hint: `${s.carnets} carnet${s.carnets > 1 ? "s" : ""}`,
                }))}
              />
            </Card>
            <Card span={4} title="Frictions en démo" sub="Ce que les visiteurs font — et n'obtiennent pas · 30 j">
              <BigStats
                stats={[
                  {
                    value: String(data.demoFrictions.aiCalls),
                    label: "appels IA en démo",
                    hint: `${data.demoFrictions.recipesAdded} recettes ajoutées puis purgées`,
                  },
                  {
                    value: String(data.demoFrictions.frozenHits),
                    label: "blocages « monde gelé » (403)",
                    hint: "actions carnet/profil tentées depuis la démo",
                    warn: data.demoFrictions.frozenHits > 0,
                  },
                ]}
              />
            </Card>
          </div>
        </div>

        {/* 02 — Personnes actives */}
        <div className="section">
          <SectionHead n="02" title="Personnes actives" meta="Grain owner — l'ancienne série « appareils » reste en filigrane" />
          <div className="cards">
            <Card
              span={8}
              title="Personnes actives — WAU / MAU"
              sub={`Fenêtre glissante 7 j / 30 j, échantillonnée par jour · ${periodSpan}`}
              badge="grain owner"
              footer={
                <>
                  <LegendInline
                    items={[
                      { label: "MAU personnes", color: P.olive },
                      { label: "WAU personnes", color: P.terracotta },
                      { label: "MAU appareils (ancienne métrique)", color: P.faint, dash: true },
                    ]}
                  />
                  {data.activityMarker && (
                    <div className="chart-note">
                      Repère <b>➀ {data.activityMarker}</b> : correctif du heartbeat + modèle owners — avant ➀, les jours
                      actifs sont sous-capturés et la série « personnes » est un <b>majorant</b> (identités fantômes non
                      fusionnables).
                    </div>
                  )}
                </>
              }
            >
              <ChartWauMau data={data.wauMau} marker={data.activityMarker} height={260} />
            </Card>
            <Card span={4} title="Stickiness" sub="Ratio WAU / MAU — fidélité d'usage">
              <ChartStickiness data={data.wauMau} height={260} />
            </Card>
            <Card span={4} title="Fréquence d'usage" sub="Jours actifs / mois / personne (avant : par appareil)">
              <ChartBins data={data.loginFrequency} name="Personnes" height={220} />
            </Card>
            <Card span={4} title="Appareils par personne" sub="Mesure directe du bruit « fantômes » et du multi-appareil réel">
              <ChartBins data={data.devicesPerOwner} name="Personnes" color={P.ochre} height={220} />
            </Card>
            <Card span={4} title="Profondeur d'usage" sub="Recettes ajoutées par jour-personne actif">
              <BigStats
                stats={[
                  { value: String(data.depth.toFixed(1)).replace(".", ","), label: "recettes / jour actif" },
                  { value: String(data.dormantCarnets), label: "carnets dormants (+30 j)", warn: data.dormantCarnets > 0 },
                ]}
              />
            </Card>
            <Card
              span={12}
              title="Évolution du parc — totaux cumulés"
              sub="Personnes et carnets accumulés depuis le lancement · les recettes cumulées (échelle incomparable) sont en section 04"
              badge="North star · global"
              footer={
                <LegendInline
                  items={[
                    { label: "Personnes (total)", color: P.olive },
                    { label: "Carnets (total)", color: P.sage },
                  ]}
                />
              }
            >
              <ChartParc data={data.parc} height={280} />
            </Card>
            <Card
              span={8}
              title="Rétention par cohorte"
              sub="% de personnes encore actives N semaines après leur arrivée (avant : cohortes de foyers)"
              badge="grain owner"
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
            <Card span={4} title="Activation 7 jours" sub="% de nouvelles personnes avec ≥ 1 recette dans les 7 j (8 dernières cohortes)">
              <GaugeRadial value={data.activationPct} color={P.olive} height={220} label="à 7 j" big />
            </Card>
          </div>
        </div>

        {/* 03 — Carnets & cercles */}
        <div className="section">
          <SectionHead n="03" title="Carnets & cercles" meta="Le carnet mesuré pour lui-même : rôles, partage, multi-carnet" />
          <div className="cards">
            <Card
              span={4}
              title="Carnets par personne"
              sub="Adoption du multi-carnet (Lot 4)"
              footer={
                <div className="chart-note">
                  <b>{data.multiCarnetPct} %</b> des personnes ont plus d&apos;un carnet.
                </div>
              }
            >
              <ChartBins data={data.carnetsPerOwner} name="Personnes" height={210} />
            </Card>
            <Card
              span={4}
              title="Personnes par carnet"
              sub="Membres et invités par carnet (avant : nb d'appareils par foyer)"
              footer={
                <LegendInline
                  items={[
                    { label: "Membres", color: P.olive },
                    { label: "Invités", color: P.ochre },
                  ]}
                />
              }
            >
              <ChartPeoplePerCarnet data={data.peoplePerCarnet} height={210} />
            </Card>
            <Card span={4} title="Adoption du rôle invité" sub="Feature du Lot 3 — lecture seule">
              <BigStats
                stats={[
                  {
                    value: `${data.guestAdoption.withGuestPct} %`,
                    label: "des carnets ont ≥ 1 invité",
                    hint: `${data.guestAdoption.guestsTotal} invité${data.guestAdoption.guestsTotal > 1 ? "s" : ""} au total`,
                  },
                  {
                    value: String(data.sharing.moves),
                    label: "recettes déplacées entre carnets · 30 j",
                  },
                ]}
              />
            </Card>
            <Card
              span={12}
              title="Top 20 carnets"
              sub="Par nombre de recettes · dernière activité via les membres (memberships)"
            >
              <ChartTopHouseholds data={data.topHouseholds} height={Math.max(250, data.topHouseholds.length * 28)} />
            </Card>
          </div>
        </div>

        {/* 04 — Contenu & partage */}
        <div className="section">
          <SectionHead n="04" title="Contenu & partage" meta="Comment les carnets se remplissent — et circulent" />
          <div className="cards">
            <Card span={7} title="Volume de création de recettes" sub={`Tendance quotidienne · ${periodSpan}`}>
              <ChartRecipeCreation data={data.recipeCreation} height={250} />
            </Card>
            <Card span={5} title="Méthodes d'ajout" sub="Répartition globale — inclut les copies de partage (« Partagée »)">
              <ChartAddMethods data={data.addMethods} height={230} />
            </Card>
            <Card
              span={4}
              title="Partage de recettes"
              sub="Liens émis (cumul) vs recettes copiées par les destinataires (30 j)"
              footer={
                data.sharing.links > 0 ? (
                  <div className="chart-note">
                    Taux de reprise : <b>{data.sharing.uptakePct} %</b> des liens partagés ont abouti à ≥ 1 copie (30 j).
                  </div>
                ) : undefined
              }
            >
              <HBarList
                height={130}
                colors={[P.olive, P.ochre]}
                rows={[
                  { label: "Liens de partage émis", value: data.sharing.links },
                  { label: "Copiées par un destinataire", value: data.sharing.copies },
                ]}
              />
            </Card>
            <Card span={4} title="Recettes par carnet" sub="Distribution">
              <ChartBins data={data.recipesPerHousehold} name="Carnets" height={220} />
            </Card>
            <Card span={4} title="Évolution du mix des méthodes" sub="L'import URL prend-il de l'ampleur ?">
              <ChartMethodMix data={data.addMethodsOverTime} height={220} />
            </Card>
          </div>
        </div>

        {/* 05 — Compte & sécurité */}
        <div className="section">
          <SectionHead n="05" title="Compte & sécurité" meta="Récupération d'accès (#14), profils, fusions" />
          <div className="cards">
            <Card
              span={4}
              title="Filet de sécurité"
              sub="% de personnes avec un email de récupération"
              footer={
                <div className="chart-note">
                  Les personnes sans email <b>perdent tout</b> si elles perdent leur session ({data.recovery.withEmail}
                  {" "}/ {data.recovery.ownersTotal} en ont un).
                </div>
              }
            >
              <GaugeRadial
                value={data.recovery.withEmailPct}
                color={data.recovery.withEmailPct < 50 ? P.terracotta : P.olive}
                height={200}
                label="ont un email"
              />
            </Card>
            <Card span={4} title="Funnel de récupération" sub="login_tokens émis → consommés · 90 j (consolidé chaque nuit)">
              <HBarList
                height={200}
                colors={[P.olive, P.oliveDeep, "#C9C2B2", P.terracotta]}
                rows={data.recovery.funnel}
              />
            </Card>
            <Card span={4} title="Profils & identités" sub="Santé du hub « Toi + tes carnets » (Lot 1)">
              <BigStats
                stats={[
                  {
                    value: `${data.recovery.namedPct} %`,
                    label: "de profils nommés",
                    hint: "les autres gardent leur surnom auto",
                  },
                  {
                    value: String(data.recovery.merges),
                    label: "fusions d'identités réussies",
                    hint: "via email déjà pris (Lot 2) · 90 j",
                  },
                ]}
              />
            </Card>
          </div>
        </div>

        {/* 06 — Qualité & coût IA */}
        <div className="section">
          <SectionHead n="06" title="Qualité & coût IA" meta="Pipeline d'enrichissement & dépense OpenAI — part démo isolée" />
          <div className="cards">
            <Card span={8} title="Coût IA / jour par usage" sub="Dépense OpenAI quotidienne, empilée par type d'appel — la démo en gris" badge="USD">
              <ChartAiCostTrend data={data.aiCost.daily} height={230} />
            </Card>
            <Card span={4} title="Répartition par usage" sub="Part de la dépense réelle (hors démo) — 30 j">
              <ChartCostByType data={data.aiCost.byType} height={200} />
            </Card>
            <Card
              span={4}
              title="Économie unitaire"
              sub="Coût moyen sur 30 j"
              footer={
                <div className="cost-recon">
                  {data.aiCost.billed30d != null
                    ? `Facturé OpenAI (org.) : ${money(data.aiCost.billed30d)} · instrumenté : ${money(data.aiCost.total30d + data.aiCost.demo30d)} (dont démo ${money(data.aiCost.demo30d)})`
                    : `Total instrumenté : ${money(data.aiCost.total30d + data.aiCost.demo30d)} (dont démo ${money(data.aiCost.demo30d)})`}
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
            <Card span={4} title="Couverture" sub="Recettes enrichies vs brutes (les copies partagées comptent)">
              <GaugeRadial value={data.coveragePct} color={P.sage} height={190} label="enrichies" />
            </Card>
            <Card span={12} title="Répartition par plateforme" sub="Angle de lecture transverse — plateforme de l'appareil créateur des recettes">
              <ChartPlatforms data={data.platforms} height={200} />
            </Card>
            <Card
              span={12}
              title="Échecs d'enrichissement"
              sub="Recettes dont le pipeline IA a échoué (20 dernières, hors démo/test) — relancer via batch-enrich"
              badge={data.enrichmentFailures.length > 0 ? String(data.enrichmentFailures.length) : undefined}
            >
              {data.enrichmentFailures.length === 0 ? (
                <div className="fail-empty">Aucun échec d&apos;enrichissement — pipeline au vert.</div>
              ) : (
                <div className="fail-table">
                  <div className="fail-row fail-head">
                    <span>Recette</span>
                    <span>Carnet</span>
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
