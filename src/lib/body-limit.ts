import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { Dictionary } from "@/lib/i18n/types";
import { getT } from "@/lib/i18n/server";

/**
 * Plafond de taille du corps des requêtes API.
 *
 * Vercel coupait tout corps > 4,5 Mo avant même d'atteindre la fonction.
 * Derrière Traefik (docs/infra/migration-vps-ovh.md) il n'y a plus de plafond
 * : les routes qui bufferisent le corps (`request.json()`, `formData()`) le
 * lisaient en entier AVANT de vérifier la taille du fichier — un client
 * malveillant pouvait faire avaler des Go au conteneur.
 *
 * Le contrôle repose sur `content-length` : c'est ce que les navigateurs, les
 * WebViews Capacitor et `curl` envoient pour un corps connu, et Traefik le
 * transmet tel quel. Un corps sans `content-length` (transfert `chunked`) est
 * LAISSÉ PASSER : on ne peut pas le juger sans le lire, et le refuser
 * casserait des clients légitimes. Si ce cas devient une voie d'abus, la
 * parade est côté proxy (Traefik middleware `buffering.maxRequestBodyBytes`).
 *
 * Chaque refus remonte dans Sentry (niveau warning, regroupé par route) pour
 * suivre si quelqu'un tente de dépasser : un pic = abus ou client cassé.
 *
 * @returns une réponse 413 si le corps annoncé dépasse `maxBytes`, sinon null.
 */
export async function rejectOversizedBody(
  request: Request,
  maxBytes: number,
  t?: Dictionary,
): Promise<NextResponse | null> {
  const declared = declaredBodyLength(request);
  if (declared === null || declared <= maxBytes) return null;
  const route = new URL(request.url).pathname;
  Sentry.captureMessage("Body too large (413)", {
    level: "warning",
    fingerprint: ["body-too-large", route],
    tags: { route },
    extra: { declaredBytes: declared, maxBytes, method: request.method },
  });
  const dict = t ?? (await getT());
  return NextResponse.json(
    { error: dict.api.bodyTooLarge, code: "BODY_TOO_LARGE", maxBytes },
    { status: 413 },
  );
}

/** `content-length` numérique, ou null si absent/illisible (chunked). */
export function declaredBodyLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Plafond par défaut des routes JSON à contexte owner (withOwnerAuth). */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 Mo
