import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { trackStat } from "@/lib/admin/track-stat";
import {
  getOwnerContext,
  memberHouseholdIds,
  type OwnerContext,
} from "@/lib/auth/owner-context";
import { getT } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";
import { DEFAULT_MAX_BODY_BYTES, rejectOversizedBody } from "@/lib/body-limit";

export type WithOwnerAuthOptions = {
  /**
   * Plafond du corps de requête (via `content-length`, cf. body-limit.ts).
   * 1 Mo par défaut — largement au-dessus de tout payload JSON de l'app ; les
   * routes fichier (photo, capture, voix) le relèvent explicitement.
   */
  maxBodyBytes?: number;
};

/**
 * Guard des routes API à contexte owner (chantier foyer #14 + #15) : résout la
 * session via getOwnerContext (401 si inconnue/révoquée) et transforme toute
 * erreur non attrapée en 500 générique loggé + Sentry. Unique guard des routes
 * household-scopées depuis le décommissionnement du hid (Lot 4).
 * Refuse aussi (413) tout corps annoncé au-delà de `maxBodyBytes` AVANT de le
 * lire — Vercel plafonnait à 4,5 Mo, Traefik ne plafonne rien.
 */
export function withOwnerAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, owner: OwnerContext) => Promise<Res>,
  options: WithOwnerAuthOptions = {},
) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  // `context` optionnel dans la signature retournée : les tests appellent les
  // handlers sans params avec un seul argument ; Next passe toujours les deux.
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    try {
      // Avant la session : un simple contrôle d'en-tête, pas d'accès DB.
      const tooLarge = await rejectOversizedBody(request, maxBodyBytes);
      if (tooLarge) return tooLarge;

      // Dans le try : une erreur de résolution (DB indisponible) doit donner
      // un 500 capturé, PAS un 401 — un 401 déclencherait la purge du cookie
      // côté client alors que la session est probablement valide.
      const owner = await getOwnerContext();
      if (!owner) {
        const t = await getT();
        return NextResponse.json({ error: t.api.unauthorized }, { status: 401 });
      }
      return await handler(request, context as C, owner);
    } catch (err) {
      Sentry.captureException(err);
      console.error(
        `[api] ${request.method} ${new URL(request.url).pathname}:`,
        err,
      );
      const t = await getT();
      return NextResponse.json({ error: t.api.serverError }, { status: 500 });
    }
  };
}

/**
 * 403 si l'owner n'a pas de membership `member` sur le foyer visé (les invités
 * sont en lecture seule). Posé au Lot 0, branché sur les écritures à partir du
 * Lot 3. Retourne la réponse d'erreur à renvoyer, ou null si OK.
 */
export async function requireMember(
  owner: OwnerContext,
  householdId: string,
): Promise<NextResponse | null> {
  const membership = owner.memberships.find((m) => m.householdId === householdId);
  if (!membership || membership.role !== "member") {
    return forbiddenResponse(await getT());
  }
  return null;
}

/** 403 générique localisé. Le client branche sur le statut, pas le texte. */
export function forbiddenResponse(t: Dictionary): NextResponse {
  return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
}

/**
 * Résout le foyer cible d'une ÉCRITURE multi-foyer (Lot 4). `requested` = le
 * `householdId` du payload (optionnel) :
 *   - fourni → doit être un foyer où l'owner est MEMBRE (sinon 403) ;
 *   - absent → repli sur l'unique foyer membre (compat mono-foyer). S'il y a
 *     plusieurs foyers membres et aucun choix, c'est une erreur cliente (422) :
 *     le dialog de choix aurait dû fournir le foyer.
 * Retourne `{ householdId }` OU la réponse d'erreur à renvoyer.
 */
export async function resolveWriteHousehold(
  owner: OwnerContext,
  requested?: unknown,
): Promise<{ householdId: string } | NextResponse> {
  const memberIds = memberHouseholdIds(owner);
  if (typeof requested === "string" && requested.length > 0) {
    if (!memberIds.includes(requested)) {
      return forbiddenResponse(await getT());
    }
    return { householdId: requested };
  }
  if (memberIds.length === 0) {
    return forbiddenResponse(await getT());
  }
  if (memberIds.length > 1) {
    const t = await getT();
    return NextResponse.json({ error: t.household.picker.required }, { status: 422 });
  }
  return { householdId: memberIds[0] };
}

/**
 * Stratégie C (« monde gelé ») : LE garde-fou central démo — 403 sur toute
 * mutation foyer/membership/profil visant le foyer démo. Posé au Lot 0,
 * branché sur les routes au fil des lots. Leçon de l'incident 2026-06 (démo
 * supprimée par ses visiteurs) : garde-fous serveur centralisés, pas éparpillés.
 */
export async function assertNotDemoMutation(
  owner: OwnerContext,
  householdId: string,
): Promise<NextResponse | null> {
  const membership = owner.memberships.find((m) => m.householdId === householdId);
  if (membership?.isDemo) {
    trackStat("demo_frozen_hits");
    const t = await getT();
    return NextResponse.json({ error: t.demo.frozen }, { status: 403 });
  }
  return null;
}

/**
 * Incident 2026-09 (les 30 recettes seed de la démo prod supprimées par un
 * visiteur) : une recette SEED du foyer démo est intouchable — pas d'édition,
 * de suppression, de déplacement ni de photo. Les recettes ajoutées par les
 * visiteurs restent libres (purgées par le cron). 403 « monde gelé ».
 */
export async function assertNotDemoSeedMutation(
  owner: OwnerContext,
  recipe: { household_id: string; is_seed?: boolean | null },
): Promise<NextResponse | null> {
  if (!recipe.is_seed) return null;
  const membership = owner.memberships.find((m) => m.householdId === recipe.household_id);
  if (!membership?.isDemo) return null;
  trackStat("demo_frozen_hits");
  const t = await getT();
  return NextResponse.json({ error: t.demo.frozen }, { status: 403 });
}

/**
 * Un owner « démo » = au moins un membership sur le foyer démo (stratégie C).
 * Prédicat owner-level unique, partagé par l'UI (hub gelé, profil masqué) et
 * les gardes de mutation owner-level (profil), pour ne pas réécrire la règle à
 * chaque site. `assertNotDemoOwner` en est la variante « garde de route » 403.
 */
export function isDemoOwner(owner: OwnerContext): boolean {
  return owner.memberships.some((m) => m.isDemo);
}

export async function assertNotDemoOwner(owner: OwnerContext): Promise<NextResponse | null> {
  if (isDemoOwner(owner)) {
    trackStat("demo_frozen_hits");
    const t = await getT();
    return NextResponse.json({ error: t.demo.frozen }, { status: 403 });
  }
  return null;
}
