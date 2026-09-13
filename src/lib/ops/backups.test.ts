import { describe, expect, it } from "vitest";
import { deployEnv, latestBackupKey } from "./backups";

describe("latestBackupKey", () => {
  const keys = [
    {
      key: "svc-a/postgres/mijote-prod/2026-09-12T20-27-18.sql.gz",
      lastModified: new Date("2026-09-12T20:27:20Z"),
    },
    {
      key: "svc-a/postgres/mijote-prod/2026-09-13T02-30-00.sql.gz",
      lastModified: new Date("2026-09-13T02:30:03Z"),
    },
    {
      key: "svc-b/postgres/mijote-staging/2026-09-13T02-30-00.sql.gz",
      lastModified: new Date("2026-09-13T02:30:02Z"),
    },
  ];
  it("prend la plus récente de l'environnement demandé, ignore l'autre", () => {
    expect(latestBackupKey(keys, "prod")?.toISOString()).toBe("2026-09-13T02:30:03.000Z");
    expect(latestBackupKey(keys, "staging")?.toISOString()).toBe("2026-09-13T02:30:02.000Z");
  });
  it("null sans sauvegarde de cet environnement", () => {
    expect(latestBackupKey(keys.slice(2), "prod")).toBeNull();
    expect(latestBackupKey([], "prod")).toBeNull();
  });
});

describe("deployEnv", () => {
  it("production → prod, tout le reste → staging", () => {
    expect(deployEnv({ SENTRY_ENVIRONMENT: "production" })).toBe("prod");
    expect(deployEnv({ SENTRY_ENVIRONMENT: "staging" })).toBe("staging");
    expect(deployEnv({})).toBe("staging");
  });
});
