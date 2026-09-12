import { describe, it, expect } from "vitest";
import { ratio, pctLabel, nLabel, deltaPts } from "./ratio";

describe("ratio", () => {
  it("calcule le % et la marge de Wilson, fragile sous 20", () => {
    const r = ratio(2, 9);
    expect(r.pct).toBe(22);
    expect(r.fragile).toBe(true);
    expect(r.margin).toBeGreaterThan(20);
    expect(pctLabel(r)).toBe("22 %");
    expect(nLabel(r)).toBe("2 / 9");
  });
  it("n'est plus fragile à 20 et plus, marge plus étroite", () => {
    const r = ratio(10, 40);
    expect(r.fragile).toBe(false);
    expect(r.pct).toBe(25);
    expect(r.margin).toBeLessThan(15);
  });
  it("gère le dénominateur nul", () => {
    const r = ratio(0, 0);
    expect(r.pct).toBeNull();
    expect(pctLabel(r)).toBe("—");
    expect(deltaPts(r, ratio(1, 2))).toBeNull();
  });
  it("delta en points", () => {
    expect(deltaPts(ratio(3, 10), ratio(1, 10))).toBe(20);
  });
});
