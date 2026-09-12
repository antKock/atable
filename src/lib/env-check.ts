import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

// Contrôle de forme des variables d'environnement au démarrage du serveur
// (instrumentation.ts → register, runtime Node uniquement). Leçon du
// 2026-09-06 : deux incidents nés de variables mal posées et SILENCIEUSES —
// `I18N_EN_ENABLED` absente (tout en FR), `DEMO_HOUSEHOLD_ID_EN=[SENSITIVE]`
// (placeholder d'un export d'hébergeur copié tel quel : démo EN en erreur, cron
// condamné). Le code retombait sur un mode dégradé sans rien dire.
//
// Politique : on RAPPORTE, on ne bloque jamais le démarrage (dev, CI, E2E
// tournent avec un environnement partiel).
//   - `error` : variable requise absente, placeholder ou de forme invalide ;
//   - `warn`  : variable optionnelle présente mais malformée, ou absente en
//     production alors que le code s'y attend (fonctionnalité éteinte en silence).
// Jamais de valeur dans les messages : le nom et la raison seulement.

export type EnvIssueLevel = "error" | "warn";

export type EnvIssue = {
  variable: string;
  level: EnvIssueLevel;
  reason: string;
};

// Forme minimale de `process.env` (index signature) : testable avec un objet nu.
type Env = { [key: string]: string | undefined };

type EnvRule = {
  name: string;
  /** Requise = son absence casse une fonctionnalité de base (session, DB, IA, démo). */
  required: boolean;
  /** Forme attendue de la valeur (déjà trimée, non vide, hors placeholder). */
  shape: z.ZodType;
  /** Libellé de la forme, pour le message. */
  expected: string;
  /** Optionnelle absente en production : conséquence à signaler (warn). */
  missingInProduction?: string;
};

// Placeholders laissés par un export d'hébergeur (`[SENSITIVE]`, `[hidden]`
// chez Dokploy) copié tel quel dans l'environnement.
const PLACEHOLDER = /^\[[^\]]*\]$/;

// `z.guid()` et non `z.uuid()` : les foyers démo ont des ids fixes hors RFC 4122
// (`…-00000000e000`, bits de version absents) que le validateur strict refuse.
const uuid = z.guid();
const commaList = (item: z.ZodType<string, string>) =>
  z
    .string()
    .transform((value) => value.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(item).min(1));
const httpUrl = z.url({ protocol: /^https?$/ });
// Interrupteur : même tolérance que readI18nFlags (casse et espaces ignorés).
const onOffFlag = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["1", "true", "0", "false"]));
const positiveInt = z.coerce.number().int().positive();
const sha256Fingerprint = z.string().regex(/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i);

const RULES: EnvRule[] = [
  // Socle : sans elles rien ne fonctionne.
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, shape: httpUrl, expected: "URL http(s)" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, shape: z.string(), expected: "clé service role" },
  {
    name: "SESSION_SIGNING_SECRET",
    required: true,
    shape: z.string().min(32),
    expected: "secret d'au moins 32 caractères",
  },
  { name: "UPSTASH_REDIS_REST_URL", required: true, shape: httpUrl, expected: "URL http(s)" },
  { name: "UPSTASH_REDIS_REST_TOKEN", required: true, shape: z.string(), expected: "jeton" },
  { name: "OPENAI_SERVICE_KEY", required: true, shape: z.string(), expected: "clé API" },
  { name: "CRON_SECRET", required: true, shape: z.string(), expected: "secret" },
  { name: "DEMO_HOUSEHOLD_ID", required: true, shape: uuid, expected: "uuid" },

  // Version EN : optionnelles pour le code (repli FR), attendues en production.
  {
    name: "DEMO_HOUSEHOLD_ID_EN",
    required: false,
    shape: uuid,
    expected: "uuid",
    missingInProduction: "les appareils anglais atterrissent sur la démo FR",
  },
  {
    name: "I18N_EN_ENABLED",
    required: false,
    shape: onOffFlag,
    expected: "1/true/0/false",
    missingInProduction: "version EN désactivée (tout en FR)",
  },
  { name: "I18N_PREVIEW_COOKIE", required: false, shape: onOffFlag, expected: "1/true/0/false" },

  // Auto-hébergement : APP_ORIGIN coupe court aux en-têtes forgeables.
  {
    name: "APP_ORIGIN",
    required: false,
    shape: httpUrl,
    expected: "URL http(s)",
    missingInProduction: "origine dérivée des en-têtes de la requête (Host forgeable — magic links)",
  },
  {
    name: "SENTRY_ENVIRONMENT",
    required: false,
    shape: z.string(),
    expected: "nom d'environnement",
    missingInProduction: "événements Sentry serveur classés « development »",
  },
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    required: false,
    shape: httpUrl,
    expected: "URL http(s)",
    missingInProduction: "aucune remontée d'erreur vers Sentry",
  },

  // Stats App Store (cron app-store-sync, backlog #19) : sans elles la route
  // répond 503 et la section 00 du dashboard reste vide. Clé de rôle Admin.
  {
    name: "APPLE_CONNECT_KEY",
    required: false,
    shape: z.string().regex(/^[A-Za-z0-9+/=]+$/),
    expected: "corps base64 de la clé .p8",
    missingInProduction: "stats App Store non synchronisées (section 00 du dashboard vide)",
  },
  { name: "APPLE_CONNECT_KEY_ID", required: false, shape: z.string().min(1), expected: "identifiant de clé" },
  { name: "APPLE_CONNECT_ISSUER_ID", required: false, shape: uuid, expected: "uuid" },
  { name: "APPLE_CONNECT_APP_ID", required: false, shape: positiveInt, expected: "id numérique de l'app" },

  // Digest hebdo du dashboard (stats v3) : sans elle la route répond 503.
  {
    name: "DIGEST_TO",
    required: false,
    shape: z.email(),
    expected: "adresse e-mail",
    missingInProduction: "pas de digest hebdo du dashboard (cron weekly-digest en 503)",
  },

  // Fonctionnalités à interrupteur : absentes = éteintes, mais jamais malformées.
  { name: "ADMIN_HOUSEHOLD_IDS", required: false, shape: commaList(uuid), expected: "liste d'uuid séparés par des virgules" },
  { name: "DEMO_SEED_MIN", required: false, shape: positiveInt, expected: "entier > 0" },
  {
    name: "RESEND_API_KEY",
    required: false,
    shape: z.string(),
    expected: "clé API",
    missingInProduction: "e-mails de récupération/fusion non envoyés (transport no-op)",
  },
  { name: "EMAIL_FROM", required: false, shape: z.string(), expected: "expéditeur" },
  { name: "BATCH_ENRICH_SECRET", required: false, shape: z.string(), expected: "secret" },
  { name: "ALLOW_BATCH_RESET", required: false, shape: z.enum(["true", "false"]), expected: "true/false" },
  {
    name: "APIFY_TOKEN",
    required: false,
    shape: z.string(),
    expected: "jeton",
    missingInProduction: "import Instagram et repli anti-blocage indisponibles",
  },
  { name: "OPENAI_ADMIN_KEY", required: false, shape: z.string(), expected: "clé admin" },
  { name: "APPLE_APP_ID", required: false, shape: z.string(), expected: "TEAMID.bundle" },
  {
    name: "ANDROID_CERT_SHA256",
    required: false,
    shape: commaList(sha256Fingerprint),
    expected: "empreintes SHA-256 (AA:BB:…) séparées par des virgules",
  },
];

function checkRule(rule: EnvRule, env: Env, production: boolean): EnvIssue | null {
  const value = env[rule.name]?.trim();
  const level: EnvIssueLevel = rule.required ? "error" : "warn";

  if (!value) {
    if (rule.required) return { variable: rule.name, level, reason: "absente ou vide" };
    if (production && rule.missingInProduction) {
      return { variable: rule.name, level, reason: `absente en production : ${rule.missingInProduction}` };
    }
    return null;
  }
  if (PLACEHOLDER.test(value)) {
    return {
      variable: rule.name,
      level,
      reason: `valeur placeholder d'un export d'hébergeur (« [SENSITIVE] », « [hidden] ») — attendu : ${rule.expected}`,
    };
  }
  if (!rule.shape.safeParse(value).success) {
    return { variable: rule.name, level, reason: `forme invalide — attendu : ${rule.expected}` };
  }
  return null;
}

/**
 * Contrôle pur : liste les problèmes de l'environnement fourni. La production
 * (`NODE_ENV=production`, conteneur Docker prod ET staging) active les warns
 * « absente en production ».
 */
export function checkEnv(env: Env): EnvIssue[] {
  const production = env.NODE_ENV === "production";
  const issues = RULES.map((rule) => checkRule(rule, env, production)).filter(
    (issue): issue is EnvIssue => issue !== null,
  );

  // Dépendance croisée : le transport e-mail JETTE à l'envoi si RESEND_API_KEY
  // est posée sans EMAIL_FROM (lib/email/send.ts) — erreur, pas simple warn.
  if (env.RESEND_API_KEY?.trim() && !env.EMAIL_FROM?.trim()) {
    issues.push({
      variable: "EMAIL_FROM",
      level: "error",
      reason: "absente alors que RESEND_API_KEY est posée : tout envoi d'e-mail échouera",
    });
  }
  return issues;
}

/**
 * Environnement d'exécution tel que le serveur le voit. Les `NEXT_PUBLIC_*`
 * sont INLINÉES au build par Next (accès littéral obligatoire) : l'image Docker
 * ne les porte pas à l'exécution, un accès dynamique `process.env[name]` les
 * verrait absentes à tort.
 */
function runtimeEnv(): Env {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

/**
 * Rapporte les problèmes, une fois, au démarrage. En production : `console.error`
 * (warn pour les `warn`) + événement Sentry par variable (fingerprint stable,
 * tag `variable`) — c'est l'alerte qui manquait le 2026-09-06. Hors production :
 * `console.warn` seulement. Ne lève jamais.
 */
export function reportEnvIssues(env: Env = runtimeEnv()): void {
  const production = env.NODE_ENV === "production";
  for (const issue of checkEnv(env)) {
    const message = `[env-check] ${issue.variable} : ${issue.reason}`;
    if (!production) {
      console.warn(message);
      continue;
    }
    if (issue.level === "error") console.error(message);
    else console.warn(message);
    Sentry.captureMessage(message, {
      level: issue.level === "error" ? "error" : "warning",
      fingerprint: ["env-check", issue.variable],
      tags: { variable: issue.variable },
    });
  }
}
