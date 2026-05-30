import { z } from "zod";

// How a recipe was added — the method that pre-filled the create form.
export const RECIPE_SOURCES = ["manual", "url", "photo", "voice"] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

export const RecipeCreateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  complexity: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional().default([]),
  tagIds: z.array(z.string()).optional().default([]),
  source: z.enum(RECIPE_SOURCES).optional().default("manual"),
});

export const RecipeUpdateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  complexity: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  regenerateImage: z.boolean().optional(),
});

export type RecipeCreateInput = z.infer<typeof RecipeCreateSchema>;
export type RecipeUpdateInput = z.infer<typeof RecipeUpdateSchema>;
