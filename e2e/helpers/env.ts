import fs from "node:fs";
import path from "node:path";

const ENV_TEST_FILE = ".env.test.local";

// `next dev` charge toujours .env.local (clés staging/prod réelles). Les vars
// passées au process par Playwright priment (@next/env n'écrase jamais une
// var déjà définie) — donc tout ce qui est dangereux DOIT être défini ici,
// même vide, pour ne jamais fuiter depuis .env.local vers le serveur E2E.
const PINNED_DEFAULTS: Record<string, string> = {
  OPENAI_SERVICE_KEY: "sk-e2e-dummy",
  OPENAI_ADMIN_KEY: "sk-e2e-dummy",
  APIFY_TOKEN: "",
  CRON_SECRET: "e2e-cron-secret",
  ADMIN_HOUSEHOLD_IDS: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_AUTH_TOKEN: "",
};

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SIGNING_SECRET",
  "DEMO_HOUSEHOLD_ID",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export function loadTestEnv(): Record<string, string> {
  const filePath = path.join(process.cwd(), ENV_TEST_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${ENV_TEST_FILE} introuvable — crée-le d'abord : cp .env.test.example ${ENV_TEST_FILE}`,
    );
  }

  const env: Record<string, string> = { ...PINNED_DEFAULTS };
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

  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`${ENV_TEST_FILE} incomplet — clés manquantes : ${missing.join(", ")}`);
  }
  if (!/127\.0\.0\.1|localhost/.test(env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error(
      `Refus : NEXT_PUBLIC_SUPABASE_URL (${env.NEXT_PUBLIC_SUPABASE_URL}) ne pointe pas sur un Supabase local.`,
    );
  }
  return env;
}
