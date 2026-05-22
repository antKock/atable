import { describe, it, expect } from "vitest";
import { HouseholdCreateSchema, JoinCodeSchema } from "./household";

describe("HouseholdCreateSchema", () => {
  it("accepts a normal name", () => {
    expect(HouseholdCreateSchema.safeParse("Chez nous").success).toBe(true);
  });

  it("accepts a 1-char and a 50-char name", () => {
    expect(HouseholdCreateSchema.safeParse("a").success).toBe(true);
    expect(HouseholdCreateSchema.safeParse("x".repeat(50)).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(HouseholdCreateSchema.safeParse("").success).toBe(false);
  });

  it("rejects a name longer than 50 chars", () => {
    expect(HouseholdCreateSchema.safeParse("x".repeat(51)).success).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(HouseholdCreateSchema.safeParse(42).success).toBe(false);
  });
});

describe("JoinCodeSchema", () => {
  it("accepts well-formed codes", () => {
    expect(JoinCodeSchema.safeParse("OLIVE-4821").success).toBe(true);
    expect(JoinCodeSchema.safeParse("THYME-0421").success).toBe(true);
  });

  it("rejects lowercase letters", () => {
    expect(JoinCodeSchema.safeParse("olive-4821").success).toBe(false);
  });

  it("rejects a missing dash", () => {
    expect(JoinCodeSchema.safeParse("OLIVE4821").success).toBe(false);
  });

  it("rejects the wrong number of digits", () => {
    expect(JoinCodeSchema.safeParse("OLIVE-482").success).toBe(false);
    expect(JoinCodeSchema.safeParse("OLIVE-48210").success).toBe(false);
  });

  it("rejects digits in the prefix", () => {
    expect(JoinCodeSchema.safeParse("OL1VE-4821").success).toBe(false);
  });

  it("rejects a missing prefix", () => {
    expect(JoinCodeSchema.safeParse("-4821").success).toBe(false);
  });
});
