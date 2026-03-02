import { z } from "zod";

export const RecipeCreateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  photoUrl: z.string().url().nullable().optional(),
});

export const RecipeUpdateSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  ingredients: z.string().nullable().optional(),
  steps: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export type RecipeCreateInput = z.infer<typeof RecipeCreateSchema>;
export type RecipeUpdateInput = z.infer<typeof RecipeUpdateSchema>;
