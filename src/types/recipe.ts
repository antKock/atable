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
  imagePrompt: string | null;
  generatedImageUrl: string | null;
  enrichmentStatus: string;
  imageStatus: string;
  lastViewedAt: string | null;
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
};

export type RecipeFormData = {
  title: string;
  ingredients: string;
  steps: string;
  tags: string[]; // tag IDs for form submission
  photoUrl: string | null;
  // v3 optional metadata
  prepTime?: string;
  cookTime?: string;
  cost?: string;
  complexity?: string;
  seasons?: string[];
};
