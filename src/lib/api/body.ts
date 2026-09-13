import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getT } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";

type ParseOptions<T> = {
  /** Message pour un corps illisible (400) ; défaut `t.api.invalidData`. */
  unreadableMessage?: (t: Dictionary) => string;
  /** Message pour un corps invalide (422) ; défaut = premier message zod. */
  invalidMessage?: (t: Dictionary, issue: string) => string;
  /** Statut d'un corps invalide — 422 par défaut ; 400 pour les routes qui l'exposent déjà. */
  invalidStatus?: 400 | 422;
  /** Prépare le corps brut avant validation (ex. extraire `body.code`). */
  pick?: (body: unknown) => unknown;
  /** Dictionnaire déjà résolu par l'appelant (évite un second getT). */
  t?: Dictionary;
  /** Type du schéma, inféré. */
  schema: ZodType<T>;
};

/**
 * Lit et valide le corps JSON d'une requête (revue 2026-09-12 : 6 copies du
 * `try { json } catch { 400 }`, et deux routes qui répondaient 500 sur un JSON
 * invalide). Contrat : 400 corps illisible, 422 (ou `invalidStatus`) corps
 * invalide, sinon `{ data }`. Les messages sont localisés.
 */
export async function parseJsonBody<T>(
  request: Request,
  options: ParseOptions<T>,
): Promise<{ data: T } | NextResponse> {
  const t = options.t ?? (await getT());
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    const message = options.unreadableMessage?.(t) ?? t.api.invalidData;
    return NextResponse.json({ error: message, code: "INVALID_JSON" }, { status: 400 });
  }
  const candidate = options.pick ? options.pick(raw) : raw;
  const result = options.schema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0]?.message ?? t.api.invalidData;
    const message = options.invalidMessage?.(t, issue) ?? issue;
    return NextResponse.json(
      { error: message, code: "INVALID_DATA" },
      { status: options.invalidStatus ?? 422 },
    );
  }
  return { data: result.data };
}
