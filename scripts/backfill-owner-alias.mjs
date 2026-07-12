#!/usr/bin/env node
// Backfill owners.alias (migration 031) : fige le surnom des owners existants.
//
// Stratégie « freeze-except-banned » : on conserve EXACTEMENT le surnom actuel
// (dérivé des ANCIENS pools 40+40) — sauf s'il contient un mot retiré lors de
// l'assainissement, auquel cas on régénère avec les NOUVEAUX pools (propres).
// Résultat : aucun utilisateur au surnom correct ne change ; seuls les surnoms
// désagréables sont remplacés, une seule fois ; tout devient statique ensuite.
//
// Usage : node scripts/backfill-owner-alias.mjs <prod|staging|local> [--dry-run]
//
// À lancer APRÈS la migration 031 (colonne créée), de préférence AVANT/AVEC le
// déploiement du code (sinon un owner non backfillé lit le repli nouveaux-pools
// = surnom changé temporairement). Idempotent : ne touche que les alias NULL.

import { readFileSync } from "fs";
import { resolve } from "path";

const ENV_FILES = { prod: ".env.local", staging: ".env.staging.local", local: ".env.test.local" };
const target = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!ENV_FILES[target]) {
  console.error("Usage : node scripts/backfill-owner-alias.mjs <prod|staging|local> [--dry-run]");
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
      }),
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

// ── Pools ─────────────────────────────────────────────────────────────────
// ANCIENS (40+40) : reproduisent le surnom ACTUEL des owners existants.
const OLD_ANIMALS = [
  "Lapin", "Renard", "Blaireau", "Héron", "Moineau", "Castor", "Hibou",
  "Écureuil", "Hérisson", "Faucon", "Loup", "Ours", "Cerf", "Chevreuil",
  "Corbeau", "Rossignol", "Pinson", "Canard", "Cygne", "Dauphin",
  "Phoque", "Manchot", "Chamois", "Bouquetin", "Lynx", "Chat", "Poney",
  "Mouton", "Bélier", "Taureau", "Marcassin", "Lézard", "Papillon",
  "Bourdon", "Grillon", "Colibri", "Flamant", "Pélican", "Goéland", "Merle",
];
const OLD_ADJECTIVES = [
  "Discret", "Curieux", "Paisible", "Attentif", "Prudent", "Songeur",
  "Serein", "Vaillant", "Modeste", "Patient", "Aimable", "Loyal", "Agile",
  "Habile", "Tranquille", "Réfléchi", "Posé", "Courtois", "Sincère",
  "Fidèle", "Tenace", "Vif", "Sage", "Calme", "Doux", "Léger", "Alerte",
  "Candide", "Placide", "Studieux", "Soigneux", "Débonnaire", "Affable",
  "Avisé", "Lucide", "Intrépide", "Gourmand", "Matinal", "Nocturne",
  "Voyageur",
];
// NOUVEAUX (33+36) : miroir de src/lib/alias.ts (mots désagréables retirés).
const NEW_ANIMALS = [
  "Lapin", "Renard", "Héron", "Moineau", "Castor", "Hibou",
  "Écureuil", "Hérisson", "Faucon", "Loup", "Ours", "Cerf", "Chevreuil",
  "Rossignol", "Pinson", "Canard", "Cygne", "Dauphin",
  "Chamois", "Lynx", "Chat", "Poney",
  "Bélier", "Taureau", "Marcassin", "Lézard", "Papillon",
  "Grillon", "Colibri", "Flamant", "Pélican", "Goéland", "Merle",
];
const NEW_ADJECTIVES = [
  "Discret", "Curieux", "Paisible", "Attentif", "Prudent", "Songeur",
  "Serein", "Vaillant", "Modeste", "Patient", "Aimable", "Loyal", "Agile",
  "Habile", "Tranquille", "Réfléchi", "Posé", "Courtois", "Sincère",
  "Fidèle", "Tenace", "Vif", "Sage", "Calme", "Doux", "Alerte",
  "Placide", "Studieux", "Soigneux",
  "Avisé", "Lucide", "Intrépide", "Gourmand", "Matinal", "Nocturne",
  "Voyageur",
];
const BANNED_ANIMALS = new Set(["Blaireau", "Phoque", "Corbeau", "Mouton", "Bourdon", "Manchot", "Bouquetin"]);
const BANNED_ADJ = new Set(["Candide", "Léger", "Débonnaire", "Affable"]);

// FNV-1a 32 bits — identique à src/lib/alias.ts.
function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function computeAlias(id, animals, adjectives) {
  const hash = fnv1a(id.toLowerCase());
  const animal = animals[hash % animals.length];
  const adjective = adjectives[Math.floor(hash / animals.length) % adjectives.length];
  return `${animal} ${adjective}`;
}
function finalAlias(id) {
  const old = computeAlias(id, OLD_ANIMALS, OLD_ADJECTIVES);
  const [animal, adjective] = old.split(" ");
  if (BANNED_ANIMALS.has(animal) || BANNED_ADJ.has(adjective)) {
    return { alias: computeAlias(id, NEW_ANIMALS, NEW_ADJECTIVES), replaced: true };
  }
  return { alias: old, replaced: false };
}

async function fetchNullAliasOwners() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_}/rest/v1/owners?alias=is.null&select=id`, {
      headers: { ...HEADERS, range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`GET owners → ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function patchAlias(id, alias) {
  const res = await fetch(`${URL_}/rest/v1/owners?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ alias }),
  });
  if (!res.ok) throw new Error(`PATCH owner ${id} → ${res.status} ${await res.text()}`);
}

const owners = await fetchNullAliasOwners();
console.log(`[${target}] ${owners.length} owner(s) sans alias à figer${dryRun ? " (DRY-RUN)" : ""}.`);
let replaced = 0;
for (const { id } of owners) {
  const { alias, replaced: wasReplaced } = finalAlias(id);
  if (wasReplaced) replaced++;
  if (!dryRun) await patchAlias(id, alias);
}
console.log(
  `[${target}] ${dryRun ? "(simulation) " : ""}fait : ${owners.length} figés, dont ${replaced} surnom(s) désagréable(s) remplacé(s).`,
);
