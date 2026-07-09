#!/usr/bin/env node
// Vérifie le backfill de la migration 027 (owners/memberships — Lot 0 foyer).
// À lancer juste après `supabase db push` sur chaque env, AVANT de considérer
// la migration appliquée. Imprime PASS/FAIL par invariant, exit 1 si un FAIL.
//
// Usage : node scripts/verify-owner-backfill.mjs <prod|staging|local>
//   prod    → .env.local
//   staging → .env.staging.local
//   local   → .env.test.local (Supabase local du harnais E2E)
//
// NB : les invariants 2 et 3 sont des invariants d'instant post-backfill — la
// vie normale du nouveau code les fait dériver (leave garde l'owner, delete
// foyer garde les owners des autres appareils). Un FAIL n'est significatif
// qu'au moment de l'application de la migration.

import { readFileSync } from "fs";
import { resolve } from "path";

const ENV_FILES = {
  prod: ".env.local",
  staging: ".env.staging.local",
  local: ".env.test.local",
};

const target = process.argv[2];
if (!ENV_FILES[target]) {
  console.error("Usage : node scripts/verify-owner-backfill.mjs <prod|staging|local>");
  process.exit(1);
}

function loadEnv(file) {
  const path = resolve(process.cwd(), file);
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

const env = loadEnv(ENV_FILES[target]);
const URL_ = env["NEXT_PUBLIC_SUPABASE_URL"];
const KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
if (!URL_ || !KEY) {
  console.error(`URL ou service key manquante dans ${ENV_FILES[target]}`);
  process.exit(1);
}

const HEADERS = { apikey: KEY, authorization: `Bearer ${KEY}` };

async function count(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${URL_}/rest/v1/${path}${sep}select=id`, {
    headers: { ...HEADERS, prefer: "count=exact", range: "0-0" },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return Number(res.headers.get("content-range").split("/")[1]);
}

async function fetchAll(path) {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { ...HEADERS, range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

let failures = 0;
function report(ok, label, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

console.log(`Cible : ${target} (${URL_})\n`);

// 1. Toute session a un owner
const sessionsTotal = await count("device_sessions");
const sessionsWithOwner = await count("device_sessions?owner_id=not.is.null");
report(
  sessionsTotal === sessionsWithOwner,
  `sessions avec owner_id : ${sessionsWithOwner}/${sessionsTotal}`,
  `${sessionsTotal - sessionsWithOwner} session(s) sans owner`
);

// 2. Backfill 1:1 — autant d'owners que de sessions
const ownersTotal = await count("owners");
report(
  ownersTotal === sessionsTotal,
  `owners (${ownersTotal}) == device_sessions (${sessionsTotal})`,
  "dérive normale si du trafic a eu lieu depuis le backfill"
);

// 3. Chaque session non révoquée : exactement 1 membership, vers son
//    household_id legacy, rôle member
const sessions = await fetchAll(
  "device_sessions?is_revoked=eq.false&select=id,owner_id,household_id"
);
const memberships = await fetchAll(
  "memberships?select=id,owner_id,household_id,role"
);
const byOwner = new Map();
for (const m of memberships) {
  if (!byOwner.has(m.owner_id)) byOwner.set(m.owner_id, []);
  byOwner.get(m.owner_id).push(m);
}
const bad = sessions.filter((s) => {
  const ms = byOwner.get(s.owner_id) ?? [];
  return !(
    ms.length === 1 &&
    ms[0].household_id === s.household_id &&
    ms[0].role === "member"
  );
});
report(
  bad.length === 0,
  `sessions non révoquées avec exactement 1 membership member vers leur foyer legacy : ${sessions.length - bad.length}/${sessions.length}`,
  bad.slice(0, 5).map((s) => s.id).join(", ")
);

// 4. Aucun membership orphelin (owner ou household manquant)
const ownerIds = new Set((await fetchAll("owners?select=id")).map((o) => o.id));
const householdIds = new Set((await fetchAll("households?select=id")).map((h) => h.id));
const orphans = memberships.filter(
  (m) => !ownerIds.has(m.owner_id) || !householdIds.has(m.household_id)
);
report(orphans.length === 0, `memberships orphelins : ${orphans.length}`, orphans.slice(0, 5).map((m) => m.id).join(", "));

// 5. daily_activity.owner_id renseigné partout où device_id l'est
const missingActivity = await count(
  "daily_activity?device_id=not.is.null&owner_id=is.null"
);
report(
  missingActivity === 0,
  `daily_activity avec device_id mais sans owner_id : ${missingActivity}`
);

console.log(failures === 0 ? "\n✓ Backfill vérifié." : `\n✗ ${failures} invariant(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
