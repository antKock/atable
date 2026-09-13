import { describe, it, expect } from "vitest";
import { visibleTagsOrClause } from "./tags";

describe("visibleTagsOrClause", () => {
  it("globaux + foyers de l'owner", () => {
    expect(visibleTagsOrClause(["a", "b"])).toBe("household_id.is.null,household_id.in.(a,b)");
  });
  it("sans foyer : seulement les globaux, jamais `in.()`", () => {
    expect(visibleTagsOrClause([])).toBe("household_id.is.null");
  });
});
