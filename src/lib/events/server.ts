import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { isProbeHeaders } from "@/lib/probe";
import { getLocale } from "@/lib/i18n/server";
import { AB_ONBOARDING_COOKIE, isOnboardingVariant } from "@/lib/ab-onboarding";
import { isAdminOwner } from "@/lib/admin/auth";
import type { OwnerContext } from "@/lib/auth/owner-context";
import type { Database } from "@/lib/db/types";
import { ANON_INTERNAL_HEADER, isUuid, type EventName, type EventProps } from "./catalog";

/**
 * Émission serveur des événements produit (#28). Même discipline que
 * trackStat : le contexte requête (en-têtes, cookies) est lu ICI, l'écriture
 * part dans `after()` hors du chemin de réponse, tout est best-effort — jamais
 * d'erreur remontée, no-op hors contexte requête (tests unitaires).
 *
 * Jamais écrit : sonde (#26), owner admin, requête sans `x-anon-id` (le proxy
 * n'est pas passé — client hors proxy, on n'invente pas d'identité).
 */

export type EventRow = Database["public"]["Tables"]["events"]["Insert"];

export type EventContext = Omit<EventRow, "name" | "props" | "source" | "at">;

const PLATFORMS = new Set(["ios", "android", "web", "unknown"]);

/**
 * Contexte photographié pour la requête courante. `null` = ne rien écrire.
 * `owner` vient de withOwnerAuth quand la route l'a ; sinon (routes publiques,
 * POST /api/events sans session) l'événement est anonyme — `anon_id` suffit,
 * la vue v_identity rattache la personne dès sa première session.
 */
export async function resolveEventContext(
  owner: OwnerContext | null | undefined,
): Promise<EventContext | null> {
  let h: Headers;
  try {
    h = await headers();
  } catch {
    return null;
  }
  if (isProbeHeaders(h)) return null;
  const anonId = h.get(ANON_INTERNAL_HEADER);
  if (!isUuid(anonId)) return null;
  if (owner && isAdminOwner(owner)) return null;

  const cookieStore = await cookies();
  const variantRaw = cookieStore.get(AB_ONBOARDING_COOKIE)?.value;
  const platform = owner?.platform && PLATFORMS.has(owner.platform) ? owner.platform : "unknown";

  return {
    anon_id: anonId,
    owner_id: owner?.ownerId ?? null,
    device_id: owner?.sessionId ?? null,
    household_id: owner?.memberships[0]?.householdId ?? null,
    platform,
    app_version: null,
    locale: await getLocale(),
    variant: isOnboardingVariant(variantRaw) ? variantRaw : null,
    is_demo: owner?.memberships.some((m) => m.isDemo) ?? false,
  };
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await createServerClient().from("events").insert(rows);
  if (error) console.error("[events] insert failed:", error.message);
}

/**
 * Un événement serveur. `ctx.owner` = contexte de withOwnerAuth si la route
 * l'a. À ATTENDRE pendant le cycle de la requête : le contexte (en-têtes,
 * cookies, langue) est capturé ici — Next interdit `cookies()` dans `after()`,
 * et une continuation non attendue peut y glisser. Seule l'insertion part
 * dans `after()`, hors du chemin de réponse.
 */
export async function trackEvent<N extends EventName>(
  name: N,
  props: EventProps[N],
  ctx: { owner?: OwnerContext | null } = {},
): Promise<void> {
  let context: EventContext | null;
  try {
    context = await resolveEventContext(ctx.owner);
  } catch {
    return; // hors contexte requête (tests unitaires) — no-op
  }
  if (!context) return;
  const at = new Date().toISOString();
  const row: EventRow = { ...context, at, source: "server", name, props };
  try {
    after(async () => {
      try {
        await insertEvents([row]);
      } catch {
        // Best-effort.
      }
    });
  } catch {
    // after() hors contexte requête — no-op.
  }
}
