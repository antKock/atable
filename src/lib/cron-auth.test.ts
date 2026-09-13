import { describe, it, expect } from "vitest";
import { isBearerAuthorized, isCronAuthorized } from "./cron-auth";

describe("isBearerAuthorized", () => {
  it("accepte exactement `Bearer <secret>`", () => {
    expect(isBearerAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("refuse un secret différent, même de même longueur", () => {
    expect(isBearerAuthorized("Bearer s3creT", "s3cret")).toBe(false);
  });

  it("refuse un en-tête absent ou tronqué", () => {
    expect(isBearerAuthorized(null, "s3cret")).toBe(false);
    expect(isBearerAuthorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(isBearerAuthorized("s3cret", "s3cret")).toBe(false);
  });

  it("refuse TOUJOURS sans secret configuré (jamais `Bearer undefined`)", () => {
    expect(isBearerAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isBearerAuthorized("Bearer ", "")).toBe(false);
  });
});

describe("isCronAuthorized", () => {
  it("lit CRON_SECRET (posé par vitest.config)", () => {
    expect(isCronAuthorized(`Bearer ${process.env.CRON_SECRET}`)).toBe(true);
    expect(isCronAuthorized("Bearer nope")).toBe(false);
  });
});
