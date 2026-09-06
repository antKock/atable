import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getClientIp } from "@/lib/request-ip";
import { createServerClient } from "@/lib/supabase/server";
import { shareRateLimit } from "@/lib/redis";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { verifySession } from "@/lib/auth/session";
import { resolveOwnerContext, householdIds } from "@/lib/auth/owner-context";
import RecipeView from "@/components/recipes/RecipeView";
import { getLocale } from "@/lib/i18n/server";
import { dictionaries, LOCALES } from "@/lib/i18n";
import { ogLocaleTag } from "@/lib/i18n/locale";
import { tagLabel } from "@/lib/i18n/labels";
import { SHARE_LOCALE_PARAM, shareLocaleFromSearchParam } from "@/lib/share-url";
import InAppBackButton from "@/components/recipes/InAppBackButton";
import ShareRecipeActions, {
  type ViewerState,
} from "@/components/recipes/ShareRecipeActions";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Resolve a recipe purely by its capability token — no household scoping.
async function getSharedRecipe(token: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_tags(tag_id, tags(id, name, category))")
    .eq("share_token", token)
    .single();
  if (!data) return null;
  return {
    recipe: mapDbRowToRecipe(data),
    householdId: data.household_id as string | null,
  };
}

// Métadonnées Open Graph dans la langue de l'appareil ÉMETTEUR quand l'URL
// porte l'indice `?l=` (cf. share-url.ts) : les bots d'aperçu n'envoient pas
// Accept-Language. L'indice ne sert qu'ici — la page elle-même (composant
// ci-dessous) reste rendue dans la langue du lecteur via getT().
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const result = await getSharedRecipe(token);
  if (!result) return {};

  const { recipe } = result;
  const locale = shareLocaleFromSearchParam(query[SHARE_LOCALE_PARAM]) ?? (await getLocale());
  const t = dictionaries[locale];
  const description =
    recipe.tags.length > 0
      ? recipe.tags.map((tag) => tagLabel(t, tag.name)).join(", ")
      : t.share.ogFallback;
  const image = recipe.photoUrl ?? recipe.generatedImageUrl;

  return {
    title: recipe.title,
    description,
    // `openGraph` d'une page REMPLACE celui du layout (pas de fusion) : on
    // repose donc siteName et locale ici.
    openGraph: {
      title: recipe.title,
      description,
      siteName: t.appName,
      locale: ogLocaleTag(locale),
      alternateLocale: LOCALES.filter((l) => l !== locale).map(ogLocaleTag),
      ...(image && { images: [{ url: image }] }),
    },
  };
}

export default async function SharedRecipePage({ params }: Props) {
  const { token } = await params;

  // Per-IP limit so share tokens can't be enumerated. Fail open: a Redis
  // outage must not break shared links. notFound() throws, so it must be
  // called outside the try block.
  let limited = false;
  try {
    const hdrs = await headers();
    const ip = getClientIp(hdrs);
    const { success } = await shareRateLimit.limit(ip);
    limited = !success;
  } catch (err) {
    console.error("[r/token] rate limit check failed (Redis down?), failing open:", err);
  }
  if (limited) notFound();

  const result = await getSharedRecipe(token);
  if (!result) notFound();

  const { recipe, householdId } = result;

  // Viewer context from the session cookie (the route itself is public).
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("atable_session")?.value;
  const payload = sessionToken ? await verifySession(sessionToken) : null;

  // Multi-foyer (Lot 4) : le viewer est « owner » du partage si la recette
  // vit dans l'UN de ses foyers (le hid du cookie a disparu — on résout
  // l'owner en DB), sinon « friend » ; sans session, « guest ».
  let viewerState: ViewerState = "guest";
  if (payload) {
    const owner = await resolveOwnerContext(payload.sid);
    const belongs = owner !== null && householdId !== null && householdIds(owner).includes(householdId);
    viewerState = belongs ? "owner" : "friend";
  }

  // No edit/delete controls and — per the design — no brand banner; the CTA
  // alone situates the app.
  return (
    <div
      className="min-h-dvh bg-background pb-40"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <RecipeView recipe={recipe} heroOverlay={<InAppBackButton />} />
      <ShareRecipeActions
        token={token}
        viewerState={viewerState}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        recipePhotoUrl={recipe.photoUrl ?? recipe.generatedImageUrl}
      />
    </div>
  );
}
