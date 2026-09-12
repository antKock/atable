import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { monthName } from "@/lib/admin/v3/assemble";
import { nLabel, pctLabel } from "@/lib/admin/v3/ratio";
import { shortDate } from "@/lib/admin/v3/weeks";
import { METRIC_EPOCHS, PRODUCT_EVENTS } from "@/lib/admin/epochs";
import { CHANNEL_LABELS } from "@/lib/admin/v3/people";
import { PALETTE as P, cohortColor } from "@/lib/admin/palette";
import { Topbar, SectionHead, Card, Funnel, BarRow, BigStats, RatioText, Legend } from "@/components/admin/ui";
import { Spark, NorthStarChart, StackedWeekly, ActivationWeekly, RetentionCurves, CohortCake, Dist } from "@/components/admin/charts-v3";
import "./dashboard.css";

export const dynamic = "force-dynamic";

const fr = (n: number) => n.toLocaleString("fr-FR");
const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

const METHOD_COLORS: Record<string, string> = { url: P.ochre, photo: P.terracotta, voice: P.sage, manual: P.olive, shared: P.clay, unknown: "#C9C2B2" };

export default async function DashboardPage() {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();

  const { data } = await getDashboardV3();
  const { overview: o, acquisition: acq, activation: act, retention: ret, engage, ops } = data;
  const dataDate = shortDate(o.dataDate);

  return (
    <div className="mijote-dash">
      <Topbar current="stats" dataDate={dataDate} />
      <div className="page">
        {/* ============ 1 · EN UN COUP D'ŒIL ============ */}
        <div className="section" style={{ marginTop: 8 }}>
          <SectionHead n="1" title="En un coup d'œil" q={`Dernière semaine close (${o.weekLabel}) vs les 4 précédentes · le même contenu part chaque lundi par e-mail`} />
          <div className="glance">
            <div className="north">
              <div className="lab">North Star · Cuisiniers actifs · 28 jours</div>
              <div className="val">{fr(o.northStar.value)}</div>
              <div className={"delta" + (o.northStar.delta < 0 ? " neg" : "")}>
                {o.northStar.delta >= 0 ? "+" : ""}
                {o.northStar.delta} vs 4 semaines plus tôt ({o.northStar.fourWeeksAgo})
              </div>
              <div className="sub">
                dont <b>{o.northStar.engaged}</b> ont ajouté ou consulté une recette · {o.northStar.total} personnes au total{" "}
                <span className="tag" title="v1 = a ouvert l'app ; la consultation est comptée depuis le 13 sept. 2026 (lot B)">v1 = a ouvert l&apos;app</span>
              </div>
              <div className="chart">
                <NorthStarChart labels={o.northStar.seriesLabels} values={o.northStar.series} />
              </div>
              <div className="note">12 semaines closes · un point = personnes actives sur les 28 jours qui précèdent le dimanche</div>
            </div>
            <div>
              <div className="inputs">
                {o.tiles.map((t) => (
                  <div className="kpi" key={t.id}>
                    <div className="lab">{t.label}</div>
                    <div className={"val" + (t.fragile ? " fragile" : "")} title={t.title}>
                      {t.value}
                      {t.unit && <small>{t.unit}</small>}
                    </div>
                    <div className={"cmp" + (t.trend ? " " + t.trend : "")}>{t.compare}</div>
                    {t.bench && <div className="bench">{t.bench}</div>}
                    {t.spark && (
                      <div className="spark">
                        <Spark values={t.spark} />
                      </div>
                    )}
                  </div>
                ))}
                <div className="kpi" style={{ justifyContent: "space-between" }}>
                  <div className="lab">Santé</div>
                  <div className="health">
                    <span className="dot" title={o.health.pipeline.detail}>
                      <i className={o.health.pipeline.ok ? "" : "red"} />
                      Pipeline IA
                    </span>
                    <span className="dot" title={o.health.crons.detail}>
                      <i className={o.health.crons.ok ? "" : "red"} />
                      Crons
                    </span>
                    <span className="dot" title={o.health.demo.detail}>
                      <i className={o.health.demo.ok ? "" : "red"} />
                      Démo
                    </span>
                  </div>
                  <div className="note">
                    {o.health.ok ? "vert = rien à faire" : "un voyant rouge : "}
                    {!o.health.ok && <a href="/admin/sante">ouvrir Santé</a>}
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">Ce qui a bougé</div>
                    <div className="card-sub">Les plus fortes variations, en clair</div>
                  </div>
                </div>
                {o.moved.length ? (
                  <ul className="moved">
                    {o.moved.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="note">Rien de notable cette semaine.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============ 2 · ACQUÉRIR ============ */}
        <div className="section">
          <SectionHead n="2" title="Acquérir" q="D'où viennent les gens — un tunnel par canal, jamais additionnés" />
          <div className="cards">
            <Card
              span={4}
              title="App Store (iOS) · 4 sem."
              sub="Compteurs Apple arrondis · données à J-1"
              def={
                <>
                  Impressions et vues de fiche : rapport Discovery & Engagement (App Store Connect). Téléchargements : premiers téléchargements (hors mises à jour et retéléchargements).
                  1ʳᵉ ouverture iOS = sessions démo créées depuis l&apos;app (28 j). 1er carnet iOS = nouvelles personnes dont la première session est iOS (28 j). Apple seuille les petits volumes.
                  {acq.appStore.lastDay && <> Données Apple jusqu&apos;au {shortDate(acq.appStore.lastDay)}.</>}
                </>
              }
            >
              <Funnel
                rows={[
                  { label: "Impressions", value: acq.appStore.impressions, hint: "100 %", color: P.ochre },
                  { label: "Vues de fiche", value: acq.appStore.pageViews, hint: acq.appStore.impressions ? `${Math.round((acq.appStore.pageViews / acq.appStore.impressions) * 100)} %` : undefined },
                  { label: "Premiers téléchargements", value: acq.appStore.downloads, hint: acq.appStore.impressionToInstall != null ? `${String(acq.appStore.impressionToInstall).replace(".", ",")} %` : undefined },
                  { label: "1ʳᵉ ouverture iOS", value: acq.appStore.firstOpenIos },
                  { label: "1er carnet iOS", value: acq.appStore.firstCarnetIos },
                ]}
              />
              <div className="bench">fiche → téléchargement : repère marché Food &amp; Drink ≈ 53 % (AppTweak 2025) · impression → téléchargement ≈ 3,6 %</div>
            </Card>
            <Card span={3} title="Web · 28 j" sub="Essai démo depuis un navigateur" def={<>Essais = sessions démo créées depuis un navigateur (sondes exclues). Carnet = personnes sorties de la démo vers un premier carnet, première session web. Visites de la landing non mesurées (pas de tracking anonyme).</>}>
              <Funnel rows={[{ label: "Essais démo web", value: acq.web.trials }, { label: "1er carnet web", value: acq.web.conversions, color: P.terracotta }]} />
              <div className="note">Visites de la landing non mesurées (choix : pas de tracking anonyme).</div>
            </Card>
            <Card
              span={5}
              title="Nouvelles personnes par semaine et par canal"
              sub="12 semaines closes · repère 1.3 = fiche App Store refondue"
              def={<>Canal = plateforme de la première session (App Store = iOS, Web, Android) ; « Invitation » = a rejoint un carnet qui existait déjà (code invité ou membre). Une personne = une identité réelle (hors démo et tests).</>}
              footer={<Legend items={[{ label: "App Store", color: P.olive }, { label: "Web", color: P.ochre }, { label: "Android", color: P.clay }, { label: "Invitation", color: P.sage }]} />}
            >
              <StackedWeekly
                data={acq.weekly}
                series={[
                  { key: "ios", name: "App Store", color: P.olive },
                  { key: "web", name: "Web", color: P.ochre },
                  { key: "android", name: "Android", color: P.clay },
                  { key: "invite", name: "Invitation", color: P.sage },
                ]}
                markerLabel={acq.listingMarker >= 0 ? acq.weekly[acq.listingMarker]?.label : null}
                markerGlyph="1.3"
              />
            </Card>
            <Card span={4} title="Origine des téléchargements · 4 sem." sub="Source App Store, referrers nommés" def={<>Source du premier téléchargement telle que rapportée par Apple : recherche, navigation, ouverture de la fiche depuis une autre app (referrer, ex. ChatGPT) ou depuis le web. Sans lien possible avec une personne côté Mijote.</>}>
              {acq.appStore.sources.length ? (
                <div className="method">
                  {acq.appStore.sources.map((s, i) => (
                    <BarRow key={s.label} label={s.label} value={s.downloads} max={acq.appStore.sources[0].downloads} text={String(s.downloads)} color={i === 0 ? P.olive : P.sage} />
                  ))}
                </div>
              ) : (
                <div className="note">Aucun téléchargement rapporté sur la fenêtre.</div>
              )}
            </Card>
            <Card span={4} title="Invitations & partage · 28 j" sub="Personnes arrivées par un code invité ou un lien" def={<>Arrivées par invitation = personnes dont la première membership est un carnet créé avant elles (membre ou invité en lecture). Les copies de recettes partagées sont en bloc 5.</>}>
              <BigStats stats={[{ value: acq.invites, label: "personnes arrivées par invitation", hint: `${engage.carnetsWithGuests} carnet${engage.carnetsWithGuests > 1 ? "s" : ""} avec ≥ 1 invité en lecture` }, { value: engage.sharing.copies, label: "recettes copiées depuis un lien · 12 sem.", hint: `${engage.sharing.links} liens émis${engage.sharing.estimate ? " (dates approchées avant le 13 sept.)" : ""}` }]} />
            </Card>
            <Card span={4} title="Essai démo → premier carnet · 28 j" sub="Par plateforme d'essai" def={<>Conversions marquées en base à la sortie de démo (depuis le 14 août 2026), rapportées aux essais démo de la même plateforme sur 28 jours. Pourcentage grisé sous 20 essais.</>}>
              <div className="method">
                {(["ios", "web", "android"] as const).map((k) => (
                  <BarRow key={k} label={k === "ios" ? "iOS" : k === "web" ? "Web" : "Android"} value={acq.demo[k].n} max={Math.max(1, acq.demo.ios.total, acq.demo.web.total, acq.demo.android.total)} text={`${acq.demo[k].n} / ${acq.demo[k].total}`} color={k === "ios" ? P.olive : k === "web" ? P.ochre : P.clay} />
                ))}
              </div>
              <div className="note">
                iOS : <RatioText r={acq.demo.ios} /> · Web : <RatioText r={acq.demo.web} />
              </div>
            </Card>
          </div>
        </div>

        {/* ============ 3 · ACTIVER ============ */}
        <div className="section">
          <SectionHead n="3" title="Activer" q="Du premier carnet au premier vrai usage — « activée » = ≥ 3 recettes et ≥ 1 retour après J+1, dans les 7 jours" />
          <div className="cards">
            <Card span={5} title="Parcours des 7 premiers jours" sub={`Personnes arrivées depuis juin (${act.funnel.arrivals}), jugeables à J+7`} def={<>Cohorte = personnes réelles arrivées depuis le 1er juin 2026 dont le 7ᵉ jour est passé. 1ʳᵉ recette = première recette ajoutée par la personne dans les 7 j ; retour = au moins un jour actif entre J+1 et J+7 ; activée = les deux conditions (≥ 3 recettes et retour).</>}>
              <Funnel
                rows={[
                  { label: "1er carnet", value: act.funnel.arrivals },
                  { label: "1ʳᵉ recette (7 j)", value: act.funnel.firstRecipe7d },
                  { label: "≥ 3 recettes (7 j)", value: act.funnel.threeRecipes7d },
                  { label: "≥ 1 retour après J+1", value: act.funnel.returned7d },
                  { label: "Activées", value: act.funnel.activated.n, hint: pctLabel(act.funnel.activated), color: P.oliveDeep },
                ]}
              />
            </Card>
            <Card span={4} title="Activation selon la première recette" sub="Méthode du tout premier ajout · activées / personnes" def={<>Méthode (URL, photo, voix, manuel, copie partagée) de la première recette ajoutée par la personne, sur la même cohorte que le parcours. La méthode du premier import prédit l&apos;activation : levier d&apos;onboarding.</>}>
              <div className="method">
                {act.byMethod.map((m) => (
                  <BarRow key={m.method} label={m.label} value={m.r.n} max={Math.max(1, ...act.byMethod.map((x) => x.r.total))} text={nLabel(m.r)} color={METHOD_COLORS[m.method] ?? P.olive} />
                ))}
              </div>
              <div className="note">Barre = activées, sur une échelle commune ; le texte donne activées / personnes.</div>
            </Card>
            <Card span={3} title="Activées par semaine d'arrivée" sub="8 dernières semaines jugeables" footer={<Legend items={[{ label: "Arrivées", color: P.grid }, { label: "Activées", color: P.oliveDeep }]} />}>
              <ActivationWeekly data={act.weekly} />
            </Card>
          </div>
        </div>

        {/* ============ 4 · RETENIR ============ */}
        <div className="section">
          <SectionHead n="4" title="Retenir" q="Reviennent-ils le mois suivant, et le suivant ? — la question du moment" />
          <div className="cards">
            <Card span={6} title="Rétention par cohorte d'arrivée" sub="Actives au moins un jour en M1 (J+28 → J+55), M2 (J+56 → J+83), M3 · depuis mai 2026" tag={<span className="tag">tout</span>} def={<>Cohorte = mois calendaire du premier carnet. Mois = 28 jours. Une cellule = % de la cohorte active au moins un jour dans la fenêtre, n/N dessous ; « partiel » = seules les personnes dont la fenêtre est entièrement passée sont comptées. Avant le 10 juillet 2026 les jours actifs sont sous-capturés : mai et juin sont un peu pessimistes.</>}>
              <table className="cohort">
                <thead>
                  <tr>
                    <th>Cohorte</th>
                    <th>N</th>
                    <th>M0</th>
                    <th>M1</th>
                    <th>M2</th>
                    <th>M3</th>
                  </tr>
                </thead>
                <tbody>
                  {ret.cohorts.map((c) => (
                    <tr key={c.month}>
                      <td>{monthName(c.month)}</td>
                      <td>{c.n}</td>
                      <td className="c" style={{ background: "rgba(110,122,56,.55)" }}>
                        100 %<span className="n">{c.n} / {c.n}</span>
                      </td>
                      {([c.m1, c.m2, c.m3] as const).map((cell, i) => {
                        if (cell.state === "none" || (cell.state === "pending" && i > 0 && [c.m1, c.m2][i - 1].state === "pending")) return <td className="na" key={i}>—</td>;
                        if (cell.state === "pending") return <td className="na" key={i}>{cell.pendingFrom ? `dès le ${shortDate(cell.pendingFrom)}` : "pas encore"}</td>;
                        const op = cell.r.pct == null ? 0.08 : 0.1 + (cell.r.pct / 100) * 0.45;
                        return (
                          <td className={"c" + (cell.r.fragile ? " fragile" : "")} style={{ background: `rgba(110,122,56,${op.toFixed(2)})` }} key={i} title={cell.r.margin != null ? `marge ± ${cell.r.margin} pts` : undefined}>
                            {pctLabel(cell.r)}
                            <span className="n">
                              {cell.r.n} / {cell.r.total}
                              {cell.state === "partial" ? " · partiel" : ""}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="note">% en gris = moins de 20 personnes (fragile). Encore actives ces 28 j : {ret.cohorts.map((c) => `${monthName(c.month)} ${c.activeNow}`).join(" · ")}.</div>
            </Card>
            <Card span={6} title="Courbes de rétention" sub="Chaque cohorte comparée à la précédente — on cherche l'aplatissement" footer={<Legend items={[...ret.curves.map((c) => ({ label: monthName(c.month), color: cohortColor(c.month) })), { label: "repère D30 marché ≈ 6 %", color: "#C9C2B2" }]} />}>
              <RetentionCurves curves={ret.curves.map((c) => ({ ...c, label: monthName(c.month) }))} refPct={6} />
            </Card>
            <Card span={8} title="Cuisiniers actifs 28 j par génération" sub="Une strate par mois d'arrivée — elle persiste ou s'évapore · 12 semaines" footer={<Legend items={ret.cakeKeys.map((k, i) => ({ label: ret.cakeLabels[i], color: cohortColor(k) }))} />}>
              <CohortCake data={ret.cake} keys={ret.cakeKeys} labels={ret.cakeLabels} />
            </Card>
            <Card span={4} title="À rattraper" sub="Actives il y a 4-8 semaines, silencieuses depuis 4 semaines" def={<>Personnes actives entre J-55 et J-28 et sans aucun jour actif depuis 28 jours. La liste nominative est dans Explorer.</>}>
              <BigStats
                stats={[
                  { value: ret.leaving, label: "personnes en train de partir", hint: <>dont {ret.leavingWithEmailAndRecipes} avec ≥ 5 recettes et un e-mail de secours → <a href="/admin/explorer?filter=leaving">voir dans Explorer</a></> },
                  { value: ret.activeWithoutEmail, label: "personnes actives sans e-mail", hint: "perdent tout si elles perdent leur session" },
                ]}
              />
            </Card>
          </div>
        </div>

        {/* ============ 5 · ENGAGER ============ */}
        <div className="section">
          <SectionHead n="5" title="Engager" q="Ce que font celles et ceux qui restent" />
          <div className="cards">
            <Card span={4} title="Recettes ajoutées par cuisinier actif · 28 j" sub="Un noyau intense, une longue traîne" def={<>Parmi les personnes actives sur 28 jours : nombre de recettes qu&apos;elles ont ajoutées (attribuées à l&apos;appareil créateur) sur la même période.</>}>
              <Dist data={engage.distribution} />
            </Card>
            <Card span={4} title="Consultent vs ajoutent · 28 j" sub="Combien cuisinent réellement avec l'app" tag={<span className="tag b">depuis le 13 sept.</span>} def={<>Consultation = ouverture d&apos;une fiche recette par une personne réelle, comptée par jour depuis le 13 septembre 2026 (lot B). Les 4 premières semaines sont partielles.</>}>
              <BigStats stats={[{ value: engage.viewers28, label: "ont consulté ≥ 1 recette", hint: "compteur démarré le 13 sept. 2026" }, { value: engage.adders28, label: "ont ajouté ≥ 1 recette", hint: `${engage.engaged28} ont fait l'un ou l'autre, sur ${engage.active28} actives` }]} />
            </Card>
            <Card span={4} title="Méthodes d'ajout · 12 semaines" sub="Part de chaque méthode par semaine" footer={<Legend items={engage.methodKeys.map((k, i) => ({ label: engage.methodLabels[i], color: METHOD_COLORS[k] }))} />}>
              <StackedWeekly data={engage.methodMix} series={engage.methodKeys.map((k, i) => ({ key: k, name: engage.methodLabels[i], color: METHOD_COLORS[k] }))} percent emptySub="Se remplit avec les recettes ajoutées." />
            </Card>
            <Card span={6} title="Boucle de partage · 12 semaines" sub="Liens émis → recettes copiées → nouvelles personnes" def={<>Liens = recettes dont un lien de partage a été généré sur la fenêtre (datés depuis le 13 sept. 2026 ; avant, date de la recette). Copies = recettes créées par « Ajouter à mon carnet » depuis un lien. Nouvelles personnes = arrivées par invitation sur la fenêtre.</>}>
              <Funnel rows={[{ label: "Liens de partage émis", value: engage.sharing.links }, { label: "Recettes copiées par un destinataire", value: engage.sharing.copies }, { label: "Nouvelles personnes par invitation", value: engage.sharing.arrivals }]} />
              {engage.sharing.estimate && <div className="note">Liens d&apos;avant le 13 sept. datés de la création de la recette (approché).</div>}
            </Card>
            <Card span={6} title="Carnets partagés" sub="Comment les carnets se peuplent">
              <BigStats stats={[{ value: <>{engage.sharedCarnets} <small>/ {engage.carnets}</small></>, label: "carnets à plusieurs (membres ou invités)", hint: `${engage.carnetsWithGuests} avec ≥ 1 invité en lecture · ${engage.multiCarnet} personne${engage.multiCarnet > 1 ? "s ont" : " a"} plus d'un carnet` }]} />
            </Card>
          </div>
        </div>

        {/* ============ 6 · SANTÉ & ÉCONOMIE (replié) ============ */}
        <details className="ops" open={!o.health.ok}>
          <summary>
            <span className="n">6</span>Santé &amp; économie
            <span className={"meta" + (o.health.ok ? "" : " red")}>{o.health.ok ? "Tout est au vert" : "Un voyant est au rouge"} · détail dans <a href="/admin/sante">Santé</a> · cadence quotidienne</span>
          </summary>
          <div className="cards">
            <Card span={4} title="Coût IA · 28 j" sub="Hors démo · réconcilié avec la facture OpenAI">
              <BigStats stats={[{ value: usd(ops.cost.total), label: ops.cost.billed != null ? `instrumenté · facturé ${usd(ops.cost.billed)} (org. entière)` : "instrumenté (pas de clé admin OpenAI)", hint: `démo : ${usd(ops.cost.demo)} en plus · ${ops.pipeline.created} recettes · ${usd(ops.cost.perRecipe)} / recette` }]} />
            </Card>
            <Card span={4} title="Pipeline d'enrichissement" sub="Recettes créées sur 28 j">
              <BigStats stats={[{ value: `${ops.pipeline.rate} %`, label: `enrichies (${ops.pipeline.enriched} / ${ops.pipeline.created})`, hint: `${ops.pipeline.failed} en échec à relancer · ${ops.pipeline.stale} bloquée${ops.pipeline.stale > 1 ? "s" : ""} depuis + 1 h` }]} />
            </Card>
            <Card span={4} title="Crons & démo" sub="Derniers passages">
              <BigStats stats={[{ value: <span style={{ fontSize: 18 }}>{ops.crons.rollupLabel} · {ops.crons.syncLabel}</span>, label: "demo-reset · app-store-sync", hint: `${ops.demo.seedFr} recettes seed FR · ${ops.demo.seedEn} EN · ${ops.demo.trials} essais démo sur 28 j` }]} />
            </Card>
            <Card span={6} title="Compte & accès · 4 sem." sub="Récupération par e-mail">
              <BigStats stats={[{ value: <>{ops.account.withEmail} <small>/ {ops.account.total}</small></>, label: `personnes avec un e-mail de secours · ${ops.account.newWithEmail} / ${ops.account.newTotal} parmi les nouvelles`, hint: `${ops.account.recoverySent} tokens émis · ${ops.account.recoveryUsed} consommés · ${ops.account.burned} brûlé${ops.account.burned > 1 ? "s" : ""} · ${ops.account.merges} fusion${ops.account.merges > 1 ? "s" : ""} d'identités` }]} />
            </Card>
            <Card span={6} title="Frictions démo · 28 j" sub="Ce que les visiteurs tentent sans pouvoir">
              <BigStats stats={[{ value: ops.demo.frozen, label: "blocages « monde gelé » (403)", hint: `${ops.demo.aiCalls} appels IA depuis la démo · ${ops.demo.recipes} recettes ajoutées puis purgées` }]} />
            </Card>
          </div>
        </details>

        <details className="defs" id="defs">
          <summary>Définitions &amp; limites (une seule fois, pour toute la page)</summary>
          <dl>
            <dt>Cuisinier actif</dt>
            <dd>Personne réelle (≥ 1 carnet réel, aucun carnet démo/test) active au moins un jour sur 28 j. v1 = a ouvert l&apos;app ; v2 = a consulté ou ajouté une recette (consultation comptée depuis le 13 sept. 2026).</dd>
            <dt>Nouvelle personne</dt>
            <dd>Création d&apos;une identité réelle (sortie de démo, landing, invitation). Canal = plateforme de la première session, ou « invitation » si le carnet existait déjà.</dd>
            <dt>Activée à 7 j</dt>
            <dd>≥ 3 recettes ajoutées ET ≥ 1 jour actif après J+1, dans les 7 jours suivant le premier carnet.</dd>
            <dt>Rétention M1 / M2 / M3</dt>
            <dd>Mois de 28 jours : active au moins un jour entre J+28 et J+55 (M1), J+56 et J+83 (M2), J+84 et J+111 (M3). Cohorte = mois du premier carnet. Bloc 1 : version glissante (arrivées des 4 semaines closes il y a 8 semaines).</dd>
            <dt>Comparaisons</dt>
            <dd>Semaines ISO ; « 4 sem. » = 4 semaines pleines terminées dimanche, comparées aux 4 précédentes. Le % est toujours accompagné de n/N ; il passe en gris sous 20 personnes, avec la marge d&apos;erreur (Wilson 95 %) au survol.</dd>
            <dt>Repères marché</dt>
            <dd>Médianes publiées (AppTweak 2025 pour la fiche App Store ; AppsFlyer/Adjust/data.ai via UXCam pour la rétention). Ordres de grandeur, définitions proches mais pas identiques (D30 = actif le jour 30 ; notre M1 = actif au moins un jour entre J+28 et J+55).</dd>
            <dt>Limites connues</dt>
            <dd>
              Avant le {shortDate(METRIC_EPOCHS.ownerGrain)} : personne ≡ session (majorant) et jours actifs sous-capturés. Essais démo comptés depuis le {shortDate(METRIC_EPOCHS.demoTrials)}, conversions marquées depuis le {shortDate(METRIC_EPOCHS.conversionMarker)}, stats App Store depuis le {shortDate(METRIC_EPOCHS.appStoreDaily)} (compteurs arrondis, seuillés, J-1). Fiche 1.3 en ligne le {shortDate(PRODUCT_EVENTS.appStoreListingV2)}. Aucune donnée anonyme de landing. Canaux : {Object.values(CHANNEL_LABELS).join(", ")}.
            </dd>
          </dl>
        </details>
      </div>
    </div>
  );
}
