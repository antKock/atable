#!/usr/bin/env node
// Exécute une requête SQL en LECTURE sur le journal des événements d'un env du
// VPS (#28, spec §8.1) — par ssh, comme scripts/vps/migrate.mjs. Sert les
// questions ad hoc : « une question nouvelle = une requête ». Les requêtes
// récurrentes sont dans ./queries/*.sql.
//
//   node scripts/events/query.mjs prod queries/last-screen-before-churn.sql
//   node scripts/events/query.mjs staging "select count(*) from events"
//   node scripts/events/query.mjs local queries/import-outcomes.sql   (harnais E2E)
//
// Transaction en lecture seule : impossible d'écrire par mégarde.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SSH_HOST = "mijote-vps";
// Noms des services Dokploy (préfixes des conteneurs) — mêmes valeurs que migrate.mjs.
const DATABASES = { staging: "mijote-staging-db-iglfwv", prod: "mijote-prod-db-s9yapl" };
const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_PSQL = process.env.PSQL ?? "/opt/homebrew/opt/libpq/bin/psql";

const [env, source] = process.argv.slice(2);
if (!env || !source || !["staging", "prod", "local"].includes(env)) {
  console.error("usage : node scripts/events/query.mjs staging|prod|local <fichier.sql | requête>");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [resolve(source), join(here, source), join(here, "queries", source)];
const file = candidates.find((p) => p.endsWith(".sql") && existsSync(p));
const body = file ? readFileSync(file, "utf8") : source;
const sql = `BEGIN READ ONLY;\n${body}\n;ROLLBACK;`;

let r;
if (env === "local") {
  r = spawnSync(LOCAL_PSQL, [LOCAL_URL, "-X", "-q", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
} else {
  const inner = `sudo docker exec -i $(sudo docker ps -q -f name=${DATABASES[env]} | head -1) psql -X -q -v ON_ERROR_STOP=1 -U mijote -d mijote`;
  r = spawnSync("ssh", [SSH_HOST, inner], { input: sql, encoding: "utf8" });
}
process.stdout.write(r.stdout ?? "");
if (r.status !== 0) {
  process.stderr.write(r.stderr ?? "");
  process.exit(r.status ?? 1);
}
