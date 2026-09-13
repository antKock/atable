#!/usr/bin/env node
// Applique les migrations SQL du repo aux bases Postgres du VPS (Dokploy), par ssh.
//
//   node scripts/vps/migrate.mjs staging|prod|all [--dry-run] [--only 045]
//
// Depuis le 2026-09-12 les bases vivent sur le VPS (docs/infra/migration-supabase-vps.md)
// et ne sont joignables que depuis lui : `supabase db push --linked` n'atteint plus que
// les projets Supabase, que l'app n'utilise plus. Ce script remplace `db push` :
//   - liste les fichiers `supabase/migrations/NNN_nom.sql` ;
//   - lit `supabase_migrations.schema_migrations` de chaque base cible ;
//   - applique chaque migration manquante, dans l'ordre, DANS UNE TRANSACTION avec sa
//     ligne d'historique (version, name), puis `NOTIFY pgrst` pour recharger le cache
//     de schéma de PostgREST. Une erreur SQL annule la migration et arrête le script.
// Règle inchangée : migration AVANT le code pour les ajouts, APRÈS pour les suppressions.
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SSH_HOST = "mijote-vps";
// Nom du service Dokploy (préfixe du conteneur) par environnement.
const DATABASES = {
  staging: "mijote-staging-db-iglfwv",
  prod: "mijote-prod-db-s9yapl",
};

const args = process.argv.slice(2);
const target = args[0];
const dryRun = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
if (!target || !["staging", "prod", "all"].includes(target)) {
  console.error("usage : node scripts/vps/migrate.mjs staging|prod|all [--dry-run] [--only NNN]");
  process.exit(2);
}
const envs = target === "all" ? ["staging", "prod"] : [target];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(repoRoot, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{3}_.+\.sql$/.test(f))
  .sort()
  .map((f) => ({ file: f, version: f.slice(0, 3), name: f.slice(4, -4) }));

function psql(env, sql, { quiet = true } = {}) {
  const inner = `sudo docker exec -i $(sudo docker ps -q -f name=${DATABASES[env]} | head -1) psql -v ON_ERROR_STOP=1 ${quiet ? "-q" : ""} -At -U mijote -d mijote`;
  const r = spawnSync("ssh", [SSH_HOST, inner], { input: sql, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${env}: psql a échoué\n${r.stderr}`);
  return r.stdout;
}

let failed = false;
for (const env of envs) {
  const applied = new Set(
    psql(env, "select version from supabase_migrations.schema_migrations;")
      .split("\n")
      .filter(Boolean),
  );
  const pending = files.filter((m) => !applied.has(m.version) && (!only || m.version === only));
  console.log(
    `== ${env} (${DATABASES[env]}) : ${applied.size} appliquées, ${pending.length} en attente${pending.length ? " : " + pending.map((m) => m.file).join(", ") : ""}`,
  );
  for (const m of pending) {
    if (dryRun) {
      console.log(`   [dry-run] ${m.file}`);
      continue;
    }
    const body = readFileSync(join(dir, m.file), "utf8");
    const sql = `BEGIN;\n${body}\nINSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${m.version}', '${m.name.replace(/'/g, "''")}');\nCOMMIT;\nNOTIFY pgrst, 'reload schema';\n`;
    try {
      psql(env, sql);
      console.log(`   ✓ ${m.file}`);
    } catch (err) {
      console.error(`   ✗ ${m.file}\n${err.message}`);
      failed = true;
      break;
    }
  }
}
process.exit(failed ? 1 : 0);
