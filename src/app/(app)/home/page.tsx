import Link from "next/link";
import { Users } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
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

  return (
    <div className="pb-6 pt-6">
      <header className="mb-4 flex items-center justify-between px-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          <span className="text-foreground">a</span>
          <span className="text-accent">table</span>
        </h1>
        <Link
          href="/household"
          aria-label={t.household.menuButton}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Users size={20} />
        </Link>
      </header>
      {code && householdName && (
        <PostCreationBanner
          householdName={decodeURIComponent(householdName)}
          code={decodeURIComponent(code)}
        />
      )}
      <HomeContent />
    </div>
  );
}
