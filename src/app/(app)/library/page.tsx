import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import { getOwnerContext, isGuestOwner } from "@/lib/auth/owner-context";
import LibraryContent from "@/components/recipes/LibraryContent";

type Props = {
  searchParams: Promise<{ search?: string }>;
};

export default async function LibraryPage({ searchParams }: Props) {
  const { search } = await searchParams;

  // Multi-foyer (Lot 4) : accès résolu via l'owner (plus de x-household-id).
  // `isGuest` (invité partout) masque le CTA de création vide. La biblio
  // fusionne tous les foyers ; le filtre « Foyer » et les labels d'origine
  // sont pilotés côté client depuis /api/library.
  const owner = await getOwnerContext();
  if (!owner || owner.memberships.length === 0) redirect("/");
  const isGuest = isGuestOwner(owner);

  return (
    <div className="pb-8 pt-6">
      <h1
        className="mb-4 px-4 text-foreground"
        style={{
          fontFamily: "var(--font-fraunces)",
          fontVariationSettings: '"opsz" 144',
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {t.nav.library}
      </h1>
      <LibraryContent autoFocusSearch={search === "true"} isGuest={isGuest} />
    </div>
  );
}
