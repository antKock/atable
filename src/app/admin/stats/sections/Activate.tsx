import { nLabel, pctLabel } from "@/lib/admin/v3/ratio";
import { shortDate } from "@/lib/admin/v3/weeks";
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
          <Card
            span={12}
            title="A/B onboarding · « Commencer » (B) vs démo (A)"
            sub={`Depuis le ${shortDate(act.ab.since)} · premières ouvertures iOS · comptes par bras, pas de % tant que N < 50`}
            def={
              <>
                Backlog #25. Affectations = bras tiré au premier rendu de la landing (50/50 par
                appareil), <strong>restreint au shell iOS natif</strong> : sur le web, le compteur
                se remplit de scanners et de visites qui n&apos;installent jamais, alors que les
                carnets viennent d&apos;iOS (migration 050). Carnet = owner réel créé avec ce bras
                (les arrivées par invitation n&apos;ont pas de bras). Chaque étape est comptée dès
                qu&apos;elle est franchie ; « en cours » = personnes qui peuvent encore la franchir
                (fenêtre J+7, puis M1 = J+28 → J+55) — tant qu&apos;il en reste, le compte est un
                plancher. Critère principal : ≥ 1 recette à J+7. Durée : 8 semaines, revue à 4. On
                lit des comptes et on tranche en PM — à ≈ 12 arrivants par bras et par mois, rien ne
                sera significatif.
              </>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table className="weeks">
                <thead>
                  <tr>
                    <th>Bras</th>
                    <th>Affectations iOS</th>
                    <th>Carnets créés</th>
                    <th>≥ 1 recette J+7</th>
                    <th>Activées J+7</th>
                    <th>Actives M1</th>
                  </tr>
                </thead>
                <tbody>
                  {act.ab.arms.map((arm) => (
                    <tr key={arm.arm}>
                      <td>{arm.arm === "b" ? "B · Commencer" : "A · Démo"}</td>
                      <td>
                        {arm.assigned}
                        <span className="n">· {arm.assignedAll} toutes surfaces</span>
                      </td>
                      <td>{arm.owners}</td>
                      <td>
                        {arm.firstRecipe.done} / {arm.owners}
                        {arm.firstRecipe.pending > 0 && (
                          <span className="n">· {arm.firstRecipe.pending} en cours</span>
                        )}
                      </td>
                      <td>
                        {arm.activated.done} / {arm.owners}
                        {arm.activated.pending > 0 && (
                          <span className="n">· {arm.activated.pending} en cours</span>
                        )}
                      </td>
                      <td>
                        {arm.activeM1.done} / {arm.owners}
                        {arm.activeM1.pending > 0 && (
                          <span className="n">· {arm.activeM1.pending} en cours</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note">
              n / N : N = tous les carnets du bras, y compris ceux dont la fenêtre court encore («
              en cours »). Test non démarré ou flag éteint = zéros partout.
              {act.ab.before.a + act.ab.before.b > 0 && (
                <>
                  {" "}
                  Avant la fenêtre (affectations iOS non mesurées par bras) : A {
                    act.ab.before.a
                  }{" "}
                  carnet(s) · B {act.ab.before.b}.
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
