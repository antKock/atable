import { SectionHead } from "@/components/admin/AdminUi";
import { Spark, NorthStarChart } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";
const fr = (n: number) => n.toLocaleString("fr-FR");

export default function Glance({ o }: { o: DashboardV3["overview"] }) {
  return (
    <>
    {/* ============ 1 · EN UN COUP D'ŒIL ============ */}
    <div className="section">
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
    </>
  );
}
