export type Tag = {
  id: string;
  name: string;
  category: string | null;
};

export type Recipe = {
  id: string;
  userId: string | null;
  title: string;
  ingredients: string | null;
  steps: string | null;
  notes: string | null;
  tags: Tag[];
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // v3 metadata
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  complexity: string | null;
  seasons: string[];
  servings: number | null;
  imagePrompt: string | null;
  generatedImageUrl: string | null;
  enrichmentStatus: string;
  imageStatus: string;
  // « créée ou ouverte » — NOT NULL en base (migration 024)
  lastActivityAt: string;
  viewCount: number;
};

export type RecipeListItem = Pick<
  Recipe,
  "id" | "title" | "ingredients" | "tags" | "photoUrl" | "createdAt" | "generatedImageUrl" | "enrichmentStatus" | "imageStatus"
>;

export type LibraryRecipeItem = RecipeListItem & {
  prepTime: string | null;
  cookTime: string | null;
  cost: string | null;
  seasons: string[];
  // Foyer d'origine (multi-foyer, Lot 4) : sert au filtre « Foyer » et au label
  // discret sous le titre en biblio (affiché seulement si l'owner a >1 foyer).
  householdId: string;
  householdName: string | null;
};

export type RecipeFormData = {
  title: string;
  ingredients: string;
  steps: string;
  notes: string;
  tags: string[]; // tag IDs for form submission
  photoUrl: string | null;
  // v3 optional metadata
  prepTime?: string;
  cookTime?: string;
  cost?: string;
  complexity?: string;
  seasons?: string[];
  servings?: number;
};
