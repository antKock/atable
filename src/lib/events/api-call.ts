import { trackEvent } from "./server";
import { apiRoutePattern, EVENT_STRING_MAX } from "./catalog";
import type { OwnerContext } from "@/lib/auth/owner-context";

/**
 * En-tête INTERNE par lequel une route complète son `api.called` (identifiants
 * que seule la route connaît : `source` d'une recette créée…). Lu puis RETIRÉ
 * de la réponse avant l'envoi — jamais vu par le client.
 */
export const API_EVENT_HEADER = "x-mijote-event";
export type ApiEventExtra = {
  method_kind?: string;
  recipe_id?: string;
  household_id?: string;
  site?: string;
};

export function withApiEventExtra<R extends Response>(response: R, extra: ApiEventExtra): R {
  response.headers.set(API_EVENT_HEADER, JSON.stringify(extra));
  return response;
}

function takeExtraHeader(response: Response): ApiEventExtra {
  const raw = response.headers.get(API_EVENT_HEADER);
  if (!raw) return {};
  response.headers.delete(API_EVENT_HEADER);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: keyof ApiEventExtra) =>
      typeof parsed[k] === "string"
        ? { [k]: (parsed[k] as string).slice(0, EVENT_STRING_MAX) }
        : {};
    return {
      ...pick("method_kind"),
      ...pick("recipe_id"),
      ...pick("household_id"),
      ...pick("site"),
    };
  } catch {
    return {};
  }
}

/**
 * Flux C — `api.called` (#28) : un événement par appel de route API, avec le
 * motif de route, le statut, la durée et, en erreur, le `code` du corps JSON.
 * C'est LA seule sémantique figée à l'émission : la cause d'un échec ne se
 * reconstruit pas après coup. Branché dans withOwnerAuth ; les routes publiques
 * l'appellent via withApiEvent.
 */

// Routes sans intention (heartbeat, le journal lui-même, lectures répétitives,
// admin, crons) : exclues du flux.
const EXCLUDED_PREFIXES = [
  "/api/activity/ping",
  "/api/events",
  "/api/version",
  "/api/admin/",
  "/api/cron/",
  "/api/carousels",
  "/aasa",
  "/assetlinks",
];

const IMPORT_METHODS: Record<string, string> = {
  "/api/recipes/import/url": "url",
  "/api/recipes/import/screenshot": "photo",
  "/api/recipes/import/voice": "voice",
};

export function isTrackedApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") && !EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));
}

/** `code` (ou `error` s'il ressemble à un slug) du corps JSON d'une réponse en erreur. */
export async function extractErrorCode(response: Response): Promise<string | undefined> {
  if (response.status < 400) return undefined;
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  try {
    const body = (await response.clone().json()) as { code?: unknown; error?: unknown };
    const code =
      typeof body.code === "string"
        ? body.code
        : typeof body.error === "string" && /^[a-z0-9_]+$/i.test(body.error)
          ? body.error
          : undefined;
    return code?.slice(0, EVENT_STRING_MAX);
  } catch {
    return undefined;
  }
}

// Identifiants que seule la RÉPONSE d'une création porte (jamais de contenu) :
// la recette créée (`id`, `source` = méthode d'ajout) ou copiée (`recipeId`).
const RESPONSE_IDS: Record<
  string,
  (body: Record<string, unknown>) => { recipe_id?: string; method_kind?: string }
> = {
  "POST /api/recipes": (b) => (typeof b.id === "string" ? { recipe_id: b.id } : {}),
  "POST /api/recipes/copy": (b) =>
    typeof b.recipeId === "string" ? { recipe_id: b.recipeId } : {},
};

async function idsFromResponse(
  request: Request,
  pathname: string,
  response: Response,
): Promise<{ recipe_id?: string; method_kind?: string }> {
  const pick = RESPONSE_IDS[`${request.method} ${pathname}`];
  if (!pick || response.status >= 300) return {};
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return {};
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    return body && typeof body === "object" ? pick(body) : {};
  } catch {
    return {};
  }
}

/** Identifiants métier que le motif de route porte déjà (jamais de contenu). */
function idsFromPath(pathname: string): { recipe_id?: string; household_id?: string } {
  const m = pathname.match(/^\/api\/(recipes|households)\/([0-9a-f-]{36})/i);
  if (!m) return {};
  return m[1] === "recipes" ? { recipe_id: m[2] } : { household_id: m[2] };
}

export async function recordApiCall(input: {
  request: Request;
  response: Response;
  startedAt: number;
  owner?: OwnerContext | null;
  /** Complément posé par la route (ex. `source` d'une recette créée). */
  extra?: { method_kind?: string; recipe_id?: string; household_id?: string };
}): Promise<void> {
  try {
    await record(input);
  } catch {
    // Best-effort : le journal ne fait jamais échouer une route.
  }
}

async function record(input: Parameters<typeof recordApiCall>[0]): Promise<void> {
  const pathname = new URL(input.request.url).pathname;
  if (!isTrackedApiPath(pathname)) return;
  const route = apiRoutePattern(pathname);
  const status = input.response.status;
  const duration_ms = Math.max(0, Math.round(performance.now() - input.startedAt));
  const method_kind = input.extra?.method_kind ?? IMPORT_METHODS[pathname];
  // Lu AVANT de rendre la réponse (corps cloné, quelques octets en erreur) :
  // trackEvent doit capturer le contexte requête et poser son after() pendant
  // le cycle de la requête, pas dans une continuation qui peut arriver après.
  const error_code = await extractErrorCode(input.response);
  const fromResponse = {
    ...(await idsFromResponse(input.request, pathname, input.response)),
    ...takeExtraHeader(input.response),
  };
  await trackEvent(
    "api.called",
    {
      route,
      method: input.request.method,
      status,
      duration_ms,
      ...(error_code ? { error_code } : {}),
      ...(method_kind ? { method_kind } : {}),
      ...idsFromPath(pathname),
      ...fromResponse,
      ...(input.extra?.recipe_id ? { recipe_id: input.extra.recipe_id } : {}),
      ...(input.extra?.household_id ? { household_id: input.extra.household_id } : {}),
    },
    { owner: input.owner },
  );
}

/**
 * Enveloppe des routes PUBLIQUES (sans withOwnerAuth) : chronomètre le handler
 * et émet `api.called` anonyme — `anon_id` suffit, v_identity rattache la
 * personne à sa première session. Une route qui connaît l'owner qu'elle vient
 * de créer peut l'ajouter via `extra`.
 */
export function withApiEvent<Req extends Request, C, Res extends Response>(
  handler: (request: Req, context: C) => Promise<Res>,
) {
  return async (request: Req, context?: C): Promise<Res> => {
    const startedAt = performance.now();
    const response = await handler(request, context as C);
    await recordApiCall({ request, response, startedAt });
    return response;
  };
}
