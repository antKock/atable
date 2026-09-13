"use client";

import { dropSwrCache } from "@/lib/swr";

// Création d'un carnet EN UN TAP (spec #23) : pas d'écran de nom, le serveur
// pose le nom par défaut selon la locale. Partagé par la landing, le CTA du
// hint démo (conversion) et le formulaire de partage en mode sans nom.
// Renvoie la destination ; lève une Error avec le message serveur ou le repli.
export async function createHouseholdQuick(fallbackError: string): Promise<{ redirect: string }> {
  const response = await fetch("/api/households", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; redirect?: string };
  if (!response.ok) {
    throw new Error(data.error ?? fallbackError);
  }
  // Nouveau carnet : le cache SWR appartient à la session précédente (démo…)
  dropSwrCache();
  return { redirect: data.redirect ?? "/home" };
}
