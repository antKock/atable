import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { photoStorageConfig } from "@/lib/storage/photos";

// Sauvegardes Postgres nocturnes (Dokploy → bucket S3 `mijote-backups`,
// docs/infra/migration-supabase-vps.md). Clés de la forme
// `<service dokploy>/postgres/mijote-<env>/<horodatage>.sql.gz` ; on cherche la
// plus récente pour l'environnement courant. Même utilisateur S3 que les
// photos : aucune variable de plus, `S3_BACKUP_BUCKET` pour changer de bucket.

export type DeployEnv = "prod" | "staging";

/** Environnement de déploiement, d'après SENTRY_ENVIRONMENT (posé dans Dokploy). */
export function deployEnv(env: { [key: string]: string | undefined } = process.env): DeployEnv {
  return env.SENTRY_ENVIRONMENT === "production" ? "prod" : "staging";
}

export function latestBackupKey(
  keys: { key: string; lastModified: Date | undefined }[],
  target: DeployEnv,
): Date | null {
  const marker = `/postgres/mijote-${target}/`;
  let latest: Date | null = null;
  for (const k of keys) {
    if (!k.key.includes(marker) || !k.lastModified) continue;
    if (!latest || k.lastModified > latest) latest = k.lastModified;
  }
  return latest;
}

let client: S3Client | null = null;

/**
 * Date de la dernière sauvegarde de l'environnement courant, null si aucune ou
 * si le stockage S3 n'est pas configuré (poste, harnais E2E). Best-effort :
 * une erreur S3 est journalisée et vaut « inconnue », jamais une exception.
 */
export async function latestBackupAt(
  env: { [key: string]: string | undefined } = process.env,
): Promise<Date | null> {
  const config = photoStorageConfig(env);
  if (!config) return null;
  const bucket = env.S3_BACKUP_BUCKET ?? "mijote-backups";
  try {
    client ??= new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 }));
    return latestBackupKey(
      (res.Contents ?? []).map((o) => ({ key: o.Key ?? "", lastModified: o.LastModified })),
      deployEnv(env),
    );
  } catch (err) {
    console.error("[ops/backups] listing S3 impossible :", err);
    return null;
  }
}
