import { describe, it, expect } from "vitest";
import { type Person, activationFunnel, activationByFirstMethod, cohortTable, retentionCurves, rollingM1, newPeople, newPeopleWeekly, engagement, isActivated } from "./people";

const TODAY = "2026-09-12";

function person(over: Partial<Person> & { created_at: string }): Person {
  return {
    id: over.created_at + Math.random().toString(36).slice(2, 6),
    display_name: null,
    has_email: false,
    named: false,
    via_demo: false,
    first_platform: "ios",
    channel: "ios",
    carnets: 1,
    guest_of: 0,
    first_method: null,
    first_recipe_at: null,
    recipes_7d: 0,
    recipes_28d: 0,
    recipes_total: 0,
    views_28d: 0,
    views_total: 0,
    returned_7d: false,
    active_m1: false,
    active_m2: false,
    active_m3: false,
    active_28d: false,
    active_prev28: false,
    active_days_28d: 0,
    last_active_day: null,
    ...over,
  };
}

describe("activation", () => {
  it("activée = ≥ 3 recettes ET retour après J+1", () => {
    expect(isActivated(person({ created_at: "2026-08-01", recipes_7d: 3, returned_7d: true }))).toBe(true);
    expect(isActivated(person({ created_at: "2026-08-01", recipes_7d: 5, returned_7d: false }))).toBe(false);
    expect(isActivated(person({ created_at: "2026-08-01", recipes_7d: 2, returned_7d: true }))).toBe(false);
  });
  it("le parcours ne compte que les arrivées jugeables à J+7", () => {
    const people = [
      person({ created_at: "2026-08-20T10:00:00Z", recipes_7d: 3, returned_7d: true, first_recipe_at: "2026-08-20T10:05:00Z" }),
      person({ created_at: "2026-08-21T10:00:00Z", recipes_7d: 1, returned_7d: false, first_recipe_at: "2026-08-21T11:00:00Z" }),
      person({ created_at: "2026-09-10T10:00:00Z", recipes_7d: 4, returned_7d: true }), // trop récente
    ];
    const f = activationFunnel(people, { from: "2026-08-01", to: "2026-09-12" }, TODAY);
    expect(f).toMatchObject({ arrivals: 2, firstRecipe7d: 2, threeRecipes7d: 1, returned7d: 1 });
    expect(f.activated.n).toBe(1);
    expect(f.activated.total).toBe(2);
  });
  it("activation par première méthode, triée par activées puis effectif", () => {
    const people = [
      person({ created_at: "2026-08-01", first_method: "url", recipes_7d: 3, returned_7d: true }),
      person({ created_at: "2026-08-02", first_method: "url", recipes_7d: 1 }),
      person({ created_at: "2026-08-03", first_method: "photo", recipes_7d: 1 }),
      person({ created_at: "2026-08-04", first_method: null }),
    ];
    const rows = activationByFirstMethod(people, "2026-06-01", TODAY);
    expect(rows.map((r) => [r.label, r.r.n, r.r.total])).toEqual([
      ["URL", 1, 2],
      ["Photo", 0, 1],
      ["Aucune recette", 0, 1],
    ]);
  });
});

describe("rétention", () => {
  it("M1 glissante : arrivées des 4 semaines closes il y a 8 semaines", () => {
    // endSunday 2026-09-06 → fenêtre = 4 semaines se terminant 2026-07-12 : 15/06 → 12/07
    const people = [
      person({ created_at: "2026-06-20", active_m1: true }),
      person({ created_at: "2026-07-10", active_m1: false }),
      person({ created_at: "2026-07-13", active_m1: true }), // hors fenêtre
    ];
    const r = rollingM1(people, "2026-09-06");
    expect(r.window).toEqual({ from: "2026-06-15", to: "2026-07-12" });
    expect(r.r.n).toBe(1);
    expect(r.r.total).toBe(2);
  });
  it("table de cohortes : éligibilité par fenêtre de 28 jours", () => {
    const people = [
      person({ created_at: "2026-05-05", active_m1: true, active_m2: true, active_m3: false, active_28d: true }),
      person({ created_at: "2026-05-20", active_m1: false, active_m2: false, active_m3: false }),
      person({ created_at: "2026-08-01", active_m1: true }), // M1 = J+28→J+55 = 29/08 → 25/09 : pas encore
      person({ created_at: "2026-07-01", active_m1: true }), // M1 = 29/07 → 25/08 : passée ; M2 = 26/08 → 22/09 : pas encore
    ];
    const rows = cohortTable(people, TODAY);
    expect(rows.map((r) => r.month)).toEqual(["2026-05", "2026-07", "2026-08"]);
    const may = rows[0];
    expect(may.n).toBe(2);
    expect(may.m1).toMatchObject({ state: "done", eligible: 2 });
    expect(may.m1.r.n).toBe(1);
    expect(may.m3.state).toBe("done"); // 20/05 + 111 = 08/09 < 12/09
    expect(may.activeNow).toBe(1);
    const jul = rows[1];
    expect(jul.m1).toMatchObject({ state: "done" });
    expect(jul.m2.state).toBe("pending");
    expect(jul.m2.pendingFrom).toBe("2026-09-23");
    expect(rows[2].m1.state).toBe("pending");
  });
  it("courbes : cohortes ≥ 5 personnes avec M1 jugeable", () => {
    const people = Array.from({ length: 6 }, (_, i) => person({ created_at: `2026-05-0${i + 1}`, active_m1: i < 3, active_m2: i < 1 }));
    const rows = cohortTable(people, TODAY);
    const curves = retentionCurves(rows);
    expect(curves).toHaveLength(1);
    expect(curves[0].points).toEqual([100, 50, 17, 0]);
  });
});

describe("acquisition & engagement", () => {
  it("nouvelles personnes par canal et par semaine", () => {
    const people = [
      person({ created_at: "2026-09-01", channel: "ios" }),
      person({ created_at: "2026-09-02", channel: "web" }),
      person({ created_at: "2026-08-01", channel: "invite" }),
    ];
    expect(newPeople(people, { from: "2026-08-31", to: "2026-09-06" })).toEqual({ ios: 1, android: 0, web: 1, invite: 0, total: 2 });
    const weekly = newPeopleWeekly(people, "2026-09-06", 2);
    expect(weekly.map((w) => [w.label, w.total])).toEqual([["24/08", 0], ["31/08", 2]]);
  });
  it("engagement : distribution, engagés, à rattraper", () => {
    const people = [
      person({ created_at: "2026-06-01", active_28d: true, recipes_28d: 0, views_28d: 2 }),
      person({ created_at: "2026-06-02", active_28d: true, recipes_28d: 7 }),
      person({ created_at: "2026-06-03", active_28d: true, recipes_28d: 25, has_email: true }),
      person({ created_at: "2026-06-04", active_28d: false, active_prev28: true, recipes_total: 9, has_email: true }),
      person({ created_at: "2026-06-05", active_28d: false, active_prev28: false }),
    ];
    const e = engagement(people);
    expect(e.active28).toBe(3);
    expect(e.engaged28).toBe(3);
    expect(e.viewers28).toBe(1);
    expect(e.adders28).toBe(2);
    expect(e.distribution.map((d) => d.value)).toEqual([1, 0, 1, 1]);
    expect(e.recipesPerActive).toBe(10.7);
    expect(e.leaving).toHaveLength(1);
    expect(e.activeWithoutEmail).toBe(2);
  });
});
