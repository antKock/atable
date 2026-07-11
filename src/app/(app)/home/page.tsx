import Link from "next/link";
import { Settings } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import { getOwnerContext, isGuestOwner } from "@/lib/auth/owner-context";
import HomeContent from "@/components/recipes/HomeContent";
import PostCreationBanner from "@/components/auth/PostCreationBanner";

type Props = {
  searchParams: Promise<{ code?: string; householdName?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { code, householdName } = await searchParams;
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");

  if (!householdId) {
    redirect("/");
  }

  // Rôle du viewer (mono-appartenance) → masque le CTA de création pour un
  // invité (lecture seule, Lot 3). getOwnerContext est mémoïsé (déjà résolu
  // par le layout) : pas de requête DB supplémentaire.
  const owner = await getOwnerContext();
  const isGuest = owner ? isGuestOwner(owner) : false;

  return (
    <div className="pb-6 pt-6">
      <header className="mb-4 flex items-center justify-between px-4">
        <h1
          className="text-4xl text-foreground"
          style={{
            fontFamily: 'var(--font-fraunces), "Times New Roman", serif',
            fontVariationSettings: '"opsz" 144',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Mijote
        </h1>
        <Link
          href="/household"
          aria-label={t.household.menuButton}
          className="flex min-h-11 min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings size={20} />
        </Link>
      </header>
      {code && householdName && (
        <PostCreationBanner
          householdName={decodeURIComponent(householdName)}
          code={decodeURIComponent(code)}
        />
      )}
      <HomeContent isGuest={isGuest} />
    </div>
  );
}
