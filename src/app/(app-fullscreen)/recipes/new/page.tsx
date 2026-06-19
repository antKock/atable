import NewRecipeFlow from "@/components/recipes/NewRecipeFlow";

// NewRecipeFlow reads search params (?import=url&url=… from the share sheet)
// via useSearchParams, which requires the route to render dynamically.
export const dynamic = "force-dynamic";

export default function NewRecipePage() {
  return <NewRecipeFlow />;
}
