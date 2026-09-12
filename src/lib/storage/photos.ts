// Stockage des photos de recettes (bucket public, objets immuables + cache long).
//
// Deux pilotes, choisis par l'environnement (docs/infra/migration-supabase-vps.md) :
//   - S3 (OVH Object Storage) dès que `S3_BUCKET` est posé : objets écrits en
//     ACL `public-read` (OVH n'implémente pas les bucket policies — vérifié le
//     2026-09-12), URL publique `${S3_PUBLIC_URL}/${chemin}` ;
//   - Supabase Storage sinon (repli le temps de la migration : prod tant qu'elle
//     n'est pas basculée, harnais E2E sur Supabase local).
//
// Contrat commun : chemins relatifs au bucket (`${householdId}/${recipeId}/photo.webp`,
// `generated/${recipeId}/ai-image.webp`, `copies/${recipeId}/…`). Les URLs
// stockées en base sont absolues : `photoPathFromUrl` retrouve le chemin quelle
// que soit l'origine (S3 actuel ou ancienne URL Supabase, avant backfill).

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// Forme minimale de process.env (index signature) : testable avec un objet nu.
type Env = { [key: string]: string | undefined };

export type PhotoStore = {
  /** Écrit (ou remplace) un objet public, cache 30 jours. */
  upload(path: string, body: Uint8Array | ArrayBuffer, contentType: string): Promise<void>;
  /** Copie un objet vers un nouveau chemin (même bucket). */
  copy(fromPath: string, toPath: string): Promise<void>;
  /** Supprime des objets ; les chemins inexistants sont ignorés. */
  remove(paths: string[]): Promise<void>;
  /** URL publique stable d'un chemin (sans cache-buster). */
  publicUrl(path: string): string;
};

const LEGACY_BUCKET = "recipe-photos";
// 30 jours : les images sont servies telles quelles (next/image `unoptimized`),
// on laisse navigateur et WebViews les garder.
const CACHE_CONTROL = "public, max-age=2592000";

export function photoStorageConfig(env: Env = process.env) {
  if (!env.S3_BUCKET) return null;
  return {
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION ?? "gra",
    publicUrl: (env.S3_PUBLIC_URL ?? "").replace(/\/$/, ""),
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  };
}

function toBytes(body: Uint8Array | ArrayBuffer): Uint8Array {
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

let s3: S3Client | null = null;

function s3Store(config: NonNullable<ReturnType<typeof photoStorageConfig>>): PhotoStore {
  s3 ??= new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const client = s3;
  const Bucket = config.bucket;
  return {
    async upload(path, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: path,
          Body: toBytes(body),
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
          ACL: "public-read",
        }),
      );
    },
    async copy(fromPath, toPath) {
      await client.send(
        new CopyObjectCommand({
          Bucket,
          CopySource: `/${Bucket}/${encodeURIComponent(fromPath).replace(/%2F/g, "/")}`,
          Key: toPath,
          ACL: "public-read",
          MetadataDirective: "COPY",
        }),
      );
    },
    async remove(paths) {
      if (paths.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
    publicUrl(path) {
      return `${config.publicUrl}/${path}`;
    },
  };
}

function supabaseStore(): PhotoStore {
  const bucket = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ).storage.from(LEGACY_BUCKET);
  return {
    async upload(path, body, contentType) {
      const { error } = await bucket.upload(path, toBytes(body), {
        upsert: true,
        contentType,
        cacheControl: "2592000",
      });
      if (error) throw new Error(error.message);
    },
    async copy(fromPath, toPath) {
      const { error } = await bucket.copy(fromPath, toPath);
      if (error) throw new Error(error.message);
    },
    async remove(paths) {
      if (paths.length === 0) return;
      await bucket.remove(paths);
    },
    publicUrl(path) {
      return bucket.getPublicUrl(path).data.publicUrl;
    },
  };
}

export function getPhotoStore(): PhotoStore {
  const config = photoStorageConfig();
  return config ? s3Store(config) : supabaseStore();
}

/**
 * Chemin bucket d'une URL de photo hébergée par nous, `null` pour une URL
 * externe (image importée référencée telle quelle). Le cache-buster `?v=…`
 * n'est jamais capturé : sinon copie et suppression visent une clé inexistante.
 */
export function photoPathFromUrl(url: string, env: Env = process.env): string | null {
  const base = (env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (base && url.startsWith(`${base}/`)) {
    return decodeURIComponent(url.slice(base.length + 1).split("?")[0]);
  }
  const legacy = url.match(new RegExp(`/${LEGACY_BUCKET}/([^?]+)`));
  return legacy ? decodeURIComponent(legacy[1]) : null;
}
