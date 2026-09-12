import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { createServerClient } from "@/lib/supabase/server";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { shortDate } from "@/lib/admin/v3/weeks";
import { Topbar, SectionHead, Card, BigStats } from "@/components/admin/ui";
import "../stats/dashboard.css";

export const dynamic = "force-dynamic";

// Santé (lot C) : la cadence ops — quotidienne, 30 secondes. Trois voyants,
// puis le détail : pipeline (échecs à relancer), crons, démo, coûts, compte.

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

type Failure = { id: string; title: string; household: string; failedPart: string; updatedAt: string };

async function loadFailures(): Promise<Failure[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, enrichment_status, image_status, updated_at, households!inner(name, is_demo)")
    .or("enrichment_status.eq.failed,image_status.eq.failed")
    .eq("is_seed", false)
    .eq("households.is_demo", false)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`enrichment_failures: ${error.message}`);
  return (data ?? []).map((r) => {
    const rel = r.households as { name?: string } | { name?: string }[] | null;
    const household = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "—";
    const meta = r.enrichment_status === "failed";
    const image = r.image_status === "failed";
    return {
      id: String(r.id),
      title: String(r.title ?? "Sans titre"),
      household,
      failedPart: meta && image ? "métadonnées + image" : meta ? "métadonnées" : "image",
      updatedAt: shortDate(String(r.updated_at).slice(0, 10)),
    };
  });
}

function Light({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="card" style={{ gridColumn: "span 4" }}>
      <div className="dot" style={{ fontSize: 15, fontWeight: 600, color: "var(--d-ink)" }}>
        <i className={ok ? "" : "red"} />
        {label}
      </div>
      <div className="note" style={{ fontSize: 12.5 }}>{detail}</div>
    </div>
  );
}

export default async function SantePage() {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();

  const [{ data }, failures] = await Promise.all([getDashboardV3(), loadFailures()]);
  const { ops, overview: o } = data;

  return (
    <div className="mijote-dash">
      <Topbar current="sante" dataDate={shortDate(data.windows.today)} />
      <div className="page">
        <div className="section" style={{ marginTop: 8 }}>
          <SectionHead n="S" title="Santé" q="Cadence quotidienne, 30 secondes : quelque chose est-il cassé ou anormalement cher ?" />
          <div className="cards">
            <Light ok={o.health.pipeline.ok} label="Pipeline IA" detail={o.health.pipeline.detail} />
            <Light ok={o.health.crons.ok} label="Crons" detail={o.health.crons.detail} />
            <Light ok={o.health.demo.ok} label="Démo" detail={o.health.demo.detail} />
          </div>
        </div>

        <div className="section">
          <SectionHead n="1" title="Pipeline d'enrichissement" q="Recettes créées sur 28 j, échecs à relancer via batch-enrich" />
          <div className="cards">
            <Card span={4} title="Sur 28 jours" sub="Hors démo">
              <BigStats
                stats={[
                  { value: `${ops.pipeline.rate} %`, label: `enrichies (${ops.pipeline.enriched} / ${ops.pipeline.created})` },
                  { value: ops.pipeline.stale, label: "bloquées depuis + 1 h (pending / processing)" },
                ]}
              />
            </Card>
            <Card span={8} title={`Échecs à relancer (${failures.length})`} sub="Toutes périodes, hors démo/test — relancer via scripts batch-enrich">
              {failures.length === 0 ? (
                <div className="note">Aucun échec d&apos;enrichissement — pipeline au vert.</div>
              ) : (
                <table className="list">
                  <thead>
                    <tr>
                      <th>Recette</th>
                      <th>Carnet</th>
                      <th>Échec</th>
                      <th>Dernière activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((f) => (
                      <tr key={f.id}>
                        <td>{f.title}</td>
                        <td>{f.household}</td>
                        <td>{f.failedPart}</td>
                        <td>{f.updatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>

        <div className="section">
          <SectionHead n="2" title="Coûts, crons, démo, compte" q="Le reste de la cadence ops" />
          <div className="cards">
            <Card span={4} title="Coût IA · 28 j" sub="Hors démo · réconcilié avec la facture OpenAI">
              <BigStats
                stats={[
                  { value: usd(ops.cost.total), label: ops.cost.billed != null ? `instrumenté · facturé ${usd(ops.cost.billed)} (org. entière)` : "instrumenté (pas de clé admin OpenAI)", hint: `${ops.cost.aiCalls} appels · ${usd(ops.cost.perRecipe)} / recette` },
                  { value: usd(ops.cost.demo), label: "consommé par la démo", hint: `${ops.demo.aiCalls} appels IA depuis la démo` },
                ]}
              />
            </Card>
            <Card span={4} title="Crons" sub="Derniers passages · alerte au-delà de 36 h">
              <BigStats
                stats={[
                  { value: <span style={{ fontSize: 20 }}>{ops.crons.rollupLabel}</span>, label: "demo-reset (03:00 UTC) · rollup stats_daily" },
                  { value: <span style={{ fontSize: 20 }}>{ops.crons.syncLabel}</span>, label: "app-store-sync (10:00 UTC)" },
                ]}
              />
            </Card>
            <Card span={4} title="Démo · 28 j" sub="Seed attendu, essais, frictions">
              <BigStats
                stats={[
                  { value: <>{ops.demo.seedFr} <small>FR</small> · {ops.demo.seedEn} <small>EN</small></>, label: "recettes seed en place" },
                  { value: ops.demo.trials, label: "essais démo (sondes exclues)", hint: `${ops.demo.frozen} blocages « monde gelé » (403) · ${ops.demo.recipes} recettes ajoutées puis purgées` },
                ]}
              />
            </Card>
            <Card span={12} title="Compte & accès · 4 sem." sub="Récupération par e-mail (#14)">
              <BigStats
                stats={[
                  { value: <>{ops.account.withEmail} <small>/ {ops.account.total}</small></>, label: `personnes avec un e-mail de secours · ${ops.account.newWithEmail} / ${ops.account.newTotal} parmi les nouvelles`, hint: `${ops.account.recoverySent} tokens émis · ${ops.account.recoveryUsed} consommés · ${ops.account.burned} brûlé${ops.account.burned > 1 ? "s" : ""} (5 essais) · ${ops.account.merges} fusion${ops.account.merges > 1 ? "s" : ""} d'identités` },
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
