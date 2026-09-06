// Socle commun des scripts Node de `scripts/` : chargement d'un fichier d'env et
// garde-fou avant d'écrire en PROD. Remplace les loaders maison copiés-collés
// (chacun avec ses écarts : commentaires non ignorés, guillemets simples non
// déquotés, regex majuscules-only…).
//
// Convention du repo (cf. verify-owner-backfill.mjs, demo-en.mjs) :
//   prod    → .env.local
//   staging → .env.staging.local
//   local   → .env.test.local (Supabase local du harnais E2E)
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

export const ENV_FILES = {
  prod: ".env.local",
  staging: ".env.staging.local",
  local: ".env.test.local",
};

/** Parse le contenu d'un fichier dotenv : ignore lignes vides et commentaires,
 *  accepte `export KEY=`, les clés avec chiffres, déquote "…" et '…'. */
export function parseEnv(text) {
  const vars = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.match(/^"(.*)"$/s) ?? value.match(/^'(.*)'$/s);
    if (quoted) value = quoted[1];
    vars[m[1]] = value;
  }
  return vars;
}

/**
 * Charge un fichier d'env (relatif au cwd ou absolu), le retourne sous forme
 * d'objet, et exporte ses variables dans process.env SANS écraser celles déjà
 * présentes (une variable posée à la main dans le shell garde la priorité).
 * Un script qui charge deux fichiers (prod + staging) doit lire les valeurs
 * dans l'objet retourné : process.env ne reflète que le premier chargé.
 */
export function loadEnvLocal(file = ".env.local") {
  const abs = path.resolve(process.cwd(), file);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    throw new Error(`fichier d'env introuvable : ${abs}`);
  }
  const vars = parseEnv(text);
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  return vars;
}

/** Vrai si le fichier d'env désigne la prod (convention : `.env.local`). */
export function isProdEnvFile(file) {
  return path.basename(file) === ENV_FILES.prod;
}

/**
 * Garde-fou avant une écriture en PROD : demande de taper `PROD` sur stdin,
 * sauf si `--yes` est passé sur la ligne de commande. No-op si la cible n'est
 * pas la prod. Critère : `envFile` (nom du fichier chargé) ou `isProd` explicite.
 *
 *   await confirmProd("restauration des seed démo", { envFile: ".env.local" });
 */
export async function confirmProd(label, { envFile, isProd, argv = process.argv } = {}) {
  const prod = isProd ?? (envFile ? isProdEnvFile(envFile) : false);
  if (!prod) return;
  if (argv.includes("--yes")) {
    console.warn(`⚠ ${label} — cible PROD (confirmation passée par --yes)`);
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve) =>
    rl.question(`⚠ ${label} — cible PROD. Tape PROD pour confirmer : `, resolve),
  );
  rl.close();
  if (answer.trim() !== "PROD") {
    console.error("abandon (rien n'a été écrit)");
    process.exit(1);
  }
}
