// Stockage PRIVÉ des envois d'import gardés 30 jours
// (docs/specs/ocr-appareil/01-conservation-imports.md).
//
// Jamais le bucket des photos de recettes, qui est public (objets en ACL
// `public-read`) : un bucket OVH dédié, objets sans ACL (privés par défaut),
// lus seulement par les scripts d'admin (scripts/import-samples/).
//
// Deux pilotes, comme src/lib/storage/photos.ts :
//   - S3 (OVH Object Storage) dès que `IMPORT_POOL_BUCKET` est posé (mêmes
//     endpoint et identifiants que les photos) ;
//   - Supabase Storage sinon (harnais local / E2E) : bucket privé `import-pool`,
//     créé à la première écriture.

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

type Env = { [key: string]: string | undefined };

export type PoolStore = {
  put(path: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Supprime des objets ; les chemins inexistants sont ignorés. */
  remove(paths: string[]): Promise<void>;
  get(path: string): Promise<Uint8Array>;
};

const LOCAL_BUCKET = "import-pool";

/** Interrupteur de mise en service (IMPORT_POOL_ENABLED=1). */
export function isImportPoolEnabled(env: Env = process.env): boolean {
  const v = env.IMPORT_POOL_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function importPoolStorageConfig(env: Env = process.env) {
  if (!env.IMPORT_POOL_BUCKET) return null;
  return {
    bucket: env.IMPORT_POOL_BUCKET,
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION ?? "gra",
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  };
}

let s3: S3Client | null = null;

function s3Store(config: NonNullable<ReturnType<typeof importPoolStorageConfig>>): PoolStore {
  s3 ??= new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const client = s3;
  const Bucket = config.bucket;
  return {
    async put(path, body, contentType) {
      // Pas d'ACL : l'objet reste privé (l'inverse de photos.ts).
      await client.send(
        new PutObjectCommand({ Bucket, Key: path, Body: body, ContentType: contentType }),
      );
    },
    async remove(paths) {
      if (paths.length === 0) return;
      // DeleteObjects accepte 1 000 clés par appel.
      for (let i = 0; i < paths.length; i += 1000) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: { Objects: paths.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
    },
    async get(path) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: path }));
      return new Uint8Array(await res.Body!.transformToByteArray());
    },
  };
}

let localBucketReady = false;

function supabaseStore(): PoolStore {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const bucket = client.storage.from(LOCAL_BUCKET);
  async function ensureBucket() {
    if (localBucketReady) return;
    // Idempotent : « already exists » est ignoré.
    await client.storage.createBucket(LOCAL_BUCKET, { public: false });
    localBucketReady = true;
  }
  return {
    async put(path, body, contentType) {
      await ensureBucket();
      const { error } = await bucket.upload(path, body, { upsert: true, contentType });
      if (error) throw new Error(error.message);
    },
    async remove(paths) {
      if (paths.length === 0) return;
      await bucket.remove(paths);
    },
    async get(path) {
      const { data, error } = await bucket.download(path);
      if (error || !data) throw new Error(error?.message ?? "not found");
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

export function getPoolStore(): PoolStore {
  const config = importPoolStorageConfig();
  return config ? s3Store(config) : supabaseStore();
}
