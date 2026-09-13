import { shortDate } from "@/lib/admin/v3/weeks";
import { monthName } from "@/lib/admin/v3/assemble";
import { pctLabel } from "@/lib/admin/v3/ratio";
import { cohortColor } from "@/lib/admin/palette";
import { SectionHead, Card, BigStats, Legend } from "@/components/admin/AdminUi";
import { RetentionCurves, CohortCake } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";

export default function Retain({ ret }: { ret: DashboardV3["retention"] }) {
  return (
    <>
      {/* ============ 4 · RETENIR ============ */}
      <div className="section">
        <SectionHead
          n="4"
          title="Retenir"
          q="Reviennent-ils le mois suivant, et le suivant ? — la question du moment"
        />
        <div className="cards">
          <Card
            span={6}
            title="Rétention par cohorte d'arrivée"
            sub="Actives au moins un jour en M1 (J+28 → J+55), M2 (J+56 → J+83), M3 · depuis mai 2026"
            tag={<span className="tag">tout</span>}
            def={
              <>
                Cohorte = mois calendaire du premier carnet. Mois = 28 jours. Une cellule = % de la
                cohorte active au moins un jour dans la fenêtre, n/N dessous ; « partiel » = seules
                les personnes dont la fenêtre est entièrement passée sont comptées. Avant le 10
                juillet 2026 les jours actifs sont sous-capturés : mai et juin sont un peu
                pessimistes.
              </>
            }
          >
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
                      100 %
                      <span className="n">
                        {c.n} / {c.n}
                      </span>
                    </td>
                    {([c.m1, c.m2, c.m3] as const).map((cell, i) => {
                      if (
                        cell.state === "none" ||
                        (cell.state === "pending" &&
                          i > 0 &&
                          [c.m1, c.m2][i - 1].state === "pending")
                      )
                        return (
                          <td className="na" key={i}>
                            —
                          </td>
                        );
                      if (cell.state === "pending")
                        return (
                          <td className="na" key={i}>
                            {cell.pendingFrom
                              ? `dès le ${shortDate(cell.pendingFrom)}`
                              : "pas encore"}
                          </td>
                        );
                      const op = cell.r.pct == null ? 0.08 : 0.1 + (cell.r.pct / 100) * 0.45;
                      return (
                        <td
                          className={"c" + (cell.r.fragile ? " fragile" : "")}
                          style={{ background: `rgba(110,122,56,${op.toFixed(2)})` }}
                          key={i}
                          title={cell.r.margin != null ? `marge ± ${cell.r.margin} pts` : undefined}
                        >
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
            <div className="note">
              % en gris = moins de 20 personnes (fragile). Encore actives ces 28 j :{" "}
              {ret.cohorts.map((c) => `${monthName(c.month)} ${c.activeNow}`).join(" · ")}.
            </div>
          </Card>
          <Card
            span={6}
            title="Courbes de rétention"
            sub="Chaque cohorte comparée à la précédente — on cherche l'aplatissement"
            footer={
              <Legend
                items={[
                  ...ret.curves.map((c) => ({
                    label: monthName(c.month),
                    color: cohortColor(c.month),
                  })),
                  { label: "repère D30 marché ≈ 6 %", color: "#C9C2B2" },
                ]}
              />
            }
          >
            <RetentionCurves
              curves={ret.curves.map((c) => ({ ...c, label: monthName(c.month) }))}
              refPct={6}
            />
          </Card>
          <Card
            span={8}
            title="Cuisiniers actifs 28 j par génération"
            sub="Une strate par mois d'arrivée — elle persiste ou s'évapore · 12 semaines"
            footer={
              <Legend
                items={ret.cakeKeys.map((k, i) => ({
                  label: ret.cakeLabels[i],
                  color: cohortColor(k),
                }))}
              />
            }
          >
            <CohortCake data={ret.cake} keys={ret.cakeKeys} labels={ret.cakeLabels} />
          </Card>
          <Card
            span={4}
            title="À rattraper"
            sub="Actives il y a 4-8 semaines, silencieuses depuis 4 semaines"
            def={
              <>
                Personnes actives entre J-55 et J-28 et sans aucun jour actif depuis 28 jours. La
                liste nominative est dans Explorer.
              </>
            }
          >
            <BigStats
              stats={[
                {
                  value: ret.leaving,
                  label: "personnes en train de partir",
                  hint: (
                    <>
                      dont {ret.leavingWithEmailAndRecipes} avec ≥ 5 recettes et un e-mail de
                      secours → <a href="/admin/explorer?filter=leaving">voir dans Explorer</a>
                    </>
                  ),
                },
                {
                  value: ret.activeWithoutEmail,
                  label: "personnes actives sans e-mail",
                  hint: "perdent tout si elles perdent leur session",
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
