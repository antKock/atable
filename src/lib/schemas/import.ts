import { z } from "zod";
import type { FullDictionary } from "@/lib/i18n/types";
import { frFull as fr } from "@/lib/i18n/full";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
  servingsGuessField,
} from "@/lib/schemas/enrichment";

// 10 MB file ≈ ~14M base64 chars (with data URI prefix)
const MAX_BASE64_LENGTH = 15_000_000;

// Messages localisés (chantier i18n) : factories + défaut FR.
export function buildImportScreenshotSchema(t: FullDictionary) {
  return z.object({
    images: z
      .array(z.string().min(1).max(MAX_BASE64_LENGTH, t.validation.imageTooLarge))
      .min(1, t.validation.imageRequired)
      .max(5, t.validation.imagesMax),
  });
}

export function buildImportUrlSchema(t: FullDictionary) {
  return z.object({
    url: z
      .string()
      .url(t.validation.urlInvalid)
      .refine((u) => u.startsWith("https://"), t.validation.httpsOnly),
  });
}

export const ImportScreenshotSchema = buildImportScreenshotSchema(fr);
export const ImportUrlSchema = buildImportUrlSchema(fr);

export const ImportResultSchema = z.object({
  title: z.string(),
  ingredients: z.string().nullable(),
  steps: z.string().nullable(),
  notes: z.string().nullable(),
  prepTime: z.enum(VALID_PREP_TIMES).nullable(),
  cookTime: z.enum(VALID_COOK_TIMES).nullable(),
  cost: z.enum(VALID_COST_LEVELS).nullable(),
  complexity: z.enum(VALID_COMPLEXITY_LEVELS).nullable(),
  seasons: z.array(z.enum(VALID_SEASONS)),
  servings: servingsGuessField,
});

/**
 * Nature des images d'un import photo, estimée par le modèle vision dans le même
 * appel (chantier « OCR sur l'appareil ») : mesure la répartition réelle des cas
 * pour pondérer le banc Apple Vision. Une catégorie, jamais de contenu.
 */
export const IMAGE_KINDS = ["screenshot", "printed_photo", "handwritten", "other"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const MAX_VOICE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const VALID_VOICE_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
] as const;

/**
 * Fichier audio de l'import vocal (champ `audio` du multipart) : taille et
 * type MIME (le paramètre `;codecs=…` est ignoré). Messages localisés.
 */
export function buildImportVoiceSchema(t: FullDictionary) {
  return z
    .instanceof(File, { message: t.api.audioRequired })
    .refine((f) => f.size <= MAX_VOICE_FILE_SIZE, { message: t.api.audioTooLarge })
    .refine((f) => (VALID_VOICE_MIME_TYPES as readonly string[]).includes(f.type.split(";")[0]), {
      message: t.api.audioFormatUnsupported,
    });
}

export type ImportResult = z.infer<typeof ImportResultSchema>;
