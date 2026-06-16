import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { shareRateLimit } from "@/lib/redis";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { verifySession } from "@/lib/auth/session";
import RecipeView from "@/components/recipes/RecipeView";
import InAppBackButton from "@/components/recipes/InAppBackButton";
import ShareRecipeActions, {
  type ViewerState,
} from "@/components/recipes/ShareRecipeActions";

type Props = {
  params: Promise<{ token: string }>;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await getSharedRecipe(token);
  if (!result) return {};

  const { recipe } = result;
  const description =
    recipe.tags.length > 0
      ? recipe.tags.map((tag) => tag.name).join(", ")
      : "Une recette sur Mijote";
  const image = recipe.photoUrl ?? recipe.generatedImageUrl;

  return {
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
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
    const ip = (hdrs.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();
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

  let viewerState: ViewerState = "guest";
  if (payload) {
    viewerState = payload.hid === householdId ? "owner" : "friend";
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
