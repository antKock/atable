import { z } from "zod";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";

// 10 MB file ≈ ~14M base64 chars (with data URI prefix)
const MAX_BASE64_LENGTH = 15_000_000;

export const ImportScreenshotSchema = z.object({
  images: z
    .array(z.string().min(1).max(MAX_BASE64_LENGTH, "Image trop volumineuse"))
    .min(1, "Au moins une image est requise")
    .max(5, "Maximum 5 images"),
});

export const ImportUrlSchema = z.object({
  url: z
    .string()
    .url("URL invalide")
    .refine((u) => u.startsWith("https://"), "Seules les URLs HTTPS sont acceptées"),
});

export const ImportResultSchema = z.object({
  title: z.string(),
  ingredients: z.string().nullable(),
  steps: z.string().nullable(),
  prepTime: z.enum(VALID_PREP_TIMES).nullable(),
  cookTime: z.enum(VALID_COOK_TIMES).nullable(),
  cost: z.enum(VALID_COST_LEVELS).nullable(),
  complexity: z.enum(VALID_COMPLEXITY_LEVELS).nullable(),
  seasons: z.array(z.enum(VALID_SEASONS)),
});

export type ImportResult = z.infer<typeof ImportResultSchema>;
