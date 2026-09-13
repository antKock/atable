import { Card, BigStats } from "@/components/admin/AdminUi";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";
const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

export default function Ops({ o, ops }: { o: DashboardV3["overview"]; ops: DashboardV3["ops"] }) {
  return (
    <>
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
    </>
  );
}
