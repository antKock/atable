import { PALETTE as P } from "@/lib/admin/palette";
import { SectionHead, Card, Funnel, BigStats, Legend } from "@/components/admin/AdminUi";
import { StackedWeekly, Dist } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";
const METHOD_COLORS: Record<string, string> = {
  url: P.ochre,
  photo: P.terracotta,
  voice: P.sage,
  manual: P.olive,
  shared: P.clay,
  unknown: "#C9C2B2",
};

export default function Engage({ engage }: { engage: DashboardV3["engage"] }) {
  return (
    <>
      {/* ============ 5 · ENGAGER ============ */}
      <div className="section">
        <SectionHead n="5" title="Engager" q="Ce que font celles et ceux qui restent" />
        <div className="cards">
          <Card
            span={4}
            title="Recettes ajoutées par cuisinier actif · 28 j"
            sub="Un noyau intense, une longue traîne"
            def={
              <>
                Parmi les personnes actives sur 28 jours : nombre de recettes qu&apos;elles ont
                ajoutées (attribuées à l&apos;appareil créateur) sur la même période.
              </>
            }
          >
            <Dist data={engage.distribution} />
          </Card>
          <Card
            span={4}
            title="Consultent vs ajoutent · 28 j"
            sub="Combien cuisinent réellement avec l'app"
            tag={<span className="tag b">depuis le 13 sept.</span>}
            def={
              <>
                Consultation = ouverture d&apos;une fiche recette par une personne réelle, comptée
                par jour depuis le 13 septembre 2026 (lot B). Les 4 premières semaines sont
                partielles.
              </>
            }
          >
            <BigStats
              stats={[
                {
                  value: engage.viewers28,
                  label: "ont consulté ≥ 1 recette",
                  hint: "compteur démarré le 13 sept. 2026",
                },
                {
                  value: engage.adders28,
                  label: "ont ajouté ≥ 1 recette",
                  hint: `${engage.engaged28} ont fait l'un ou l'autre, sur ${engage.active28} actives`,
                },
              ]}
            />
          </Card>
          <Card
            span={4}
            title="Méthodes d'ajout · 12 semaines"
            sub="Part de chaque méthode par semaine"
            footer={
              <Legend
                items={engage.methodKeys.map((k, i) => ({
                  label: engage.methodLabels[i],
                  color: METHOD_COLORS[k],
                }))}
              />
            }
          >
            <StackedWeekly
              data={engage.methodMix}
              series={engage.methodKeys.map((k, i) => ({
                key: k,
                name: engage.methodLabels[i],
                color: METHOD_COLORS[k],
              }))}
              percent
              emptySub="Se remplit avec les recettes ajoutées."
            />
          </Card>
          <Card
            span={6}
            title="Boucle de partage · 12 semaines"
            sub="Liens émis → recettes copiées → nouvelles personnes"
            def={
              <>
                Liens = recettes dont un lien de partage a été généré sur la fenêtre (datés depuis
                le 13 sept. 2026 ; avant, date de la recette). Copies = recettes créées par «
                Ajouter à mon carnet » depuis un lien. Nouvelles personnes = arrivées par invitation
                sur la fenêtre.
              </>
            }
          >
            <Funnel
              rows={[
                { label: "Liens de partage émis", value: engage.sharing.links },
                { label: "Recettes copiées par un destinataire", value: engage.sharing.copies },
                { label: "Nouvelles personnes par invitation", value: engage.sharing.arrivals },
              ]}
            />
            {engage.sharing.estimate && (
              <div className="note">
                Liens d&apos;avant le 13 sept. datés de la création de la recette (approché).
              </div>
            )}
          </Card>
          <Card span={6} title="Carnets partagés" sub="Comment les carnets se peuplent">
            <BigStats
              stats={[
                {
                  value: (
                    <>
                      {engage.sharedCarnets} <small>/ {engage.carnets}</small>
                    </>
                  ),
                  label: "carnets à plusieurs (membres ou invités)",
                  hint: `${engage.carnetsWithGuests} avec ≥ 1 invité en lecture · ${engage.multiCarnet} personne${engage.multiCarnet > 1 ? "s ont" : " a"} plus d'un carnet`,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
