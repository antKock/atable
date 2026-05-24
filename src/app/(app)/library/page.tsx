import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/fr";
import LibraryContent from "@/components/recipes/LibraryContent";

type Props = {
  searchParams: Promise<{ search?: string }>;
};

export default async function LibraryPage({ searchParams }: Props) {
  const { search } = await searchParams;
  const hdrs = await headers();
  const householdId = hdrs.get("x-household-id");
  if (!householdId) redirect("/");

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
      <LibraryContent autoFocusSearch={search === "true"} />
    </div>
  );
}
