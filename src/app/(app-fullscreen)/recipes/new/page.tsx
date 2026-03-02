import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/fr";
import RecipeForm from "@/components/recipes/RecipeForm";

export default function NewRecipePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/home"
          aria-label={t.a11y.backButton}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          {t.actions.addRecipe}
        </h1>
      </div>
      <RecipeForm mode="create" stickySubmit />
    </div>
  );
}
