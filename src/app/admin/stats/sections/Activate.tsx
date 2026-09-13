import { nLabel, pctLabel } from "@/lib/admin/v3/ratio";
import { PALETTE as P } from "@/lib/admin/palette";
import { SectionHead, Card, Funnel, BarRow, Legend } from "@/components/admin/AdminUi";
import { ActivationWeekly } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";
const METHOD_COLORS: Record<string, string> = {
  url: P.ochre,
  photo: P.terracotta,
  voice: P.sage,
  manual: P.olive,
  shared: P.clay,
  unknown: "#C9C2B2",
};

export default function Activate({ act }: { act: DashboardV3["activation"] }) {
  return (
    <>
      {/* ============ 3 · ACTIVER ============ */}
      <div className="section">
        <SectionHead
          n="3"
          title="Activer"
          q="Du premier carnet au premier vrai usage — « activée » = ≥ 3 recettes et ≥ 1 retour après J+1, dans les 7 jours"
        />
        <div className="cards">
          <Card
            span={5}
            title="Parcours des 7 premiers jours"
            sub={`Personnes arrivées depuis juin (${act.funnel.arrivals}), jugeables à J+7`}
            def={
              <>
                Cohorte = personnes réelles arrivées depuis le 1er juin 2026 dont le 7ᵉ jour est
                passé. 1ʳᵉ recette = première recette ajoutée par la personne dans les 7 j ; retour
                = au moins un jour actif entre J+1 et J+7 ; activée = les deux conditions (≥ 3
                recettes et retour).
              </>
            }
          >
            <Funnel
              rows={[
                { label: "1er carnet", value: act.funnel.arrivals },
                { label: "1ʳᵉ recette (7 j)", value: act.funnel.firstRecipe7d },
                { label: "≥ 3 recettes (7 j)", value: act.funnel.threeRecipes7d },
                { label: "≥ 1 retour après J+1", value: act.funnel.returned7d },
                {
                  label: "Activées",
                  value: act.funnel.activated.n,
                  hint: pctLabel(act.funnel.activated),
                  color: P.oliveDeep,
                },
              ]}
            />
          </Card>
          <Card
            span={4}
            title="Activation selon la première recette"
            sub="Méthode du tout premier ajout · activées / personnes"
            def={
              <>
                Méthode (URL, photo, voix, manuel, copie partagée) de la première recette ajoutée
                par la personne, sur la même cohorte que le parcours. La méthode du premier import
                prédit l&apos;activation : levier d&apos;onboarding.
              </>
            }
          >
            <div className="method">
              {act.byMethod.map((m) => (
                <BarRow
                  key={m.method}
                  label={m.label}
                  value={m.r.n}
                  max={Math.max(1, ...act.byMethod.map((x) => x.r.total))}
                  text={nLabel(m.r)}
                  color={METHOD_COLORS[m.method] ?? P.olive}
                />
              ))}
            </div>
            <div className="note">
              Barre = activées, sur une échelle commune ; le texte donne activées / personnes.
            </div>
          </Card>
          <Card
            span={3}
            title="Activées par semaine d'arrivée"
            sub="8 dernières semaines jugeables"
            footer={
              <Legend
                items={[
                  { label: "Arrivées", color: P.grid },
                  { label: "Activées", color: P.oliveDeep },
                ]}
              />
            }
          >
            <ActivationWeekly data={act.weekly} />
          </Card>
        </div>
      </div>
    </>
  );
}
