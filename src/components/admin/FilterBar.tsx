"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PLATFORM_COLORS } from "@/lib/admin/palette";

const PLATFORMS: { key: "ios" | "android" | "web"; label: string }[] = [
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web" },
];

const SEGMENTS = ["Foyers récents", "Gros volume", "Dormants", "Mobile only"];

/**
 * Common filter bar. Platform is wired live (drives the server query via the
 * `platform` search param); the other controls match the design and are
 * decorative for v1 (period/household need windowed SQL + a foyer picker).
 */
export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("platform");

  function setPlatform(key: string) {
    const next = new URLSearchParams(params.toString());
    if (active === key) next.delete("platform");
    else next.set("platform", key);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  return (
    <div className="filterbar">
      <div className="fgroup">
        <span className="flabel">Période</span>
        <span className="chip on">6 derniers mois</span>
      </div>
      <div className="fdivider" />
      <div className="fgroup">
        <span className="flabel">Plateforme</span>
        {PLATFORMS.map((pl) => {
          const on = active === pl.key;
          return (
            <button key={pl.key} className={"chip" + (on ? " on" : "")} onClick={() => setPlatform(pl.key)} type="button">
              <span className="dot" style={{ background: on ? "#fff" : PLATFORM_COLORS[pl.key] }} />
              {pl.label}
            </button>
          );
        })}
      </div>
      <div className="fdivider" />
      <div className="fgroup">
        <input className="fsearch" placeholder="Foyer(s)…" aria-label="Filtrer par foyer" />
      </div>
      <div className="fdivider" />
      <div className="fgroup">
        <span className="flabel">Segments</span>
        {SEGMENTS.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
