import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { describeEvent, getTimeline } from "@/lib/admin/parcours";
import { isUuid } from "@/lib/events/catalog";
import { Topbar, SectionHead, Card } from "@/components/admin/AdminUi";
import { fmtDateTime, fmtTime } from "../format";
import "../../stats/dashboard.css";

export const dynamic = "force-dynamic";

// Timeline brute d'un appareil (#28, spec §8.2), groupée par session, la plus
// récente en haut. Pseudonyme (surnom), identifiants tronqués, jamais de contenu.

export default async function ParcoursDetailPage({
  params,
}: {
  params: Promise<{ anonId: string }>;
}) {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();
  const { anonId } = await params;
  if (!isUuid(anonId)) notFound();

  const timeline = await getTimeline(anonId);
  if (!timeline) notFound();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mijote-dash">
      <Topbar current="parcours" dataDate={today.slice(8, 10) + "/" + today.slice(5, 7)} />
      <div className="page">
        <div className="section" style={{ marginTop: 8 }}>
          <SectionHead
            n="P"
            title={timeline.displayName ?? "Appareil anonyme"}
            q={`appareil ${anonId.slice(0, 8)} · ${timeline.sessions.length} session${timeline.sessions.length > 1 ? "s" : ""}${timeline.ownerId ? "" : " · jamais de carnet"}`}
          />
          <div className="chips" style={{ marginBottom: 12 }}>
            <Link href="/admin/parcours" className="chip">
              ← Toutes les sessions
            </Link>
            {timeline.ownerId && (
              <Link href={`/admin/parcours?owner=${timeline.ownerId}`} className="chip">
                Sessions de cette personne
              </Link>
            )}
          </div>
          {timeline.sessions.map((s) => {
            const first = s.events[0];
            return (
              <Card
                key={s.sessionNo}
                span={12}
                title={`Session ${s.sessionNo} · ${fmtDateTime(s.startedAt)}`}
                sub={`${first?.platform ?? "?"}${first?.app_version ? ` · ${first.app_version}` : ""}${first?.variant ? ` · bras ${first.variant}` : ""}${first?.is_demo ? " · démo" : ""} · ${s.events.length} événements`}
              >
                <div id={`s${s.sessionNo}`} style={{ overflowX: "auto" }}>
                  <table className="list">
                    <thead>
                      <tr>
                        <th>Heure</th>
                        <th>Quoi</th>
                        <th>Détail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.events.map((e) => {
                        const d = describeEvent(e);
                        return (
                          <tr
                            key={e.id ?? ""}
                            className={e.source === "server" ? undefined : "muted"}
                          >
                            <td style={{ whiteSpace: "nowrap" }}>{fmtTime(e.at)}</td>
                            <td>
                              {d.tone ? <span className={`pill ${d.tone}`}>{d.what}</span> : d.what}
                            </td>
                            <td
                              style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 12 }}
                            >
                              {d.detail}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
