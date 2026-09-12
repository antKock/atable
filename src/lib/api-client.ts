// Appels d'écriture du client vers /api/* : UNE forme de requête, UNE forme
// d'erreur. Toutes les routes répondent `{ error, code? }` en cas d'échec ; une
// page d'erreur HTML (proxy, 502) n'est pas du JSON — d'où le `.catch` sur
// `res.json()` (sans lui : toast infini « Unexpected token '<' »).
//
// Fonction pure (testable hors React) ; `useApiMutation` (hooks/) y ajoute
// l'état `loading` et le toast d'erreur.

export type ApiMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequestInit = {
  method?: ApiMethod;
  /** Sérialisé en JSON avec l'en-tête content-type ; absent = pas de corps. */
  body?: unknown;
  /** Message affiché si le serveur n'en renvoie pas (ou répond hors JSON). */
  fallbackError: string;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Exécute la requête et renvoie le corps JSON parsé (`{}` pour une réponse
 * sans corps, ex. 204). Lève `ApiError` (message serveur ou `fallbackError`)
 * sur tout statut non-2xx.
 */
export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  { method = "POST", body, fallbackError, signal }: ApiRequestInit,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === "string" && data.error ? data.error : fallbackError;
    const code = typeof data.code === "string" ? data.code : undefined;
    throw new ApiError(message, res.status, code);
  }
  return data as T;
}
