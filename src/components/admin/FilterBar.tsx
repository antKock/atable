"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PLATFORM_COLORS } from "@/lib/admin/palette";
import { PERIODS, DEFAULT_PERIOD, isPeriodKey } from "@/lib/admin/periods";
import type { HouseholdOption } from "@/lib/admin/queries";

const PLATFORMS: { key: "ios" | "android" | "web"; label: string }[] = [
  { key: "ios", label: "iOS" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web" },
];

/**
 * Common filter bar. Period, platform and foyer(s) all drive the server query
 * live via search params (`period`, `platform`, `hh`). The household list is
 * passed in from the (server) page so the picker can resolve ids → names.
 */
export default function FilterBar({ households }: { households: HouseholdOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function commit(next: URLSearchParams) {
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  }
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    commit(next);
  }

  // ---- period (single select; default omitted from the URL) ----
  const activePeriod = isPeriodKey(params.get("period")) ? params.get("period") : DEFAULT_PERIOD;
  function setPeriod(key: string) {
    setParam("period", key === DEFAULT_PERIOD ? null : key);
  }

  // ---- platform (toggle) ----
  const activePlatform = params.get("platform");
  function setPlatform(key: string) {
    setParam("platform", activePlatform === key ? null : key);
  }

  // ---- foyer(s) (multi-select typeahead) ----
  const selectedIds = (params.get("hh") ?? "").split(",").filter(Boolean);
  const selected = households.filter((h) => selectedIds.includes(h.id));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  function setHouseholds(ids: string[]) {
    setParam("hh", ids.length ? ids.join(",") : null);
  }
  const matches = query.trim()
    ? households
        .filter((h) => !selectedIds.includes(h.id) && h.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="filterbar">
      <div className="fgroup">
        <span className="flabel">Période</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={"chip" + (activePeriod === p.key ? " on" : "")}
            onClick={() => setPeriod(p.key)}
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="fdivider" />
      <div className="fgroup">
        <span className="flabel">Plateforme</span>
        {PLATFORMS.map((pl) => {
          const on = activePlatform === pl.key;
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
        <span className="flabel">Foyer(s)</span>
        {selected.map((h) => (
          <span key={h.id} className="chip on" title={h.name}>
            {h.name}
            <button
              type="button"
              className="chip-x"
              aria-label={`Retirer ${h.name}`}
              onClick={() => setHouseholds(selectedIds.filter((id) => id !== h.id))}
            >
              ×
            </button>
          </span>
        ))}
        <div className="fpicker">
          <input
            className="fsearch"
            placeholder={selected.length ? "Ajouter…" : "Filtrer par foyer…"}
            aria-label="Filtrer par foyer"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {open && matches.length > 0 && (
            <div className="fpicker-menu">
              {matches.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="fopt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setHouseholds([...selectedIds, h.id]);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
