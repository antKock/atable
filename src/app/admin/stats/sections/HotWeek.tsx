import { shortDate } from "@/lib/admin/v3/weeks";
import { SectionHead } from "@/components/admin/AdminUi";
import { MiniBars } from "@/components/admin/Charts";
import type { DashboardV3 } from "@/lib/admin/v3/assemble";

export default function HotWeek({ o }: { o: DashboardV3["overview"] }) {
  return (
    <>
      {/* ============ 0 · 7 DERNIERS JOURS (données chaudes) ============ */}
      <div className="section" style={{ marginTop: 8 }}>
        <SectionHead
          n="0"
          title="7 derniers jours"
          q={`Du ${shortDate(o.hotWindow.from)} au ${shortDate(o.hotWindow.to)} · repère = médiane des 3 semaines précédentes · barres : olive au-dessus, terracotta en dessous de la médiane du même jour de semaine sur 4 semaines · toucher une barre pour le détail`}
        />
        <div className="hot">
          {o.hot.map((h) => (
            <div className="h" key={h.id}>
              <div className="lab">{h.label}</div>
              <div className="val">
                {String(h.value).replace(".", ",")}
                {h.unit && <small>{h.unit}</small>}
              </div>
              <div className={"ref " + h.trend}>repère {String(h.ref).replace(".", ",")}</div>
              <MiniBars
                values={h.bars}
                days={h.barDays}
                refs={h.barRefs}
                label={h.label}
                unit={h.unit}
              />
              {h.hint && <div className="hint">{h.hint}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
