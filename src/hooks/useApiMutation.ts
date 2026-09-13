"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiRequest, type ApiRequestInit } from "@/lib/api-client";

type Options = {
  /** Message d'erreur par défaut (le serveur peut en renvoyer un plus précis). */
  fallbackError: string;
  /** Toast d'erreur automatique (durée infinie, comme partout). Défaut : oui. */
  toastError?: boolean;
  /** Appelé sur erreur (après le toast éventuel) — pour un état d'erreur local. */
  onError?: (error: Error) => void;
};

/**
 * Mutation client vers /api/* avec l'état `loading` et le toast d'erreur
 * unifiés (revue 2026-09-12 : 9 copies du même fetch + toast + loading).
 *
 *   const { run, loading } = useApiMutation({ fallbackError: t.feedback.deleteError });
 *   const data = await run(`/api/recipes/${id}`, { method: "DELETE" });
 *   if (!data) return; // erreur déjà affichée
 *
 * `run` renvoie `undefined` en cas d'erreur (toast déjà émis) : l'appelant
 * n'a pas de try/catch à écrire. `loading` repasse à false à la fin, succès
 * ou échec — un appelant qui navigue ailleurs peut ignorer ce retour.
 */
export function useApiMutation<T = Record<string, unknown>>({
  fallbackError,
  toastError = true,
  onError,
}: Options) {
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (
      url: string,
      init: Omit<ApiRequestInit, "fallbackError"> = {},
    ): Promise<T | undefined> => {
      setLoading(true);
      try {
        return await apiRequest<T>(url, { ...init, fallbackError });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(fallbackError);
        if (toastError) toast.error(error.message, { duration: Infinity });
        onError?.(error);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fallbackError, toastError, onError],
  );

  return { run, loading };
}
