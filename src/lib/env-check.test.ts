import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { checkEnv, reportEnvIssues, type EnvIssue } from "./env-check";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const UUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

// Environnement complet et valide (dev) : point de départ de chaque cas.
const VALID = {
  NODE_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "https://xyz.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  SESSION_SIGNING_SECRET: "x".repeat(32),
  UPSTASH_REDIS_REST_URL: "https://eu1-upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  OPENAI_SERVICE_KEY: "sk-test",
  CRON_SECRET: "cron",
  DEMO_HOUSEHOLD_ID: UUID,
};

function issueFor(issues: EnvIssue[], variable: string): EnvIssue | undefined {
  return issues.find((i) => i.variable === variable);
}

describe("checkEnv", () => {
  it("environnement valide → aucun problème", () => {
    expect(checkEnv(VALID)).toEqual([]);
  });

  it("uuid nil (seed.sql par défaut) accepté pour DEMO_HOUSEHOLD_ID", () => {
    expect(checkEnv({ ...VALID, DEMO_HOUSEHOLD_ID: "00000000-0000-0000-0000-000000000000" })).toEqual([]);
  });

  it("id fixe du foyer démo EN (hors RFC 4122) accepté — faux positif vu sur staging le 2026-09-06", () => {
    expect(checkEnv({ ...VALID, DEMO_HOUSEHOLD_ID_EN: "00000000-0000-0000-0000-00000000e000" })).toEqual([]);
  });

  it("requise absente ou vide → error", () => {
    const absent = checkEnv({ ...VALID, CRON_SECRET: undefined });
    expect(issueFor(absent, "CRON_SECRET")).toMatchObject({ level: "error", reason: "absente ou vide" });
    const empty = checkEnv({ ...VALID, OPENAI_SERVICE_KEY: "  " });
    expect(issueFor(empty, "OPENAI_SERVICE_KEY")?.level).toBe("error");
  });

  it("uuid invalide → error sur une requise, warn sur une optionnelle", () => {
    const required = checkEnv({ ...VALID, DEMO_HOUSEHOLD_ID: "pas-un-uuid" });
    expect(issueFor(required, "DEMO_HOUSEHOLD_ID")).toMatchObject({
      level: "error",
      reason: "forme invalide — attendu : uuid",
    });
    const optional = checkEnv({ ...VALID, DEMO_HOUSEHOLD_ID_EN: "pas-un-uuid" });
    expect(issueFor(optional, "DEMO_HOUSEHOLD_ID_EN")?.level).toBe("warn");
  });

  it("placeholder [SENSITIVE] / [hidden] (export Vercel/Dokploy) → signalé, sans la valeur", () => {
    const issues = checkEnv({
      ...VALID,
      DEMO_HOUSEHOLD_ID_EN: "[SENSITIVE]",
      SUPABASE_SERVICE_ROLE_KEY: "[hidden]",
    });
    expect(issueFor(issues, "DEMO_HOUSEHOLD_ID_EN")).toMatchObject({
      level: "warn",
      reason: expect.stringContaining("placeholder"),
    });
    expect(issueFor(issues, "SUPABASE_SERVICE_ROLE_KEY")?.level).toBe("error");
    expect(issues).toHaveLength(2);
  });

  it("URL invalide ou hors http(s) → signalée", () => {
    expect(issueFor(checkEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "xyz.supabase.co" }), "NEXT_PUBLIC_SUPABASE_URL")?.level).toBe("error");
    expect(issueFor(checkEnv({ ...VALID, APP_ORIGIN: "ftp://mijote.fr" }), "APP_ORIGIN")?.level).toBe("warn");
    expect(checkEnv({ ...VALID, APP_ORIGIN: "https://mijote.anthonykocken.fr" })).toEqual([]);
  });

  it("SESSION_SIGNING_SECRET trop court → error (session.ts jetterait à la première requête)", () => {
    expect(issueFor(checkEnv({ ...VALID, SESSION_SIGNING_SECRET: "court" }), "SESSION_SIGNING_SECRET")?.level).toBe("error");
  });

  it("ADMIN_HOUSEHOLD_IDS : liste d'uuid (espaces tolérés), sinon warn", () => {
    expect(checkEnv({ ...VALID, ADMIN_HOUSEHOLD_IDS: `${UUID}, ${UUID}` })).toEqual([]);
    expect(issueFor(checkEnv({ ...VALID, ADMIN_HOUSEHOLD_IDS: `${UUID},abc` }), "ADMIN_HOUSEHOLD_IDS")?.level).toBe("warn");
    expect(issueFor(checkEnv({ ...VALID, ADMIN_HOUSEHOLD_IDS: "," }), "ADMIN_HOUSEHOLD_IDS")?.level).toBe("warn");
  });

  it("flags I18N_* : 1/true/0/false insensibles à la casse, sinon warn", () => {
    expect(checkEnv({ ...VALID, I18N_EN_ENABLED: "TRUE", I18N_PREVIEW_COOKIE: " 0 " })).toEqual([]);
    expect(issueFor(checkEnv({ ...VALID, I18N_EN_ENABLED: "yes" }), "I18N_EN_ENABLED")?.level).toBe("warn");
  });

  it("DEMO_SEED_MIN : entier > 0, sinon warn", () => {
    expect(checkEnv({ ...VALID, DEMO_SEED_MIN: "30" })).toEqual([]);
    expect(issueFor(checkEnv({ ...VALID, DEMO_SEED_MIN: "0" }), "DEMO_SEED_MIN")?.level).toBe("warn");
    expect(issueFor(checkEnv({ ...VALID, DEMO_SEED_MIN: "trente" }), "DEMO_SEED_MIN")?.level).toBe("warn");
  });

  it("EMAIL_FROM absente avec RESEND_API_KEY posée → error (le transport jette)", () => {
    expect(issueFor(checkEnv({ ...VALID, RESEND_API_KEY: "re_x" }), "EMAIL_FROM")?.level).toBe("error");
    expect(checkEnv({ ...VALID, RESEND_API_KEY: "re_x", EMAIL_FROM: "Mijote <no-reply@mijote.fr>" })).toEqual([]);
  });

  it("optionnelles attendues absentes : warn en production seulement", () => {
    expect(checkEnv(VALID)).toEqual([]);
    const prod = checkEnv({ ...VALID, NODE_ENV: "production" });
    const variables = prod.map((i) => i.variable);
    expect(variables).toEqual(
      expect.arrayContaining([
        "I18N_EN_ENABLED",
        "DEMO_HOUSEHOLD_ID_EN",
        "APP_ORIGIN",
        "SENTRY_ENVIRONMENT",
        "NEXT_PUBLIC_SENTRY_DSN",
        "RESEND_API_KEY",
        "APIFY_TOKEN",
        "APPLE_CONNECT_KEY",
      ]),
    );
    expect(prod.every((i) => i.level === "warn")).toBe(true);
    expect(issueFor(prod, "I18N_EN_ENABLED")?.reason).toBe(
      "absente en production : version EN désactivée (tout en FR)",
    );
  });

  it("production complète → aucun problème", () => {
    const prod = {
      ...VALID,
      NODE_ENV: "production",
      APPLE_CONNECT_KEY_ID: "ABC123DEF4",
      APPLE_CONNECT_ISSUER_ID: UUID,
      APPLE_CONNECT_APP_ID: "6772487648",
      I18N_EN_ENABLED: "1",
      DEMO_HOUSEHOLD_ID_EN: UUID,
      APP_ORIGIN: "https://mijote.anthonykocken.fr",
      SENTRY_ENVIRONMENT: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.de.sentry.io/1",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "Mijote <no-reply@mijote.fr>",
      APIFY_TOKEN: "apify",
      APPLE_CONNECT_KEY: "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH",
    };
    expect(checkEnv(prod)).toEqual([]);
  });
});

describe("reportEnvIssues", () => {
  const captureMessage = vi.mocked(Sentry.captureMessage);

  beforeEach(() => {
    captureMessage.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hors production : console.warn seulement, rien vers Sentry", () => {
    reportEnvIssues({ ...VALID, DEMO_HOUSEHOLD_ID: "[SENSITIVE]" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[env-check] DEMO_HOUSEHOLD_ID :"));
    expect(console.error).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("production : console.error + Sentry (fingerprint et tag par variable), jamais la valeur", () => {
    reportEnvIssues({
      ...VALID,
      NODE_ENV: "production",
      DEMO_HOUSEHOLD_ID: "[SENSITIVE]",
      I18N_EN_ENABLED: "1",
      DEMO_HOUSEHOLD_ID_EN: UUID,
      APP_ORIGIN: "https://mijote.anthonykocken.fr",
      SENTRY_ENVIRONMENT: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.de.sentry.io/1",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "no-reply@mijote.fr",
      APIFY_TOKEN: "apify",
      APPLE_CONNECT_KEY: "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH",
    });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = captureMessage.mock.calls[0];
    expect(message).toContain("DEMO_HOUSEHOLD_ID");
    expect(message).not.toContain(UUID);
    expect(context).toMatchObject({
      level: "error",
      fingerprint: ["env-check", "DEMO_HOUSEHOLD_ID"],
      tags: { variable: "DEMO_HOUSEHOLD_ID" },
    });
  });

  it("production : un warn part en console.warn + Sentry niveau warning", () => {
    reportEnvIssues({
      ...VALID,
      NODE_ENV: "production",
      I18N_EN_ENABLED: "1",
      DEMO_HOUSEHOLD_ID_EN: UUID,
      APP_ORIGIN: "https://mijote.anthonykocken.fr",
      SENTRY_ENVIRONMENT: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.de.sentry.io/1",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "no-reply@mijote.fr",
      APIFY_TOKEN: "apify",
      APPLE_CONNECT_KEY: "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH",
      DEMO_SEED_MIN: "trente",
    });
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("DEMO_SEED_MIN"),
      expect.objectContaining({ level: "warning" }),
    );
  });
});
