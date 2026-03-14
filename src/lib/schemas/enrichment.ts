import { z } from "zod";

export const VALID_SEASONS = ["printemps", "ete", "automne", "hiver"] as const;

export const VALID_PREP_TIMES = [
  "< 10 min",
  "10-20 min",
  "20-30 min",
  "30-45 min",
  "> 45 min",
] as const;

export const VALID_COOK_TIMES = [
  "Aucune",
  "< 15 min",
  "15-30 min",
  "30 min - 1h",
  "1h - 2h",
  "> 2h",
] as const;

export const VALID_COST_LEVELS = ["€", "€€", "€€€"] as const;

export const VALID_COMPLEXITY_LEVELS = ["facile", "moyen", "difficile"] as const;

export const EnrichmentResponseSchema = z.object({
  tags: z.array(z.string()).max(10),
  seasons: z.array(z.enum(VALID_SEASONS)),
  prepTime: z.enum(VALID_PREP_TIMES),
  cookTime: z.enum(VALID_COOK_TIMES),
  cost: z.enum(VALID_COST_LEVELS),
  complexity: z.enum(VALID_COMPLEXITY_LEVELS),
  imagePrompt: z.string(),
});

export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;
