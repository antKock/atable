// Conservation 30 jours des envois d'import — docs/specs/ocr-appareil/01-conservation-imports.md.
//
// Ce que la personne envoie pour importer une recette (photos, dictée, lien +
// texte de la page) est gardé avec ce que l'IA en a tiré, réussite comme
// échec, pour reproduire les erreurs et tester les imports. Refus possible
// (owners.import_pool_opt_out) : il supprime aussi ce qui a été gardé.
//
// Règles :
//   - jamais pour la démo, les sondes (#26), l'admin, ni tant que le flag
//     IMPORT_POOL_ENABLED est éteint ;
//   - rien pour un 400 de validation ni un refus de quota (rien n'a été traité) ;
//   - best-effort : l'écriture part dans after(), hors du chemin de réponse, et
//     un échec de stockage ne fait JAMAIS échouer l'import ;
//   - la réponse au client ne gagne qu'un identifiant (`sampleId`), jamais de
//     contenu ; le journal (#28) reçoit le même identifiant (`sample_id`).

import { after, NextResponse } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@/lib/supabase/server";
import { isProbeHeaders } from "@/lib/probe";
import { isAdminOwner } from "@/lib/admin/auth";
import { withApiEventExtra } from "@/lib/events/api-call";
import type { OwnerContext } from "@/lib/auth/owner-context";
import type { ImportTrace } from "@/lib/import";
import { getPoolStore, isImportPoolEnabled, type PoolStore } from "./store";

/** Garde-fou contre un abus ou un script : les échecs passent toujours. */
export const POOL_DAILY_CAP = 100;

export type ImportMethod = "photo" | "voice" | "url";
export type PoolFile = { name: string; body: Uint8Array; contentType: string };

/** Réponses où rien n'a été traité : rien à garder. */
const NOT_PROCESSED_CODES = new Set(["INVALID_DATA", "IMPORT_QUOTA"]);

/**
 * La personne a-t-elle (encore) quelque chose à refuser ? Pilote l'affichage de
 * la mention de l'écran d'import et du réglage du profil.
 */
export function importPoolState(owner: OwnerContext): { enabled: boolean; optedOut: boolean } {
  return {
    enabled: isImportPoolEnabled() && !isExcludedOwner(owner),
    optedOut: owner.importPoolOptOut ?? false,
  };
}

function isExcludedOwner(owner: OwnerContext): boolean {
  return owner.memberships.some((m) => m.isDemo) || (owner.isProbe ?? false) || isAdminOwner(owner);
}

async function isProbeRequest(): Promise<boolean> {
  try {
    return isProbeHeaders(await headers());
  } catch {
    return false; // hors contexte requête (tests unitaires)
  }
}

/**
 * À appeler par une route d'import avec sa réponse FINALE. Renvoie la réponse à
 * envoyer : la même, ou la même augmentée de `sampleId` (succès) et de
 * `sample_id` dans le journal. Les fichiers sont lus ici (pendant la requête),
 * l'écriture part dans after().
 */
export async function keepImportSample(input: {
  owner: OwnerContext;
  householdId: string;
  method: ImportMethod;
  response: NextResponse;
  files: () => Promise<PoolFile[]>;
  trace?: ImportTrace;
  url?: string;
  imageKind?: string;
}): Promise<NextResponse> {
  const { owner, response } = input;
  if (!isImportPoolEnabled() || isExcludedOwner(owner) || owner.importPoolOptOut) {
    return response;
  }
  if (await isProbeRequest()) return response;

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  const errorCode = response.status >= 400 && typeof body?.code === "string" ? body.code : null;
  if (response.status === 400 || (errorCode && NOT_PROCESSED_CODES.has(errorCode))) {
    return response;
  }

  let files: PoolFile[];
  try {
    files = await input.files();
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "import-pool" } });
    return response;
  }

  const sampleId = crypto.randomUUID();
  const ok = response.status < 300 && body !== null;
  const row = {
    id: sampleId,
    owner_id: owner.ownerId,
    household_id: input.householdId,
    method: input.method,
    files: files.map((f) => `${sampleId}/${f.name}`),
    status: response.status,
    error_code: errorCode,
    url: input.url ?? null,
    path: input.trace?.path ?? null,
    image_kind: input.imageKind ?? null,
    transcript: input.trace?.transcript ?? null,
    extracted: ok ? body : null,
    model: input.trace?.model ?? null,
  };
  const text = input.trace?.text;

  try {
    after(async () => {
      try {
        await writeSample(row, ok, files, text);
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: "import-pool" } });
      }
    });
  } catch {
    return response; // after() hors contexte requête — rien n'est gardé
  }

  const out = ok
    ? NextResponse.json(
        { ...body, sampleId },
        { status: response.status, headers: response.headers },
      )
    : response;
  return withApiEventExtra(out, { sample_id: sampleId });
}

async function writeSample(
  row: {
    id: string;
    owner_id: string;
    household_id: string;
    method: ImportMethod;
    files: string[];
    status: number;
    error_code: string | null;
    url: string | null;
    path: string | null;
    image_kind: string | null;
    transcript: string | null;
    extracted: Record<string, unknown> | null;
    model: string | null;
  },
  ok: boolean,
  files: PoolFile[],
  text: string | undefined,
): Promise<void> {
  const db = createServerClient();
  if (ok) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("import_samples")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", row.owner_id)
      .lt("status", 300)
      .gte("created_at", since);
    if ((count ?? 0) >= POOL_DAILY_CAP) return;
  }
  // Le texte passé au modèle (lien) est un fichier comme les autres.
  const all = text
    ? [
        ...files,
        {
          name: "page.txt",
          body: new TextEncoder().encode(text),
          contentType: "text/plain; charset=utf-8",
        },
      ]
    : files;
  // La ligne d'abord : si l'écriture d'un fichier échoue, la purge retrouve
  // quand même ses chemins.
  const { error } = await db.from("import_samples").insert({
    ...row,
    files: all.map((f) => `${row.id}/${f.name}`),
    extracted: row.extracted as never,
  });
  if (error) throw new Error(`import_samples insert: ${error.message}`);
  const store = getPoolStore();
  for (const f of all) await store.put(`${row.id}/${f.name}`, f.body, f.contentType);
}

// ---------- Suppression ----------

/** Filtre des échantillons à supprimer : une colonne = valeur, ou une expression `or` PostgREST. */
type SampleFilter = { column: "owner_id" | "household_id"; value: string } | { or: string };

/** Supprime les fichiers puis les lignes correspondant au filtre. Renvoie le nombre de lignes. */
async function deleteSamples(
  filter: SampleFilter,
  store: PoolStore = getPoolStore(),
): Promise<number> {
  const db = createServerClient();
  let total = 0;
  for (;;) {
    const base = db.from("import_samples").select("id, files");
    const query = "or" in filter ? base.or(filter.or) : base.eq(filter.column, filter.value);
    const { data, error } = await query.limit(500);
    if (error) throw new Error(`import_samples select: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) return total;
    await store.remove(rows.flatMap((r) => r.files));
    const { error: delError } = await db
      .from("import_samples")
      .delete()
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (delError) throw new Error(`import_samples delete: ${delError.message}`);
    total += rows.length;
    if (rows.length < 500) return total;
  }
}

/** Refus : tout ce qui a été gardé pour cette personne. */
export function deleteOwnerImportSamples(ownerId: string, store?: PoolStore): Promise<number> {
  return deleteSamples({ column: "owner_id", value: ownerId }, store);
}

/** Suppression d'un carnet : ce qui a été importé dans ce carnet. */
export function deleteHouseholdImportSamples(
  householdId: string,
  store?: PoolStore,
): Promise<number> {
  return deleteSamples({ column: "household_id", value: householdId }, store);
}

/**
 * Purge nocturne (cron demo-reset) : échantillons expirés ; orphelins (owner
 * supprimé ou fusionné — FK en SET NULL, les fichiers ne suivent pas une
 * cascade) ; et restes d'un refus dont la suppression immédiate a échoué.
 */
export async function purgeExpiredImportSamples(
  now = new Date(),
  store: PoolStore = getPoolStore(),
): Promise<number> {
  let total = await deleteSamples(
    { or: `expires_at.lt.${now.toISOString()},owner_id.is.null` },
    store,
  );
  const { data, error } = await createServerClient()
    .from("import_samples")
    .select("owner_id, owners!inner(import_pool_opt_out)")
    .eq("owners.import_pool_opt_out", true)
    .limit(1000);
  if (error) throw new Error(`import_samples opt-out scan: ${error.message}`);
  const ownerIds = [...new Set((data ?? []).map((r) => r.owner_id).filter((id) => id !== null))];
  for (const ownerId of ownerIds) total += await deleteOwnerImportSamples(ownerId, store);
  return total;
}

/** Enregistrement de la recette importée : relie l'échantillon (même owner seulement). */
export async function linkImportSampleToRecipe(
  sampleId: string,
  ownerId: string,
  recipeId: string,
): Promise<void> {
  const { error } = await createServerClient()
    .from("import_samples")
    .update({ recipe_id: recipeId })
    .eq("id", sampleId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(`import_samples link: ${error.message}`);
}
