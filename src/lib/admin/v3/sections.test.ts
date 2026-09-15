import { describe, it, expect } from "vitest";
import {
  dayList,
  median,
  roundedShares,
  weeklyActiveSeries,
  weeklyRecipesSeries,
  hotIndicator,
  pct1,
} from "./sections";

describe("dayList / median / pct1", () => {
  it("dayList : n jours finissant à end, du plus ancien au plus récent", () => {
    expect(dayList(3, "2026-09-13")).toEqual(["2026-09-11", "2026-09-12", "2026-09-13"]);
  });
  it("median : impair, pair, vide", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("pct1 : une décimale, null sans dénominateur", () => {
    expect(pct1(1, 3)).toBe(33.3);
    expect(pct1(5, 0)).toBeNull();
  });
});

describe("roundedShares", () => {
  it("les parts arrondies somment à 100, la dernière non nulle absorbe l'écart", () => {
    const s = roundedShares({ a: 1, b: 1, c: 1 }, ["a", "b", "c"]);
    expect(s).toEqual({ a: 33, b: 33, c: 34 });
    expect(s.a + s.b + s.c).toBe(100);
  });
  it("total nul → 0 partout ; clés absentes = 0", () => {
    expect(roundedShares({}, ["a", "b"])).toEqual({ a: 0, b: 0 });
    expect(roundedShares({ a: 5 }, ["a", "b"])).toEqual({ a: 100, b: 0 });
  });
});

describe("weeklyActiveSeries", () => {
  const starts = ["2026-08-24", "2026-08-31"];
  it("agrège actifs/engagés par fin de semaine et bâtit le layer cake par mois d'arrivée", () => {
    const r = weeklyActiveSeries(
      [
        { week_end: "2026-08-30", cohort_month: "2026-07-01", active: 2, engaged: 1 },
        { week_end: "2026-08-30", cohort_month: "2026-08-01", active: 3, engaged: 2 },
        { week_end: "2026-09-06", cohort_month: "2026-08-01", active: 4, engaged: 4 },
      ],
      starts,
    );
    expect(r.weekEnds).toEqual(["2026-08-30", "2026-09-06"]);
    expect(r.activeSeries).toEqual([5, 4]);
    expect(r.engagedByWeek.get("2026-08-30")).toBe(3);
    expect(r.cakeKeys).toEqual(["2026-07", "2026-08"]);
    expect(r.olderKey).toBeNull();
    expect(r.cake[0]).toEqual({
      label: "24/08",
      weekEnd: "2026-08-30",
      "2026-07": 2,
      "2026-08": 3,
    });
    expect(r.cake[1]).toEqual({
      label: "31/08",
      weekEnd: "2026-09-06",
      "2026-07": 0,
      "2026-08": 4,
    });
  });

  it("au-delà de 5 mois d'arrivée, les plus anciens sont regroupés sous le 5e plus ancien", () => {
    const months = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
    const r = weeklyActiveSeries(
      months.map((m) => ({
        week_end: "2026-08-30",
        cohort_month: `${m}-01`,
        active: 1,
        engaged: 0,
      })),
      ["2026-08-24"],
    );
    expect(r.olderKey).toBe("2026-03");
    expect(r.cakeKeys).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    expect(r.cake[0]["2026-03"]).toBe(2); // février + mars
  });
});

describe("weeklyRecipesSeries", () => {
  it("total par semaine et mix des méthodes en parts arrondies", () => {
    const r = weeklyRecipesSeries(
      [
        { week_start: "2026-08-24T00:00:00", source: "url", recipes: 2 },
        { week_start: "2026-08-24", source: "manual", recipes: 1 },
      ],
      ["2026-08-24", "2026-08-31"],
      ["url", "manual"],
    );
    expect(r.recipesByWeek.get("2026-08-24")).toBe(3);
    expect(r.methodMix[0]).toEqual({ label: "24/08", total: 3, url: 67, manual: 33 });
    expect(r.methodMix[1]).toEqual({ label: "31/08", total: 0, url: 0, manual: 0 });
  });
});

describe("hotIndicator", () => {
  // Compteur quotidien : 10 tous les jours sauf les 7 derniers à 20.
  const end = "2026-09-12";
  const get = (d: string) => (d > "2026-09-05" ? 20 : 10);

  it("valeur = total des 7 derniers jours, repère = médiane des 3 fenêtres précédentes, tendance", () => {
    const h = hotIndicator("x", "X", get, end);
    expect(h.value).toBe(140);
    expect(h.ref).toBe(70);
    expect(h.trend).toBe("up");
    expect(h.window).toEqual({ from: "2026-09-06", to: end });
    expect(h.bars).toHaveLength(14);
    expect(h.bars.at(-1)?.day).toBe(end);
    expect(h.bars.slice(-7).map((b) => b.value)).toEqual([20, 20, 20, 20, 20, 20, 20]);
    expect(h.bars.slice(-7).every((b) => b.inWindow)).toBe(true);
    expect(h.bars[0].inWindow).toBe(false);
    // Repère de barre = médiane du même jour de semaine sur les 4 semaines précédentes.
    expect(h.bars.at(-1)?.ref).toBe(10);
  });

  it("mode moyenne (7 jours) et tendance plate", () => {
    const h = hotIndicator("a", "A", () => 3, end, { avg: true, unit: "/j" });
    expect(h.value).toBe(3);
    expect(h.ref).toBe(3);
    expect(h.trend).toBe("flat");
    expect(h.unit).toBe("/j");
  });

  it("jour en cours : 15ᵉ barre partielle, hors valeur et hors fenêtre", () => {
    const h = hotIndicator("x", "X", get, end, { today: "2026-09-13" });
    expect(h.value).toBe(140); // la journée en cours ne gonfle pas le total
    expect(h.window).toEqual({ from: "2026-09-06", to: end });
    expect(h.bars).toHaveLength(15);
    expect(h.bars.at(-1)).toMatchObject({
      day: "2026-09-13",
      value: 20,
      partial: true,
      inWindow: false,
    });
  });

  it("source en retard : barres absentes (null) et fenêtre recalée sur le dernier jour livré", () => {
    const h = hotIndicator("dl", "DL", get, end, {
      today: "2026-09-13",
      lastKnownDay: "2026-09-09",
    });
    expect(h.window).toEqual({ from: "2026-09-03", to: "2026-09-09" });
    expect(h.value).toBe(110); // 4 jours à 20 + 3 à 10 — 7 jours pleins, comparables
    expect(h.ref).toBe(70);
    expect(h.trend).toBe("up");
    expect(h.bars.filter((b) => b.value == null).map((b) => b.day)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("aucune donnée : valeur nulle, toutes les barres grises", () => {
    const h = hotIndicator("dl", "DL", get, end, { today: "2026-09-13", lastKnownDay: null });
    expect(h.value).toBeNull();
    expect(h.ref).toBeNull();
    expect(h.trend).toBeNull();
    expect(h.window).toBeNull();
    expect(h.bars.every((b) => b.value === null && !b.inWindow)).toBe(true);
  });
});
