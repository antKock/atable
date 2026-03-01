export type Recipe = {
  id: string;
  userId: string | null;
  title: string;
  ingredients: string | null;
  steps: string | null;
  tags: string[];
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeListItem = Pick<Recipe, "id" | "title" | "tags" | "photoUrl" | "createdAt">;

export type RecipeFormData = {
  title: string;
  ingredients: string;
  steps: string;
  tags: string[];
  photoUrl: string | null;
};
