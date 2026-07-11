import { describe, it, expect } from "vitest";
import {
  HouseholdCreateSchema,
  JoinCodeSchema,
  RecoveryEmailSchema,
} from "./household";

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

  it("normalizes lowercase to the canonical form", () => {
    const r = JoinCodeSchema.safeParse("olive-4821");
    expect(r.success).toBe(true);
    expect(r.success && r.data).toBe("OLIVE-4821");
  });

  it("accepts a missing dash and inserts it", () => {
    const r = JoinCodeSchema.safeParse("OLIVE4821");
    expect(r.success).toBe(true);
    expect(r.success && r.data).toBe("OLIVE-4821");
  });

  it("tolerates stray spaces and mixed case", () => {
    const r = JoinCodeSchema.safeParse("  Olive 4821 ");
    expect(r.success).toBe(true);
    expect(r.success && r.data).toBe("OLIVE-4821");
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

describe("RecoveryEmailSchema", () => {
  it("normalise trim + lowercase (colonne UNIQUE : la collision doit se voir)", () => {
    const r = RecoveryEmailSchema.safeParse("  A.Kocken@GMAIL.com ");
    expect(r.success).toBe(true);
    expect(r.success && r.data).toBe("a.kocken@gmail.com");
  });

  it("accepte une adresse déjà canonique telle quelle", () => {
    const r = RecoveryEmailSchema.safeParse("anthony@example.fr");
    expect(r.success).toBe(true);
    expect(r.success && r.data).toBe("anthony@example.fr");
  });

  it("rejette les formats invalides", () => {
    for (const bad of ["", "  ", "sans-arobase", "a@b", "a @b.fr", 42, null]) {
      expect(RecoveryEmailSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejette au-delà de 254 caractères", () => {
    const long = `${"x".repeat(250)}@ex.fr`;
    expect(RecoveryEmailSchema.safeParse(long).success).toBe(false);
  });
});
