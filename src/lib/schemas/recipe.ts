import { z } from "zod";

// How a recipe was added — the method that pre-filled the create form.
export const RECIPE_SOURCES = ["manual", "url", "photo", "voice"] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

// Size caps: keep user text within sane bounds — recipe fields are injected
// into OpenAI prompts, so unbounded input means unbounded token spend.
export const MAX_TITLE_LENGTH = 200;
export const MAX_TEXT_LENGTH = 10_000;

const titleField = z
  .string()
  .min(1, "Le titre est requis")
  .max(MAX_TITLE_LENGTH, "Le titre est trop long (200 caractères max)");
const textField = z
  .string()
  .max(MAX_TEXT_LENGTH, "Texte trop long (10 000 caractères max)")
  .nullable()
  .optional();

export const RecipeCreateSchema = z.object({
  title: titleField,
  ingredients: textField,
  steps: textField,
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
  title: titleField,
  ingredients: textField,
  steps: textField,
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
