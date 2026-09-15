import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { rejectOversizedBody } from "@/lib/body-limit";
import { insertEvents, resolveEventContext, type EventRow } from "@/lib/events/server";
import type { Json } from "@/lib/db/types";
import {
  EVENTS_BATCH_MAX,
  EVENT_CLOCK_SKEW_MS,
  EVENT_PROPS_MAX_BYTES,
  EVENT_STRING_MAX,
  isEventName,
} from "@/lib/events/catalog";

/**
 * Réception des lots d'événements client (#28, §7.2). Route PUBLIQUE (la landing
 * n'a pas de session) : le proxy injecte `x-anon-id` toujours et `x-session-id`
 * si un jeton valide existe — l'owner est alors rattaché. Répond 204 quoi qu'il
 * arrive : un lot invalide est ignoré ligne par ligne, jamais d'erreur au client.
 *
 * Validation stricte : nom dans l'allow-list du catalogue, props ≤ 1 Ko et
 * chaînes ≤ 200 caractères (un client hostile ne remplit pas la table), lot
 * ≤ 50 événements, corps ≤ 32 Ko, `at` client borné à ±10 min (sinon repli sur
 * l'heure de réception : l'ordre avec les événements serveur doit rester lisible).
 */

const MAX_BODY_BYTES = 32 * 1024;
const PLATFORMS = new Set(["ios", "android", "web"]);

type IncomingEvent = { name?: unknown; props?: unknown; at?: unknown };
type IncomingBatch = { platform?: unknown; appVersion?: unknown; events?: unknown };

type Props = { [key: string]: string | number | boolean | Record<string, string> };

function sanitizeProps(value: unknown): Props | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Props = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.length > 40) return null;
    if (typeof v === "string") {
      if (v.length > EVENT_STRING_MAX) return null;
      out[k] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.round(v);
    } else if (typeof v === "boolean") {
      out[k] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      // Un seul niveau (params des routes) : chaînes courtes uniquement.
      const nested: Record<string, string> = {};
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof nv !== "string" || nv.length > EVENT_STRING_MAX || nk.length > 40) return null;
        nested[nk] = nv;
      }
      out[k] = nested;
    } else {
      return null;
    }
  }
  return JSON.stringify(out).length > EVENT_PROPS_MAX_BYTES ? null : out;
}

export async function POST(request: NextRequest) {
  try {
    const tooLarge = await rejectOversizedBody(request, MAX_BODY_BYTES);
    if (tooLarge) return new NextResponse(null, { status: 204 });

    // Session inconnue/révoquée → null → lot anonyme. Une erreur DB ici est
    // propagée au catch : 204 aussi (le journal n'a pas de contrat d'erreur).
    const owner = await getOwnerContext();
    const context = await resolveEventContext(owner);
    if (!context) return new NextResponse(null, { status: 204 });

    const body = (await request.json().catch(() => null)) as IncomingBatch | null;
    if (!body || !Array.isArray(body.events)) return new NextResponse(null, { status: 204 });

    const platform =
      typeof body.platform === "string" && PLATFORMS.has(body.platform)
        ? body.platform
        : context.platform;
    const appVersion =
      typeof body.appVersion === "string" && body.appVersion.length <= 64 ? body.appVersion : null;

    const now = Date.now();
    const rows: EventRow[] = [];
    for (const raw of (body.events as IncomingEvent[]).slice(0, EVENTS_BATCH_MAX)) {
      if (!raw || !isEventName(raw.name)) continue;
      const props = sanitizeProps(raw.props);
      if (!props) continue;
      const atMs = typeof raw.at === "number" ? raw.at : NaN;
      const at =
        Number.isFinite(atMs) && Math.abs(atMs - now) <= EVENT_CLOCK_SKEW_MS
          ? new Date(atMs)
          : new Date(now);
      rows.push({
        ...context,
        platform,
        app_version: appVersion,
        at: at.toISOString(),
        source: "client",
        name: raw.name,
        props: props as Json,
      });
    }
    await insertEvents(rows);
  } catch (err) {
    console.error("[api/events]", err);
  }
  return new NextResponse(null, { status: 204 });
}
