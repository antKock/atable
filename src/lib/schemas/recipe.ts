import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/types";
import { t as fr } from "@/lib/i18n/fr";

// How a recipe was added — the method that pre-filled the create form.
export const RECIPE_SOURCES = ["manual", "url", "photo", "voice"] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

// Size caps: keep user text within sane bounds — recipe fields are injected
// into OpenAI prompts, so unbounded input means unbounded token spend.
export const MAX_TITLE_LENGTH = 200;
export const MAX_TEXT_LENGTH = 10_000;

// Messages de validation localisés (chantier i18n) : les schémas sont des
// factories prenant le dictionnaire de la requête ; les constantes FR
// exportées plus bas restent le défaut (tests, imports historiques).
function fields(t: Dictionary) {
  const titleField = z
    .string()
    .min(1, t.validation.titleRequired)
    .max(MAX_TITLE_LENGTH, t.validation.titleTooLong);
  const textField = z
    .string()
    .max(MAX_TEXT_LENGTH, t.validation.textTooLong)
    .nullable()
    .optional();
  const servingsField = z
    .number()
    .int()
    .min(1, t.validation.servingsInvalid)
    .max(20, t.validation.servingsInvalid)
    .nullable()
    .optional();
  return { titleField, textField, servingsField };
}

export function buildRecipeCreateSchema(t: Dictionary) {
  const { titleField, textField, servingsField } = fields(t);
  return z.object({
  title: titleField,
  ingredients: textField,
  steps: textField,
  notes: textField,
  photoUrl: z.string().url().nullable().optional(),
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  complexity: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional().default([]),
  servings: servingsField,
  tagIds: z.array(z.string()).optional().default([]),
  source: z.enum(RECIPE_SOURCES).optional().default("manual"),
  // Set by the create form when the user attached their own photo. The photo is
  // uploaded *after* creation (the Storage path needs the recipe id), so without
  // this hint enrichment would generate — and bill — an AI image that the photo
  // immediately hides. When true, enrichment skips image generation.
  willUploadPhoto: z.boolean().optional(),
  });
}

export function buildRecipeUpdateSchema(t: Dictionary) {
  const { titleField, textField, servingsField } = fields(t);
  return z.object({
  title: titleField,
  ingredients: textField,
  steps: textField,
  notes: textField,
  photoUrl: z.string().url().nullable().optional(),
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  complexity: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional(),
  servings: servingsField,
  tagIds: z.array(z.string()).optional(),
  regenerateImage: z.boolean().optional(),
  });
}

// Défaut FR (tests, types)
export const RecipeCreateSchema = buildRecipeCreateSchema(fr);
export const RecipeUpdateSchema = buildRecipeUpdateSchema(fr);

export type RecipeCreateInput = z.infer<typeof RecipeCreateSchema>;
export type RecipeUpdateInput = z.infer<typeof RecipeUpdateSchema>;
