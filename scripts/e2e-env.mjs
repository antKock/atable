// Chargeur de .env.test.local partagé par les scripts E2E (seed, setup).
// Volontairement sans dépendance : parse KEY=VALUE, ignore commentaires/vides.
import fs from "node:fs";
import path from "node:path";

export const ENV_TEST_FILE = ".env.test.local";

// Variables de .env.local qui ne doivent JAMAIS fuiter vers un serveur Next
// lancé sur la stack locale (next dev charge .env.local, mais ne remplace pas
// une variable déjà présente dans l'environnement du process). Miroir de
// PINNED_DEFAULTS dans e2e/helpers/env.ts — garder les deux alignés.
export const PINNED_LOCAL_ONLY = {
  OPENAI_SERVICE_KEY: "sk-e2e-dummy",
  OPENAI_ADMIN_KEY: "sk-e2e-dummy",
  APIFY_TOKEN: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  CRON_SECRET: "e2e-cron-secret",
  ADMIN_HOUSEHOLD_IDS: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_AUTH_TOKEN: "",
  // Migration Supabase → VPS (2026-09-12) : PostgREST staging + S3 OVH.
  DATABASE_REST_URL: "",
  DATABASE_REST_KEY: "",
  S3_ACCESS_KEY_ID: "",
  S3_SECRET_ACCESS_KEY: "",
  S3_BUCKET: "",
  S3_ENDPOINT: "",
  S3_REGION: "",
  S3_PUBLIC_URL: "",
  // Envois d'import gardés : bucket privé OVH (jamais depuis la stack locale).
  IMPORT_POOL_BUCKET: "",
};

export function loadTestEnv(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, ENV_TEST_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${ENV_TEST_FILE} introuvable. Crée-le d'abord : cp .env.test.example ${ENV_TEST_FILE}`,
    );
  }
  const env = { ...PINNED_LOCAL_ONLY };
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}
