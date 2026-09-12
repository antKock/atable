import { describe, it, expect } from "vitest";
import { lastSunday, weeksEnding, isoWeekLabel, weekStart, weekStarts, addDays, daysBetween, inWindow } from "./weeks";

describe("weeks", () => {
  it("lastSunday : dimanche strictement avant aujourd'hui", () => {
    expect(lastSunday(new Date("2026-09-12T08:00:00Z"))).toBe("2026-09-06"); // samedi
    expect(lastSunday(new Date("2026-09-13T08:00:00Z"))).toBe("2026-09-06"); // dimanche → le précédent
    expect(lastSunday(new Date("2026-09-14T08:00:00Z"))).toBe("2026-09-13"); // lundi
  });
  it("weeksEnding : 4 semaines closes", () => {
    expect(weeksEnding("2026-09-06", 4)).toEqual({ from: "2026-08-10", to: "2026-09-06" });
  });
  it("isoWeekLabel / weekStart / weekStarts", () => {
    expect(isoWeekLabel("2026-09-06")).toBe("2026-W36");
    expect(isoWeekLabel("2026-01-01")).toBe("2026-W01");
    expect(weekStart("2026-09-12")).toBe("2026-09-07");
    expect(weekStarts("2026-09-06", 3)).toEqual(["2026-08-17", "2026-08-24", "2026-08-31"]);
  });
  it("addDays / daysBetween / inWindow", () => {
    expect(addDays("2026-08-31", 7)).toBe("2026-09-07");
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7);
    expect(inWindow("2026-09-06", { from: "2026-08-10", to: "2026-09-06" })).toBe(true);
    expect(inWindow("2026-09-07", { from: "2026-08-10", to: "2026-09-06" })).toBe(false);
  });
});
