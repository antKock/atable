import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { listSessions } from "@/lib/admin/parcours";
import { Topbar, SectionHead, Card } from "@/components/admin/AdminUi";
import { fmtDateTime, fmtDuration } from "./format";
import "../stats/dashboard.css";

export const dynamic = "force-dynamic";

// Parcours (#28, spec §8.2) : les 50 dernières sessions — le « replay pauvre ».
// Une session = même appareil, trou < 30 min. Clic → la timeline brute.
// `?owner=<id>` (lien depuis Explorer) : les sessions d'une personne ;
// `?demo=1` : les visiteurs démo. Réservé à l'admin.

export default async function ParcoursPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();
  const sp = await searchParams;
  const demo = sp.demo === "1";
  const ownerId = typeof sp.owner === "string" ? sp.owner : undefined;

  const sessions = await listSessions({ demo, ownerId });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mijote-dash">
      <Topbar current="parcours" dataDate={today.slice(8, 10) + "/" + today.slice(5, 7)} />
      <div className="page">
        <div className="section" style={{ marginTop: 8 }}>
          <SectionHead
            n="P"
            title="Parcours"
            q="Une session = un appareil, moins de 30 min entre deux événements · sondes et admin jamais tracés"
          />
          <div className="chips" style={{ marginBottom: 12 }}>
            <Link href="/admin/parcours" className={"chip" + (!demo && !ownerId ? " active" : "")}>
              Personnes réelles
            </Link>
            <Link href="/admin/parcours?demo=1" className={"chip" + (demo ? " active" : "")}>
              Visiteurs démo
            </Link>
            {ownerId && <span className="chip active">Une personne</span>}
          </div>
          <Card
            span={12}
            title={`${sessions.length} session${sessions.length > 1 ? "s" : ""}`}
            sub="Les plus récentes d'abord · « ? » dans la timeline = clic sur un élément sans identifiant (l'imprévu)"
          >
            <div style={{ overflowX: "auto" }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Début</th>
                    <th>Personne</th>
                    <th>Plateforme</th>
                    <th>Bras</th>
                    <th className="num">Durée</th>
                    <th className="num">Écrans</th>
                    <th className="num">Erreurs API</th>
                    <th>Premier écran</th>
                    <th>Dernier écran</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.session_id ?? ""} className={s.owner_id ? undefined : "muted"}>
                      <td>
                        <Link href={`/admin/parcours/${s.anon_id}#s${s.session_no}`}>
                          {fmtDateTime(s.started_at)}
                        </Link>
                      </td>
                      <td>{s.display_name ?? (s.owner_id ? "—" : "anonyme")}</td>
                      <td>
                        {s.platform ?? "?"}
                        {s.app_version ? ` · ${s.app_version}` : ""}
                      </td>
                      <td>{s.variant ?? "—"}</td>
                      <td className="num">{fmtDuration(s.started_at, s.ended_at)}</td>
                      <td className="num">{s.n_screens ?? 0}</td>
                      <td className="num">
                        {s.n_api_errors ? <span className="pill warn">{s.n_api_errors}</span> : ""}
                      </td>
                      <td>{s.first_route ?? "—"}</td>
                      <td>{s.last_route ?? "—"}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={9}>Aucune session enregistrée.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
