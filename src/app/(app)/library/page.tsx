import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import { getOwnerContext, isGuestOwner } from "@/lib/auth/owner-context";
import LibraryContent from "@/components/recipes/LibraryContent";

type Props = {
  searchParams: Promise<{ search?: string }>;
};

export default async function LibraryPage({ searchParams }: Props) {
  const { search } = await searchParams;
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) redirect("/");

  // Rôle du viewer (mono-appartenance) → masque le CTA de création vide pour un
  // invité (lecture seule, Lot 3). getOwnerContext est mémoïsé par requête.
  const owner = await getOwnerContext();
  const isGuest = owner ? isGuestOwner(owner) : false;

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
