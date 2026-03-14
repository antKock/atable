import { z } from "zod";

export const RecipeCreateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  photoUrl: z.string().url().nullable().optional(),
  // v3 optional metadata
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  complexity: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional().default([]),
  tagIds: z.array(z.string()).optional().default([]),
});

export const RecipeUpdateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  photoUrl: z.string().url().nullable().optional(),
  // v3 optional metadata
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
