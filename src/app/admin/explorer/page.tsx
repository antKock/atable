import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { CHANNEL_LABELS, type Person } from "@/lib/admin/v3/people";
import { shortDate } from "@/lib/admin/v3/weeks";
import { Topbar, SectionHead, Card } from "@/components/admin/ui";
import "../stats/dashboard.css";

export const dynamic = "force-dynamic";

// Explorer (lot C) : les personnes et les carnets, nominativement (surnoms
// auto ou prénom choisi), pour aller VOIR ce que font les gens derrière les
// chiffres — à petit volume, le qualitatif complète les %. Réservé à l'admin.

type Filter = "all" | "active" | "leaving" | "new" | "gone";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Actives 28 j" },
  { key: "new", label: "Nouvelles (4 sem.)" },
  { key: "leaving", label: "En train de partir" },
  { key: "gone", label: "Parties" },
];

function status(p: Person, today: string): { key: Filter; label: string; cls: string } {
  const d0 = p.created_at.slice(0, 10);
  const ageDays = Math.round((new Date(today + "T00:00:00Z").getTime() - new Date(d0 + "T00:00:00Z").getTime()) / 86_400_000);
  if (ageDays <= 28) return { key: "new", label: "nouvelle", cls: "ok" };
  if (p.active_28d) return { key: "active", label: "active", cls: "ok" };
  if (p.active_prev28) return { key: "leaving", label: "en train de partir", cls: "warn" };
  return { key: "gone", label: "partie", cls: "bad" };
}

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as Filter) : "all";

  const { data, raw } = await getDashboardV3();
  const today = data.windows.today;
  const people = raw.people
    .map((p) => ({ p, st: status(p, today) }))
    .filter(({ p, st }) => filter === "all" || (filter === "active" ? p.active_28d : st.key === filter))
    .sort((a, b) => (b.p.last_active_day ?? "").localeCompare(a.p.last_active_day ?? "") || b.p.recipes_total - a.p.recipes_total);
  const carnets = [...raw.carnets].sort((a, b) => b.recipes - a.recipes);

  return (
    <div className="mijote-dash">
      <Topbar current="explorer" dataDate={shortDate(today)} />
      <div className="page">
        <div className="section" style={{ marginTop: 8 }}>
          <SectionHead n="A" title="Personnes" q="Surnom auto ou prénom choisi · jamais d'e-mail affiché" />
          <div className="chips" style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <a key={f.key} href={`/admin/explorer?filter=${f.key}`} className={"chip" + (filter === f.key ? " active" : "")}>
                {f.label}
              </a>
            ))}
          </div>
          <Card span={12} title={`${people.length} personne${people.length > 1 ? "s" : ""}`} sub="Triées par dernière activité · « en train de partir » = active il y a 4-8 semaines, silencieuse depuis 4 semaines">
            <div style={{ overflowX: "auto" }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Personne</th>
                    <th>Statut</th>
                    <th>Arrivée</th>
                    <th>Canal</th>
                    <th>1ʳᵉ recette</th>
                    <th className="num">Carnets</th>
                    <th className="num">Recettes</th>
                    <th className="num">28 j</th>
                    <th className="num">Jours actifs 28 j</th>
                    <th className="num">Vues 28 j</th>
                    <th>Dernière activité</th>
                    <th>E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(({ p, st }) => (
                    <tr key={p.id} className={st.key === "gone" ? "muted" : undefined}>
                      <td>{p.display_name ?? "—"}</td>
                      <td>
                        <span className={"pill " + st.cls}>{st.label}</span>
                      </td>
                      <td>{shortDate(p.created_at.slice(0, 10))}</td>
                      <td>{CHANNEL_LABELS[p.channel]}{p.via_demo ? " · démo" : ""}</td>
                      <td>{p.first_method ?? "—"}</td>
                      <td className="num">{p.carnets}{p.guest_of ? ` +${p.guest_of} inv.` : ""}</td>
                      <td className="num">{p.recipes_total}</td>
                      <td className="num">{p.recipes_28d}</td>
                      <td className="num">{p.active_days_28d}</td>
                      <td className="num">{p.views_28d}</td>
                      <td>{p.last_active_day ? shortDate(p.last_active_day) : "—"}</td>
                      <td>{p.has_email ? "✓" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="section">
          <SectionHead n="B" title="Carnets" q="Par nombre de recettes" />
          <Card span={12} title={`${carnets.length} carnet${carnets.length > 1 ? "s" : ""} réels`} sub="Membres, invités en lecture, recettes, liens de partage, dernière activité via les membres">
            <div style={{ overflowX: "auto" }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Carnet</th>
                    <th>Créé</th>
                    <th>Origine</th>
                    <th className="num">Membres</th>
                    <th className="num">Invités</th>
                    <th className="num">Recettes</th>
                    <th className="num">Liens</th>
                    <th>Dernière activité</th>
                  </tr>
                </thead>
                <tbody>
                  {carnets.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{shortDate(c.created_at.slice(0, 10))}</td>
                      <td>{c.origin}</td>
                      <td className="num">{c.members}</td>
                      <td className="num">{c.guests}</td>
                      <td className="num">{c.recipes}</td>
                      <td className="num">{c.shared_links}</td>
                      <td>{c.last_active_day ? shortDate(c.last_active_day) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
