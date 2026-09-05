import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { trackStat } from "@/lib/admin/track-stat";
import {
  getOwnerContext,
  memberHouseholdIds,
  type OwnerContext,
} from "@/lib/auth/owner-context";
import { getT } from "@/lib/i18n/server";

/**
 * Guard des routes API à contexte owner (chantier foyer #14 + #15) : résout la
 * session via getOwnerContext (401 si inconnue/révoquée) et transforme toute
 * erreur non attrapée en 500 générique loggé + Sentry. Unique guard des routes
 * household-scopées depuis le décommissionnement du hid (Lot 4).
 */
export function withOwnerAuth<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C, owner: OwnerContext) => Promise<Res>,
) {
  // `context` optionnel dans la signature retournée : les tests appellent les
  // handlers sans params avec un seul argument ; Next passe toujours les deux.
  return async (request: Req, context?: C): Promise<Res | NextResponse> => {
    try {
      // Dans le try : une erreur de résolution (DB indisponible) doit donner
      // un 500 capturé, PAS un 401 — un 401 déclencherait la purge du cookie
      // côté client alors que la session est probablement valide.
      const owner = await getOwnerContext();
      if (!owner) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
export function requireMember(
  owner: OwnerContext,
  householdId: string,
): NextResponse | null {
  const membership = owner.memberships.find((m) => m.householdId === householdId);
  if (!membership || membership.role !== "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { householdId: requested };
  }
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
