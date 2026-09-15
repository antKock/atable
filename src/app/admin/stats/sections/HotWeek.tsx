import { shortDate } from "@/lib/admin/v3/weeks";
import { SectionHead } from "@/components/admin/AdminUi";
import { MiniBars } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";

const num = (v: number) => String(v).replace(".", ",");

export default function HotWeek({ o }: { o: DashboardV3["overview"] }) {
  return (
    <>
      {/* ============ 0 · 7 DERNIERS JOURS (données chaudes) ============ */}
      <div className="section" style={{ marginTop: 8 }}>
        <SectionHead
          n="0"
          title="7 derniers jours"
          q={`Du ${shortDate(o.hotWindow.from)} au ${shortDate(o.hotWindow.to)} · repère = médiane des 3 semaines précédentes · barre olive au-dessus, terracotta en dessous de la médiane du même jour de semaine · dernière barre hachurée = journée en cours, partielle et hors chiffre · talon gris = pas encore de données, pas un zéro · toucher une barre pour le détail`}
        />
        <div className="hot">
          {o.hot.map((h) => {
            const today = h.bars.find((b) => b.partial);
            return (
              <div className="h" key={h.id}>
                <div className="lab">{h.label}</div>
                <div className="val">
                  {h.value == null ? "—" : num(h.value)}
                  {h.unit && h.value != null && <small>{h.unit}</small>}
                </div>
                {h.value == null || h.ref == null ? (
                  <div className="ref">pas encore de données</div>
                ) : (
                  <div className={"ref " + (h.trend ?? "")}>repère {num(h.ref)}</div>
                )}
                <MiniBars bars={h.bars} label={h.label} unit={h.unit} />
                <div className="today">
                  {today && today.value != null
                    ? `aujourd'hui ${num(today.value)} — en cours`
                    : "aujourd'hui : donnée non livrée"}
                </div>
                {h.hint && <div className="hint">{h.hint}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
