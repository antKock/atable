import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbRowToRecipe } from "@/lib/supabase/mappers";
import { t } from "@/lib/i18n/fr";
import WakeLockActivator from "@/components/recipes/WakeLockActivator";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) {
    notFound();
  }

  const recipe = mapDbRowToRecipe(data);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <WakeLockActivator />

      {/* Back button */}
      <div className="px-4 pb-4 pt-6">
        <Link
          href="/"
          aria-label={t.a11y.backButton}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Photo hero or warm placeholder */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl}
            alt={t.a11y.recipePhoto(recipe.title)}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <div className="h-10 w-10 rounded-full border-4 border-accent/20" />
            </div>
          </div>
        )}
      </div>

      {/* Recipe content */}
      <div className="px-4 pt-6">
        <h1 className="text-3xl font-semibold leading-tight text-foreground">
          {recipe.title}
        </h1>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Ingredients section — only rendered when content exists */}
        {recipe.ingredients && (
          <section className="mt-8" aria-labelledby="ingredients-heading">
            <h2
              id="ingredients-heading"
              className="mb-4 text-xl font-semibold text-foreground"
            >
              {t.detail.ingredients}
            </h2>
            <p className="whitespace-pre-line text-lg leading-relaxed text-foreground">
              {recipe.ingredients}
            </p>
          </section>
        )}

        {/* Steps section — only rendered when content exists */}
        {recipe.steps && (
          <section className="mt-8" aria-labelledby="steps-heading">
            <h2
              id="steps-heading"
              className="mb-4 text-xl font-semibold text-foreground"
            >
              {t.detail.steps}
            </h2>
            <p className="whitespace-pre-line text-lg leading-relaxed text-foreground">
              {recipe.steps}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
