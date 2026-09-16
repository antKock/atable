"use client";

import { useWakeLock } from "@/hooks/useWakeLock";

// Écran allumé pendant la lecture d'une recette. (Le journal #28 n'émet plus
// rien ici : le wake lock s'obtient à CHAQUE ouverture de fiche, il doublait
// `screen.viewed` — « on cuisine » se lit sur la durée, vue v_cooking.)
export default function WakeLockActivator() {
  useWakeLock();
  return null;
}
