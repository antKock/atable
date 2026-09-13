import { shortDate } from "@/lib/admin/v3/weeks";
import { PALETTE as P } from "@/lib/admin/palette";
import {
  SectionHead,
  Card,
  Funnel,
  BarRow,
  BigStats,
  RatioText,
  Legend,
} from "@/components/admin/AdminUi";
import { StackedWeekly, StoreRates } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";

export default function Acquire({
  acq,
  engage,
}: {
  acq: DashboardV3["acquisition"];
  engage: DashboardV3["engage"];
}) {
  return (
    <>
      {/* ============ 2 · ACQUÉRIR ============ */}
      <div className="section">
        <SectionHead
          n="2"
          title="Acquérir"
          q="D'où viennent les gens — un tunnel par canal, jamais additionnés"
        />
        <div className="cards">
          <Card
            span={4}
            title="App Store (iOS) · 4 sem."
            sub="Compteurs Apple arrondis · données à J-1"
            def={
              <>
                Impressions et vues de fiche : rapport Discovery & Engagement (App Store Connect).
                Téléchargements : premiers téléchargements (hors mises à jour et retéléchargements).
                1ʳᵉ ouverture iOS = sessions démo créées depuis l&apos;app (28 j). 1er carnet iOS =
                nouvelles personnes dont la première session est iOS (28 j). Apple seuille les
                petits volumes.
                {acq.appStore.lastDay && (
                  <> Données Apple jusqu&apos;au {shortDate(acq.appStore.lastDay)}.</>
                )}
              </>
            }
          >
            <Funnel
              rows={[
                {
                  label: "Impressions",
                  value: acq.appStore.impressions,
                  hint: "100 %",
                  color: P.ochre,
                },
                {
                  label: "Vues de fiche",
                  value: acq.appStore.pageViews,
                  hint: acq.appStore.impressions
                    ? `${Math.round((acq.appStore.pageViews / acq.appStore.impressions) * 100)} %`
                    : undefined,
                },
                {
                  label: "Premiers téléchargements",
                  value: acq.appStore.downloads,
                  hint:
                    acq.appStore.impressionToInstall != null
                      ? `${String(acq.appStore.impressionToInstall).replace(".", ",")} %`
                      : undefined,
                },
                { label: "1ʳᵉ ouverture iOS", value: acq.appStore.firstOpenIos },
                { label: "1er carnet iOS", value: acq.appStore.firstCarnetIos },
              ]}
            />
            <div className="bench">
              fiche → téléchargement : repère marché Food &amp; Drink ≈ 53 % (AppTweak 2025) ·
              impression → téléchargement ≈ 3,6 %
            </div>
          </Card>
          <Card
            span={3}
            title="Web · 28 j"
            sub="Essai démo depuis un navigateur"
            def={
              <>
                Essais = sessions démo créées depuis un navigateur (sondes exclues). Carnet =
                personnes sorties de la démo vers un premier carnet, première session web. Visites
                de la landing non mesurées (pas de tracking anonyme).
              </>
            }
          >
            <Funnel
              rows={[
                { label: "Essais démo web", value: acq.web.trials },
                { label: "1er carnet web", value: acq.web.conversions, color: P.terracotta },
              ]}
            />
            <div className="note">
              Visites de la landing non mesurées (choix : pas de tracking anonyme).
            </div>
          </Card>
          <Card
            span={5}
            title="Nouvelles personnes par semaine et par canal"
            sub="12 semaines closes · repère 1.3 = fiche App Store refondue"
            def={
              <>
                Canal = plateforme de la première session (App Store = iOS, Web, Android) ; «
                Invitation » = a rejoint un carnet qui existait déjà (code invité ou membre). Une
                personne = une identité réelle (hors démo et tests).
              </>
            }
            footer={
              <Legend
                items={[
                  { label: "App Store", color: P.olive },
                  { label: "Web", color: P.ochre },
                  { label: "Android", color: P.clay },
                  { label: "Invitation", color: P.sage },
                ]}
              />
            }
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
          <Card
            span={12}
            title="Funnel App Store par semaine"
            sub="Impressions → téléchargements → 1ʳᵉ ouverture iOS → 1er carnet iOS · 12 semaines closes · taux grisé sous 20 téléchargements"
            def={
              <>
                Impressions et téléchargements : Apple (depuis le 16 août 2026). 1ʳᵉ ouverture =
                sessions démo créées depuis l&apos;app iOS dans la semaine (par plateforme depuis le
                12 sept. ; avant, sessions vivantes 30 j). 1er carnet = nouvelles personnes dont la
                première session est iOS. Les vues de fiche, seuillées par Apple, ne sont pas un
                maillon fiable et restent hors du tableau.
              </>
            }
            footer={
              <Legend
                items={[
                  { label: "Impression → téléchargement (axe droit)", color: P.ochre },
                  { label: "Téléchargement → 1ʳᵉ ouverture", color: P.olive },
                  { label: "Ouverture → 1er carnet", color: P.terracotta },
                ]}
              />
            }
          >
            <div className="funnel-weekly">
              <div style={{ overflowX: "auto" }}>
                <table className="weeks">
                  <thead>
                    <tr>
                      <th>Semaine</th>
                      <th>Impr.</th>
                      <th>Téléch.</th>
                      <th>Ouvert.</th>
                      <th>Carnets</th>
                      <th>Impr → tél.</th>
                      <th>Tél → ouv.</th>
                      <th>Ouv → carnet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...acq.appStore.funnelWeekly]
                      .reverse()
                      .slice(0, 8)
                      .map((w) => {
                        const r = (v: number | null) =>
                          v == null ? "—" : `${String(v).replace(".", ",")} %`;
                        return (
                          <tr key={w.weekStart}>
                            <td>{w.label}</td>
                            <td>{w.impressions.toLocaleString("fr-FR")}</td>
                            <td>{w.downloads}</td>
                            <td>{w.opens}</td>
                            <td>{w.carnets}</td>
                            <td className={w.fragile ? "fragile" : undefined}>{r(w.imprToDl)}</td>
                            <td className={w.fragile ? "fragile" : undefined}>{r(w.dlToOpen)}</td>
                            <td className={w.fragile ? "fragile" : undefined}>
                              {r(w.openToCarnet)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <StoreRates data={acq.appStore.funnelWeekly} />
            </div>
          </Card>
          <Card
            span={4}
            title="Origine des téléchargements · 4 sem."
            sub="Source App Store, referrers nommés"
            def={
              <>
                Source du premier téléchargement telle que rapportée par Apple : recherche,
                navigation, ouverture de la fiche depuis une autre app (referrer, ex. ChatGPT) ou
                depuis le web. Sans lien possible avec une personne côté Mijote.
              </>
            }
          >
            {acq.appStore.sources.length ? (
              <div className="method">
                {acq.appStore.sources.map((s, i) => (
                  <BarRow
                    key={s.label}
                    label={s.label}
                    value={s.downloads}
                    max={acq.appStore.sources[0].downloads}
                    text={String(s.downloads)}
                    color={i === 0 ? P.olive : P.sage}
                  />
                ))}
              </div>
            ) : (
              <div className="note">Aucun téléchargement rapporté sur la fenêtre.</div>
            )}
          </Card>
          <Card
            span={4}
            title="Invitations & partage · 28 j"
            sub="Personnes arrivées par un code invité ou un lien"
            def={
              <>
                Arrivées par invitation = personnes dont la première membership est un carnet créé
                avant elles (membre ou invité en lecture). Les copies de recettes partagées sont en
                bloc 5.
              </>
            }
          >
            <BigStats
              stats={[
                {
                  value: acq.invites,
                  label: "personnes arrivées par invitation",
                  hint: `${engage.carnetsWithGuests} carnet${engage.carnetsWithGuests > 1 ? "s" : ""} avec ≥ 1 invité en lecture`,
                },
                {
                  value: engage.sharing.copies,
                  label: "recettes copiées depuis un lien · 12 sem.",
                  hint: `${engage.sharing.links} liens émis${engage.sharing.estimate ? " (dates approchées avant le 13 sept.)" : ""}`,
                },
              ]}
            />
          </Card>
          <Card
            span={4}
            title="Essai démo → premier carnet · 28 j"
            sub="Par plateforme d'essai"
            def={
              <>
                Conversions marquées en base à la sortie de démo (depuis le 14 août 2026),
                rapportées aux essais démo de la même plateforme sur 28 jours. Pourcentage grisé
                sous 20 essais.
              </>
            }
          >
            <div className="method">
              {(["ios", "web", "android"] as const).map((k) => (
                <BarRow
                  key={k}
                  label={k === "ios" ? "iOS" : k === "web" ? "Web" : "Android"}
                  value={acq.demo[k].n}
                  max={Math.max(1, acq.demo.ios.total, acq.demo.web.total, acq.demo.android.total)}
                  text={`${acq.demo[k].n} / ${acq.demo[k].total}`}
                  color={k === "ios" ? P.olive : k === "web" ? P.ochre : P.clay}
                />
              ))}
            </div>
            <div className="note">
              iOS : <RatioText r={acq.demo.ios} /> · Web : <RatioText r={acq.demo.web} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
