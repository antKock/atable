#!/usr/bin/env node
// Copie les objets du bucket Supabase Storage `recipe-photos` vers OVH Object
// Storage S3 (migration Supabase → VPS, docs/infra/migration-supabase-vps.md).
//
//   node scripts/migrate-photos-to-s3.mjs --env .env.staging.local [--dry-run] [--force]
//
// Lit dans le fichier d'env : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (source) et S3_BUCKET / S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY_ID /
// S3_SECRET_ACCESS_KEY (cible ; repli sur .env.local pour les S3_* absents).
// Idempotent : un objet déjà présent avec la même taille est sauté (--force
// pour réécrire). Les objets sont écrits en ACL public-read, Content-Type
// d'origine, Cache-Control 30 jours (même contrat que lib/storage/photos).
//
// La réécriture des URLs en base n'est PAS faite ici : un UPDATE SQL sur la
// base cible (cf. doc, section « Photos »), parce que la base du VPS n'est
// joignable que depuis le VPS.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const dryRun = flag("--dry-run");
const force = flag("--force");

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return env;
}
const env = { ...loadEnv(".env.local"), ...loadEnv(opt("--env", ".env.local")) };
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "S3_BUCKET", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
  if (!env[k]) throw new Error(`${k} manquante`);
}

const BUCKET = "recipe-photos";
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: env.S3_REGION ?? "gra",
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

// Supabase liste par « dossier » (les entrées sans id sont des préfixes) :
// parcours récursif, pages de 1000.
async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) out.push({ path, size: entry.metadata?.size ?? null, mime: entry.metadata?.mimetype ?? null });
      else out.push(...(await listAll(path)));
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function existsWithSize(key, size) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return size === null || head.ContentLength === size;
  } catch {
    return false;
  }
}

const objects = await listAll();
console.log(`${objects.length} objets dans ${BUCKET} (${env.NEXT_PUBLIC_SUPABASE_URL})`);
let copied = 0, skipped = 0, bytes = 0;
for (const obj of objects) {
  if (!force && (await existsWithSize(obj.path, obj.size))) { skipped++; continue; }
  if (dryRun) { console.log(`[dry-run] ${obj.path} (${obj.size ?? "?"} o)`); copied++; continue; }
  const { data, error } = await supabase.storage.from(BUCKET).download(obj.path);
  if (error) { console.error(`✗ ${obj.path}: ${error.message}`); continue; }
  const body = new Uint8Array(await data.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: obj.path,
    Body: body,
    ContentType: obj.mime ?? data.type ?? "application/octet-stream",
    CacheControl: "public, max-age=2592000",
    ACL: "public-read",
  }));
  copied++; bytes += body.byteLength;
  if (copied % 25 === 0) console.log(`… ${copied} copiés`);
}
console.log(`copiés: ${copied}, déjà présents: ${skipped}, ${(bytes / 1e6).toFixed(1)} Mo transférés${dryRun ? " (dry-run)" : ""}`);
