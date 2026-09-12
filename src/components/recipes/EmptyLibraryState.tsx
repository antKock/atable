"use client";

import { useT } from "@/lib/i18n/client";
import CenteredState from "@/components/ui/CenteredState";
import CarnetIllustration from "./CarnetIllustration";

// Carnet sans recette (Home ET Bibliothèque : même écran). Pas de CTA de
// création pour un invité (lecture seule, Lot 3).
export default function EmptyLibraryState({ isGuest }: { isGuest: boolean }) {
  const t = useT();
  return (
    <CenteredState
      illustration={<CarnetIllustration size={72} accent="var(--accent)" />}
      title={t.empty.libraryTitle}
      body={t.empty.libraryBody}
      cta={isGuest ? undefined : { label: t.actions.addRecipe, href: "/recipes/new" }}
    />
  );
}
