// Socle des scripts d'exploitation des envois d'import gardés 30 jours
// (docs/specs/ocr-appareil/01-conservation-imports.md) : lecture de la base
// (PostgREST, tunnel SSH pour prod/staging — scripts/vps/tunnel.sh) et du
// bucket privé (S3 OVH ; Supabase Storage local pour `local`).
//
// LECTURE SEULE sur prod/staging. Les copies locales vont dans
// scripts/bench/fixtures/import-samples/<env>/ (hors git) et suivent la même
// règle que le serveur : supprimées une fois l'échantillon expiré (purgeLocal).
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { loadEnvLocal, ENV_FILES } from "../lib/env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "../..");
export const OUT_ROOT = path.join(REPO, "scripts/bench/fixtures/import-samples");

export function target(envName) {
  if (!["prod", "staging", "local"].includes(envName)) {
    throw new Error(`cible inconnue « ${envName} » (prod | staging | local)`);
  }
  const env = loadEnvLocal(path.join(REPO, ENV_FILES[envName]));
  const restUrl =
    envName === "local"
      ? `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
      : (env.DATABASE_REST_URL ?? "").replace(/\/$/, "");
  const restKey = envName === "local" ? env.SUPABASE_SERVICE_ROLE_KEY : env.DATABASE_REST_KEY;
  if (!restUrl || !restKey) throw new Error(`base ${envName} non configurée`);

  async function rest(query) {
    let res;
    try {
      res = await fetch(`${restUrl}/${query}`, {
        headers: { apikey: restKey, Authorization: `Bearer ${restKey}` },
      });
    } catch (err) {
      throw new Error(
        `base ${envName} injoignable (${err.cause?.code ?? err.message}) — tunnel ouvert ? scripts/vps/tunnel.sh`,
      );
    }
    if (!res.ok) throw new Error(`${query} → ${res.status} ${await res.text()}`);
    return res.json();
  }

  async function getFile(key) {
    if (envName === "local") {
      const res = await fetch(
        `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/import-pool/${key}`,
        {
          headers: { apikey: restKey, Authorization: `Bearer ${restKey}` },
        },
      );
      if (!res.ok) throw new Error(`${key} → ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    }
    if (!env.IMPORT_POOL_BUCKET)
      throw new Error(`IMPORT_POOL_BUCKET absent de ${ENV_FILES[envName]}`);
    const s3 = new S3Client({
      region: env.S3_REGION ?? "gra",
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    const res = await s3.send(new GetObjectCommand({ Bucket: env.IMPORT_POOL_BUCKET, Key: key }));
    return new Uint8Array(await res.Body.transformToByteArray());
  }

  return { name: envName, env, rest, getFile, outDir: path.join(OUT_ROOT, envName) };
}

/** Supprime les copies locales d'échantillons expirés (même règle que le serveur). */
export async function purgeLocal(outDir, now = new Date()) {
  let removed = 0;
  let entries = [];
  try {
    entries = await readdir(outDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const meta = JSON.parse(await readFile(path.join(outDir, e.name, "sample.json"), "utf8"));
      if (new Date(meta.expires_at) <= now) {
        await rm(path.join(outDir, e.name), { recursive: true, force: true });
        removed++;
      }
    } catch {
      /* dossier incomplet : laissé tel quel */
    }
  }
  return removed;
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export function parseArgs(argv = process.argv.slice(2)) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flags = Object.fromEntries(
    argv
      .filter((a) => a.startsWith("--"))
      .map((a) => a.slice(2).split("="))
      .map(([k, v]) => [k, v ?? true]),
  );
  return { positional, flags };
}
