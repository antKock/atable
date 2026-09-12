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
  /**
   * Opt-out de la garde démo par défaut (cf. table de décision ci-dessous) :
   * la route laisse écrire un owner démo. Elle porte alors SA garde fine
   * (`assertNotDemoSeedMutation` sur les routes recette) ou n'écrit rien que le
   * visiteur démo n'ait le droit d'écrire (heartbeat, « Quitter », import IA).
   * Chaque opt-out se justifie en commentaire au point d'appel.
   */
  allowDemoMutation?: boolean;
};

// Méthodes de lecture : jamais concernées par la garde démo.
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Guard des routes API à contexte owner (chantier foyer #14 + #15) : résout la
 * session via getOwnerContext (401 si inconnue/révoquée) et transforme toute
 * erreur non attrapée en 500 générique loggé + Sentry. Unique guard des routes
 * household-scopées depuis le décommissionnement du hid (Lot 4).
 * Refuse aussi (413) tout corps annoncé au-delà de `maxBodyBytes` AVANT de le
 * lire — Traefik ne plafonne pas le corps en amont.
 *
 * Garde démo PAR DÉFAUT (stratégie C « monde gelé », incidents 2026-06 et
 * 2026-09) : toute requête non-GET d'un owner démo est refusée AVANT le handler
 * (403 `t.demo.frozen` + compteur `demo_frozen_hits`), sauf `allowDemoMutation`.
 * Une route de mutation n'a plus à « penser » à la garde — l'oubli qui avait
 * laissé POST /api/tags ouvert (2026-09) n'est plus possible.
 *
 * Table de décision (routes sous withOwnerAuth) :
 *   Défaut — 403 démo (mutations structurelles : foyer, membres, tags, profil)
 *     POST /api/tags · PUT /api/households/[id] ·
 *     PATCH+DELETE /api/households/[id]/members/[ownerId] · PUT /api/owner ·
 *     PUT /api/owner/email · POST /api/owner/email/verify.
 *   Opt-out `allowDemoMutation` — le visiteur démo DOIT pouvoir écrire :
 *     POST /api/recipes/[id]/share (partager = lecture publique d'une recette
 *     déjà visible, canal d'acquisition ; mint de jeton idempotent) ·
 *     POST /api/recipes, POST /api/recipes/copy (création = recette non-seed) ·
 *     PUT+DELETE /api/recipes/[id], POST …/photo, PATCH …/move (garde fine
 *     `assertNotDemoSeedMutation` : seed intouchable, non-seed libre) ·
 *     DELETE /api/households/[id] (« Quitter » conservé ; `delete` refusé dans
 *     la route, message dédié `demoNotDeletable`) · POST /api/activity/ping
 *     (heartbeat, attribution démo du rollup 032) ·
 *     POST /api/recipes/import/{url,screenshot,voice} (extraction IA sans
 *     écriture, quota par foyer).
 *   Lecture — hors sujet : GET carousels, library, tags, recipes, recipes/[id],
 *     recipes/[id]/status.
 *
 * Limite : la garde est OWNER-level (`isDemoOwner`), elle n'inspecte pas le
 * foyer cible de la requête (qui peut venir du corps : `householdId` de
 * recipes/copy/move). C'est sans faille car un owner démo ne porte JAMAIS
 * d'autre membership que le foyer démo (owner dédié à /api/demo/session ;
 * création/rejoindre repartent d'un owner neuf pour une session démo) — donc
 * tout foyer cible qu'il pourrait viser EST le foyer démo, et
 * `resolveWriteHousehold` / `requireMember` refusent les autres. Si l'invariant
 * cassait un jour, la garde serait plus stricte (tout refusé), jamais plus lâche.
 */
export function withOwnerAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, owner: OwnerContext) => Promise<Res>,
  options: WithOwnerAuthOptions = {},
) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const allowDemoMutation = options.allowDemoMutation ?? false;
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
      if (!allowDemoMutation && !READ_METHODS.has(request.method) && isDemoOwner(owner)) {
        return await demoFrozenResponse();
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
 * LA réponse « monde gelé » : 403 localisé + compteur produit `demo_frozen_hits`
 * (dashboard v2). Un seul point d'émission, que la garde soit celle par défaut
 * de withOwnerAuth ou la garde fine des routes recette.
 */
async function demoFrozenResponse(): Promise<NextResponse> {
  trackStat("demo_frozen_hits");
  const t = await getT();
  return NextResponse.json({ error: t.demo.frozen }, { status: 403 });
}

/**
 * Garde FINE des routes recette (opt-out `allowDemoMutation`). Incident 2026-09
 * (les 30 recettes seed de la démo prod supprimées par un visiteur) : une
 * recette SEED du foyer démo est intouchable — pas d'édition, de suppression,
 * de déplacement ni de photo. Les recettes ajoutées par les visiteurs restent
 * libres (purgées par le cron). 403 « monde gelé ».
 */
export async function assertNotDemoSeedMutation(
  owner: OwnerContext,
  recipe: { household_id: string; is_seed?: boolean | null },
): Promise<NextResponse | null> {
  if (!recipe.is_seed) return null;
  const membership = owner.memberships.find((m) => m.householdId === recipe.household_id);
  if (!membership?.isDemo) return null;
  return demoFrozenResponse();
}

/**
 * Un owner « démo » = au moins un membership sur le foyer démo (stratégie C).
 * Prédicat owner-level unique, partagé par l'UI (hub gelé, profil masqué), la
 * conversion démo → owner neuf et la garde par défaut de withOwnerAuth, pour
 * ne pas réécrire la règle à chaque site.
 */
export function isDemoOwner(owner: OwnerContext): boolean {
  return owner.memberships.some((m) => m.isDemo);
}
