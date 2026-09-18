import * as Sentry from "@sentry/nextjs";
import openai from "@/lib/openai";
import { AI_MODELS, withEffortFallback } from "@/lib/ai-models";
import { withRetry, withDeadline } from "@/lib/retry";
import { recordAiCost, textCostUsd, type AiCallType } from "@/lib/ai-cost";
import {
  runApifyActor,
  isApifyConfigured,
  APIFY_ACTORS,
  APIFY_PRICING,
  INCLUDE_INSTAGRAM_TRANSCRIPT,
} from "@/lib/apify";
import { ImportResultSchema, IMAGE_KINDS } from "@/lib/schemas/import";
import type { ImportResult, ImageKind } from "@/lib/schemas/import";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";
import { isSectionLine } from "@/lib/recipe-sections";
import { assertPublicUrl } from "@/lib/url-guard";
import {
  isInstagramUrl,
  parseInstagramUrl,
  readInstagramDirect,
  resolveShareLink,
  directFailureLabel,
  type DirectResult,
} from "@/lib/instagram";
import { getCachedCaption, setCachedCaption } from "@/lib/instagram-cache";
import { awaitDeviceCaption, type DeviceMiss } from "@/lib/instagram-device";
import type { RecipeFormData } from "@/types/recipe";

export type ImportedRecipeData = Omit<RecipeFormData, "tags" | "photoUrl">;

// Context for cost instrumentation. Routes pass it (household is known from the
// session); unit tests omit it, so no DB write happens in tests. Imports run
// before a recipe exists, so there's no recipe_id to attach yet.
export type ImportMeta = {
  householdId: string;
  /** Import Instagram : voie de lecture utilisée, pour le journal (#28). */
  onInstagramRead?: (report: InstagramReadReport) => void;
  /**
   * Import lancé par l'extension de partage iOS qui lit aussi la page sur le
   * téléphone (étape 2) : référence du dépôt (`igref`) et personne qui importe.
   */
  instagramDevice?: { ref: string; ownerId: string };
};

/**
 * Voie qui a fourni la légende Instagram. `device` = page lue par le téléphone
 * (extension de partage) ; `cache` = déjà lue dans les 24 h (aucune lecture
 * réseau) ; `failed` = aucune voie n'a abouti.
 */
export type InstagramPath = "device" | "direct_embed" | "direct_og" | "apify" | "cache" | "failed";
export type InstagramReadReport = {
  path: InstagramPath;
  /** Page lue par le téléphone attendue mais inutilisée : absent | unparsable | mismatch | error. */
  device?: string;
  /** Pourquoi la lecture directe a été abandonnée (`no_caption/login_wall`…) — enum, jamais de contenu. */
  fallback?: string;
  /** Durée de la lecture de la légende seule (hors structuration par le modèle). */
  readMs: number;
};

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SITE_BLOCKED"
      | "SITE_UNREACHABLE"
      | "EXTRACTION_FAILED"
      | "TRANSCRIPTION_FAILED"
      | "TIMEOUT",
  ) {
    super(message);
    this.name = "ImportError";
  }
}

// ---------- System prompt ----------

// Langue (chantier « Version EN », décision actée le 2026-09-04) : le contenu
// utilisateur n'est JAMAIS traduit — title/ingredients/steps/notes gardent la
// langue de la source (dictée, page, capture). Seules les valeurs énumérées
// (temps, coût, difficulté, saisons) restent les codes listés, quelle que soit
// la langue.
const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant culinaire expert. Extrais les données de la recette et retourne un JSON structuré.

Langue : écris title, ingredients, steps et notes dans la langue de la source (une recette en anglais reste en anglais, en portugais reste en portugais…). Ne traduis jamais, ne mélange pas les langues. Le titre n'est jamais tout en capitales, même si la source l'écrit ainsi : utilise la casse habituelle des titres dans la langue de la source (en français : première lettre en majuscule ; en anglais : Title Case). Les valeurs énumérées ci-dessous (prepTime, cookTime, cost, complexity, seasons) sont des codes : reprends-les EXACTEMENT tels quels, quelle que soit la langue de la recette.

Champs à extraire :
- title (string, obligatoire) : le nom de la recette
- ingredients (string | null) : liste des ingrédients, un par ligne. TOUS les ingrédients utilisés dans la préparation doivent figurer dans la liste, y compris ceux qui n'apparaissent que dans le texte des étapes (viandes, légumes, assaisonnements…). Reprends toujours les quantités données par la source (« 250 g de champignons ») mais n'invente jamais une quantité qu'elle ne précise pas (écris juste « sel », pas « 1 pincée de sel »). Ne liste jamais deux fois le même ingrédient. N'inclus AUCUN marqueur en début de ligne (pas de tiret, puce, point, astérisque ni numéro) — uniquement le texte de l'ingrédient.
- steps (string | null) : étapes de préparation, une par ligne. Si la source regroupe la préparation en parties nommées (« Pour la sauce », intertitres…), insère une ligne « // Nom de la partie » avant les étapes de chaque partie. Si la source ne présente pas de découpage explicite en étapes, découpe la préparation en étapes logiques courtes. N'inclus AUCUN numéro ni marqueur en début de ligne (pas de « 1. », « 2) », tiret, puce ni « Étape 1 ») — uniquement le texte de l'étape.
- notes (string | null) : uniquement si la source contient explicitement une astuce, un conseil, une variante ou une précision de l'auteur (« se congèle très bien », « remplacer le beurre par de l'huile »…). Recopie-la fidèlement, sans la reformuler. N'y mets JAMAIS de métadonnées (origine, source, auteur, date, portions) ni rien que la source ne dit pas. null s'il n'y a aucune note claire — c'est le cas le plus fréquent.
- prepTime (string | null) : temps de préparation — valeurs possibles : ${VALID_PREP_TIMES.join(", ")}
- cookTime (string | null) : temps de cuisson — valeurs possibles : ${VALID_COOK_TIMES.join(", ")}
- cost (string | null) : coût estimé — valeurs possibles : ${VALID_COST_LEVELS.join(", ")}
- complexity (string | null) : difficulté — valeurs possibles : ${VALID_COMPLEXITY_LEVELS.join(", ")}
- seasons (string[]) : saisons appropriées — valeurs possibles : ${VALID_SEASONS.join(", ")}
- servings (integer | null) : nombre de personnes pour lequel la recette est prévue (1 à 20). Uniquement si la source l'indique explicitement (« pour 4 personnes », « 6 parts »…) ou si les quantités le rendent évident ; sinon null — n'invente jamais de nombre.

Sections : si la source regroupe les ingrédients ou les étapes en parties nommées (« Pour la sauce », intertitres…), reproduis ces parties dans les deux champs en insérant une ligne « // Nom de la partie » avant les lignes de chaque partie. Exemple pour une recette en deux parties :
ingredients : "// Pour le poulet\ncuisses de poulet\n// Pour la sauce\n250 g de champignons\n20 cl de crème"
steps : "// Pour le poulet\nFaites dorer les cuisses.\n// Pour la sauce\nÉmincez les champignons et faites-les revenir à la crème."
N'invente aucune section si la source n'en présente pas.

Réponds UNIQUEMENT avec le JSON structuré, sans texte supplémentaire. Si un champ n'est pas trouvé, utilise null (ou [] pour seasons).`;

// ---------- JSON schema for structured output ----------

const IMPORT_JSON_SCHEMA = {
  name: "recipe_import",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      ingredients: { type: ["string", "null"] },
      steps: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
      prepTime: { type: ["string", "null"], enum: [...VALID_PREP_TIMES, null] },
      cookTime: { type: ["string", "null"], enum: [...VALID_COOK_TIMES, null] },
      cost: { type: ["string", "null"], enum: [...VALID_COST_LEVELS, null] },
      complexity: {
        type: ["string", "null"],
        enum: [...VALID_COMPLEXITY_LEVELS, null],
      },
      seasons: {
        type: "array",
        items: { type: "string", enum: [...VALID_SEASONS] },
      },
      servings: { type: ["integer", "null"] },
    },
    required: [
      "title",
      "ingredients",
      "steps",
      "notes",
      "prepTime",
      "cookTime",
      "cost",
      "complexity",
      "seasons",
      "servings",
    ],
    additionalProperties: false,
  },
} as const;

// OCR : même schéma + `kind`, la nature des images (chantier « OCR sur
// l'appareil », 2026-09-18) — mesure la part captures / photos de livre /
// manuscrits pour décider du secours gpt-4o. Placé en dernier pour ne pas
// orienter l'extraction ; ~3 tokens de sortie en plus, aucun appel en plus.
const OCR_JSON_SCHEMA = {
  ...IMPORT_JSON_SCHEMA,
  name: "recipe_import_ocr",
  schema: {
    ...IMPORT_JSON_SCHEMA.schema,
    properties: {
      ...IMPORT_JSON_SCHEMA.schema.properties,
      kind: { type: "string", enum: [...IMAGE_KINDS] },
    },
    required: [...IMPORT_JSON_SCHEMA.schema.required, "kind"],
  },
} as const;

const OCR_USER_PROMPT = `Extrais la recette de cette/ces image(s).

Indique aussi dans kind la nature de l'image (la plus représentative s'il y en a plusieurs) :
- screenshot : capture d'écran d'un téléphone ou d'un ordinateur (site, application, réseau social, message)
- printed_photo : photo d'un texte imprimé (livre, magazine, fiche, emballage)
- handwritten : photo d'une recette écrite à la main
- other : tout autre cas`;

// ---------- List-marker normalisation ----------

// Leading bullet glyphs (and their trailing whitespace) at the start of a line.
const BULLET_PREFIX = /^[-*•·‣–—●▪◦]+\s+/;

/**
 * Strip a leading list marker from an ingredient line.
 *
 * Conservative on purpose: only removes bullets and a number that is *explicitly*
 * punctuated as an enumerator ("1.", "2)"). A bare leading number is left intact
 * because it is almost always a quantity ("2 oeufs", "200 g de farine").
 */
function stripIngredientMarker(line: string): string {
  return line
    .replace(BULLET_PREFIX, "")
    .replace(/^\d+\s*[.)]\s+/, "")
    .trim();
}

/**
 * Strip a leading list marker from a step line: "1.", "2)", "3 -", "Étape 4:",
 * "Step 5", or a bullet. Steps are enumerators, so removing a leading number is
 * safe here.
 */
function stripStepMarker(line: string): string {
  return line
    .replace(/^(?:étape|etape|step)\s*\d+\s*[.):\-–—]?\s*/i, "")
    .replace(/^\(?\d+\)?\s*[.)°:\-–—]\s*/, "")
    .replace(BULLET_PREFIX, "")
    .trim();
}

/**
 * Apply `strip` to every non-empty line, dropping blank lines. "// Nom"
 * section markers pass through untouched — they are structure, not list items.
 */
function normaliseList(text: string | null, strip: (line: string) => string): string | null {
  if (text == null) return text;
  const lines = text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      return isSectionLine(trimmed) ? trimmed : strip(trimmed);
    })
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Drop exact duplicate lines (case- and whitespace-insensitive), keeping the
 * first occurrence. Backstop for the prompt's "ne liste jamais deux fois le
 * même ingrédient" now that ingredients are also read from the steps. Section
 * markers are never deduplicated.
 */
function dedupeLines(text: string | null): string | null {
  if (text == null) return text;
  const seen = new Set<string>();
  const lines = text.split("\n").filter((line) => {
    if (isSectionLine(line)) return true;
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return lines.length > 0 ? lines.join("\n") : null;
}

// ---------- Map result to RecipeFormData ----------

function toFormData(result: ImportResult): Omit<RecipeFormData, "tags" | "photoUrl"> {
  return {
    title: result.title.trim(),
    ingredients: dedupeLines(normaliseList(result.ingredients, stripIngredientMarker)) ?? "",
    steps: normaliseList(result.steps, stripStepMarker) ?? "",
    // Notes are free text rendered as recorded — no list normalisation.
    notes: result.notes?.trim() ?? "",
    prepTime: result.prepTime ?? undefined,
    cookTime: result.cookTime ?? undefined,
    cost: result.cost ?? undefined,
    complexity: result.complexity ?? undefined,
    seasons: result.seasons,
    servings: result.servings ?? undefined,
  };
}

// ---------- Screenshot OCR ----------

/**
 * `imageKind` : nature des images selon le modèle (journal #28, jamais montrée
 * au client) ; `undefined` si la réponse n'en porte pas de valide — une
 * catégorie manquante ne fait jamais échouer un import.
 */
export async function extractRecipeFromImages(
  base64Images: string[],
  meta?: ImportMeta,
): Promise<{ recipe: ImportedRecipeData; imageKind?: ImageKind }> {
  console.log(`[import/screenshot] OCR extraction — ${base64Images.length} image(s)`);
  const imageContent = base64Images.map((img) => ({
    type: "image_url" as const,
    image_url: {
      url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
    },
  }));
  const { recipe, raw } = await runExtraction({
    model: AI_MODELS.vision,
    jsonSchema: OCR_JSON_SCHEMA,
    callType: "ocr",
    meta,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [{ type: "text", text: OCR_USER_PROMPT }, ...imageContent],
      },
    ],
  });
  const kind = raw.kind;
  const imageKind = (IMAGE_KINDS as readonly unknown[]).includes(kind)
    ? (kind as ImageKind)
    : undefined;
  return { recipe, imageKind };
}

// ---------- Voice transcription ----------

export async function extractRecipeFromVoice(
  audioFile: File,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  // Step 1: Transcribe audio with Whisper
  const transcription = await withRetry(async () => {
    const result = await openai.audio.transcriptions.create({
      model: AI_MODELS.transcription,
      file: audioFile,
      // Pas de `language` figé : Whisper auto-détecte la langue parlée. Le forcer
      // à "fr" faisait échouer/mal transcrire les dictées dans une autre langue
      // (ex. portugais). L'étape de structuration (modèle texte) reste tolérante
      // à la langue de la transcription.
      response_format: "text",
    });
    return result as unknown as string;
  });

  if (!transcription || transcription.trim().length === 0) {
    throw new ImportError("Empty transcription", "TRANSCRIPTION_FAILED");
  }

  // Whisper bills per audio-second, which isn't available server-side without
  // decoding the file — record the call at $0 for now (counted, not priced).
  // The reconciliation tile (org Costs API) still captures the real spend.
  if (meta) {
    await recordAiCost({
      householdId: meta.householdId,
      callType: "transcription",
      model: AI_MODELS.transcription,
      costUsd: 0,
    });
  }

  // Step 2: Structure transcription into recipe JSON
  const { recipe } = await runExtraction({
    model: AI_MODELS.text,
    useEffortFallback: true,
    callType: "import_voice",
    meta,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extrais la recette depuis cette transcription orale. Attention : peut contenir des hésitations, répétitions, ou corrections ('ah non, 200g pas 300') — utilise toujours la dernière valeur donnée :\n\n${transcription}`,
      },
    ],
  });
  return recipe;
}

// ---------- Shared text → recipe structuring ----------

type ExtractionMessages = Parameters<typeof openai.chat.completions.create>[0]["messages"];

/**
 * Cœur commun des trois voies d'extraction (OCR, transcription, texte) —
 * revue 2026-09-12 : appel du modèle en JSON strict (`IMPORT_JSON_SCHEMA`),
 * retry sur erreur transitoire, validation zod, coût enregistré sur la voie
 * (`callType`) quand un foyer est connu. `useEffortFallback` : modèle texte
 * gpt-5.x (reasoning_effort « none », retenté sans le paramètre si l'API le
 * refuse — cf. ai-models.ts). `raw` = le JSON brut, pour les champs que
 * `jsonSchema` ajoute au schéma commun (`kind` de l'OCR).
 */
async function runExtraction(opts: {
  model: string;
  messages: ExtractionMessages;
  callType: AiCallType;
  meta?: ImportMeta;
  useEffortFallback?: boolean;
  jsonSchema?: typeof IMPORT_JSON_SCHEMA | typeof OCR_JSON_SCHEMA;
}): Promise<{ recipe: ImportedRecipeData; raw: Record<string, unknown> }> {
  return withRetry(async () => {
    const call = (extra: object) =>
      openai.chat.completions.create({
        model: opts.model,
        ...extra,
        response_format: {
          type: "json_schema",
          json_schema: opts.jsonSchema ?? IMPORT_JSON_SCHEMA,
        },
        messages: opts.messages,
      });
    const response = opts.useEffortFallback ? await withEffortFallback(call) : await call({});

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const raw = JSON.parse(content) as Record<string, unknown>;
    const parsed = ImportResultSchema.parse(raw);
    if (opts.meta) {
      await recordAiCost({
        householdId: opts.meta.householdId,
        callType: opts.callType,
        model: opts.model,
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        costUsd: textCostUsd(
          opts.model,
          response.usage?.prompt_tokens,
          response.usage?.completion_tokens,
        ),
      });
    }
    return { recipe: toFormData(parsed), raw };
  });
}

/**
 * Structure a free-text recipe (cleaned HTML, Instagram caption, crawler
 * markdown) into form data via le modèle texte. Shared by all URL-derived import
 * paths; `callType` attributes the cost to the right voie in the dashboard.
 */
function structureRecipeFromText(
  text: string,
  opts: { callType: AiCallType; meta?: ImportMeta },
): Promise<ImportedRecipeData> {
  return runExtraction({
    model: AI_MODELS.text,
    useEffortFallback: true,
    callType: opts.callType,
    meta: opts.meta,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `Extrais la recette depuis ce contenu :\n\n${text}` },
    ],
  }).then((r) => r.recipe);
}

/** Record the flat-estimate cost of one Apify scrape (separate from the GPT row). */
async function recordApifyCost(
  meta: ImportMeta | undefined,
  callType: AiCallType,
  actor: string,
  costUsd: number,
): Promise<void> {
  if (!meta) return;
  await recordAiCost({ householdId: meta.householdId, callType, model: `apify:${actor}`, costUsd });
}

// ---------- URL scraping ----------

// Below this length, a 200 response is almost certainly a JS-rendered shell the
// plain fetch can't read — fall back to the headless crawler instead of feeding
// GPT an empty page.
const MIN_CONTENT_LENGTH = 200;

// Redirects are followed manually so the SSRF guard runs on every hop — a
// public page must not be able to bounce the fetch onto a private address.
const MAX_REDIRECTS = 3;

/** Direct server-side fetch + HTML cleanup. Throws ImportError on block/error. */
async function fetchAndCleanHtml(url: string): Promise<string> {
  let res: Response;
  let current = url;
  for (let hop = 0; ; hop++) {
    try {
      await assertPublicUrl(new URL(current));
    } catch {
      throw new ImportError("Blocked or unresolvable host", "SITE_UNREACHABLE");
    }

    try {
      res = await fetch(current, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });
    } catch {
      throw new ImportError("Site unreachable", "SITE_UNREACHABLE");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop >= MAX_REDIRECTS) {
        throw new ImportError("Too many redirects", "SITE_UNREACHABLE");
      }
      current = new URL(location, current).toString();
      continue;
    }
    break;
  }

  if (res.status === 403 || res.status === 429) {
    throw new ImportError("Site blocked bot access", "SITE_BLOCKED");
  }
  if (!res.ok) {
    throw new ImportError(`Failed to fetch URL: ${res.status}`, "SITE_UNREACHABLE");
  }

  const html = await res.text();
  // Block-level closing tags become newlines so the page's structure (headings,
  // list items, paragraphs) survives tag-stripping — the LLM can't spot section
  // intertitles (« Pour la sauce ») in a single flattened line.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 50000); // ~12k tokens — generous enough for any recipe page
}

/** Légende via Apify (secours). `null` si Apify répond sans texte ; lève si Apify est KO. */
async function readCaptionWithApify(url: string, meta?: ImportMeta): Promise<string | null> {
  let items: Array<{ caption?: string | null; transcript?: string | null }>;
  try {
    items = await runApifyActor(APIFY_ACTORS.instagramReel, {
      // `username` accepts a username, profile URL, ID, or reel URL.
      username: [url],
      resultsLimit: 1,
      includeTranscript: INCLUDE_INSTAGRAM_TRANSCRIPT, // paid add-on
    });
  } catch {
    throw new ImportError("Instagram unreachable via Apify", "SITE_UNREACHABLE");
  }
  // Une ligne par appel Apify réel (compteur ; 0 $ tant qu'on reste dans le
  // crédit gratuit, cf. APIFY_PRICING) — jamais quand la lecture directe suffit.
  await recordApifyCost(
    meta,
    "import_instagram",
    "instagram-reel-scraper",
    APIFY_PRICING.instagramReel,
  );
  const item = items[0];
  const caption = item?.caption?.trim() || "";
  const transcript = INCLUDE_INSTAGRAM_TRANSCRIPT ? item?.transcript?.trim() || "" : "";
  return [caption, transcript].filter(Boolean).join("\n\n") || null;
}

const DIRECT_PATH = { embed: "direct_embed", og: "direct_og" } as const;

// Alerte immédiate (le voyant Santé n'est lu qu'une fois par jour) : Instagram
// peut bloquer l'IP du VPS du jour au lendemain. Trois lectures directes
// abandonnées D'AFFILÉE (un succès remet à zéro ; un 429 isolé ne dit rien)
// remontent dans Sentry, au plus une fois toutes les 10 min par conteneur.
// L'empreinte porte le jour : les issues n'étant jamais résolues, une issue
// neuve par jour de panne = une notification par jour de panne. Niveau `error` :
// la règle Sentry n'envoie d'e-mail que pour les issues « haute priorité »
// (un `warning` est classé moyen, donc muet).
const DIRECT_FAILURE_STREAK_ALERT = 3;
const DIRECT_FALLBACK_REPORT_EVERY_MS = 10 * 60_000;
let directFailureStreak = 0;
let lastDirectFallbackReportAt = 0;
function noteDirectRead(outcome: { ok: true } | { ok: false; fallback: string }): void {
  if (outcome.ok) {
    directFailureStreak = 0;
    return;
  }
  directFailureStreak++;
  if (directFailureStreak < DIRECT_FAILURE_STREAK_ALERT) return;
  const now = Date.now();
  if (now - lastDirectFallbackReportAt < DIRECT_FALLBACK_REPORT_EVERY_MS) return;
  lastDirectFallbackReportAt = now;
  Sentry.captureMessage(
    `Instagram : ${directFailureStreak} lectures directes abandonnées d'affilée (${outcome.fallback}) — secours Apify`,
    {
      level: "error",
      fingerprint: ["instagram-direct-blocked", new Date(now).toISOString().slice(0, 10)],
      tags: { feature: "import-instagram", ig_fallback: outcome.fallback },
      extra: { streak: directFailureStreak },
    },
  );
}

/** Tests uniquement : réarme le compteur et la limite d'envoi. */
export function resetInstagramAlertThrottle(): void {
  directFailureStreak = 0;
  lastDirectFallbackReportAt = 0;
}

/**
 * Instagram post/reel → légende. Chaîne (chantier « Instagram sans Apify »,
 * 2026-09-18) : cache 24 h → page lue par le téléphone (extension iOS, si
 * `meta.instagramDevice`) → lecture directe par le VPS (embed, puis
 * og:description du reel) → Apify en secours → erreur actuelle. Les codes
 * d'erreur restent ceux d'avant : SITE_UNREACHABLE (aucune voie), EXTRACTION_FAILED
 * (publication sans texte). La voie utilisée est rapportée via
 * `meta.onInstagramRead`, en succès comme en échec.
 */
async function readInstagramCaption(url: string, meta: ImportMeta | undefined): Promise<string> {
  const t0 = performance.now();
  let deviceMiss: DeviceMiss | undefined;
  const report = (path: InstagramPath, fallback?: string) => {
    const r: InstagramReadReport = {
      path,
      ...(fallback ? { fallback } : {}),
      ...(deviceMiss ? { device: deviceMiss } : {}),
      readMs: Math.round(performance.now() - t0),
    };
    console.info(
      `[import/instagram] path=${r.path} read_ms=${r.readMs}${r.fallback ? ` fallback=${r.fallback}` : ""}${r.device ? ` device=${r.device}` : ""}`,
    );
    meta?.onInstagramRead?.(r);
  };
  const fromCache = async (c: string) => {
    const cached = await getCachedCaption(c);
    if (cached) report("cache");
    return cached?.caption ?? null;
  };

  const target = parseInstagramUrl(url);
  let code = target?.kind === "post" ? target.code : null;
  if (code) {
    const cached = await fromCache(code);
    if (cached) return cached;
  }

  // 1. Page lue par le téléphone (extension iOS, étape 2) — avant toute requête
  //    du VPS, y compris la résolution d'un lien court. Jamais mise en cache
  //    partagé (anti-empoisonnement, cf. instagram-device.ts).
  const device = meta?.instagramDevice;
  if (device && target) {
    const got = await awaitDeviceCaption({ ref: device.ref, ownerId: device.ownerId, code });
    if (got.ok) {
      report("device");
      return got.caption;
    }
    deviceMiss = got.miss;
  }

  if (!code && target?.kind === "share") {
    code = await resolveShareLink(target.path);
    if (code) {
      const cached = await fromCache(code);
      if (cached) return cached;
    }
  }

  // 2. Lecture directe par le VPS.
  let fallback = target ? "share_unresolved" : "unsupported_url";
  let short: Extract<DirectResult, { ok: false }>["short"];
  if (code) {
    const direct = await readInstagramDirect(code);
    noteDirectRead(
      direct.ok
        ? { ok: true }
        : { ok: false, fallback: directFailureLabel(direct.reasons) ?? "unknown" },
    );
    if (direct.ok) {
      const path = DIRECT_PATH[direct.page];
      await setCachedCaption(code, { caption: direct.caption, source: path });
      report(path, directFailureLabel(direct.reasons));
      return direct.caption;
    }
    fallback = directFailureLabel(direct.reasons) ?? "unknown";
    short = direct.short;
  }

  // Secours Apify. Si lui aussi échoue, une légende directe jugée courte vaut
  // mieux qu'une erreur (c'est ce qu'Apify aurait renvoyé de toute façon).
  const keepShort = () => {
    if (!short) return null;
    report(DIRECT_PATH[short.page], fallback);
    return short.caption;
  };
  let text: string | null;
  try {
    if (!isApifyConfigured()) {
      throw new ImportError("Instagram import unavailable", "SITE_UNREACHABLE");
    }
    text = await readCaptionWithApify(url, meta);
  } catch (err) {
    const kept = keepShort();
    if (kept) return kept;
    report("failed", fallback);
    throw err;
  }
  if (!text) {
    const kept = keepShort();
    if (kept) return kept;
    report("failed", fallback);
    throw new ImportError("No recipe text found in Instagram post", "EXTRACTION_FAILED");
  }
  if (code) await setCachedCaption(code, { caption: text, source: "apify" });
  report("apify", fallback);
  return text;
}

/** Instagram post/reel → recipe : légende (voir readInstagramCaption) structurée par le modèle texte. */
async function extractRecipeFromInstagram(
  url: string,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  const text = await readInstagramCaption(url, meta);
  return structureRecipeFromText(text, { callType: "import_instagram", meta });
}

/** Headless-crawler fallback for sites the direct fetch can't read. */
async function crawlWithApify(url: string, meta?: ImportMeta): Promise<ImportedRecipeData> {
  let items: Array<{ markdown?: string | null; text?: string | null }>;
  try {
    items = await runApifyActor(APIFY_ACTORS.websiteCrawler, {
      startUrls: [{ url }],
      maxCrawlPages: 1,
      maxCrawlDepth: 0,
      saveMarkdown: true,
      // "none" keeps the full page text. The default "readableText" prunes
      // recipe cards as non-article content (verified: marmiton's ingredients
      // and steps were dropped), leaving only boilerplate. GPT handles the
      // extra noise, exactly as the direct-fetch path feeds it cleaned HTML.
      htmlTransformer: "none",
      proxyConfiguration: { useApifyProxy: true }, // required by the actor
    });
  } catch {
    throw new ImportError("Site unreachable via crawler", "SITE_UNREACHABLE");
  }
  await recordApifyCost(
    meta,
    "import_url_crawler",
    "website-content-crawler",
    APIFY_PRICING.websiteCrawler,
  );

  const item = items[0];
  const markdown = (item?.markdown || item?.text || "").trim().slice(0, 50000);
  if (!markdown) {
    throw new ImportError("Crawler returned no content", "EXTRACTION_FAILED");
  }
  return structureRecipeFromText(markdown, { callType: "import_url_crawler", meta });
}

// Budget global d'un import URL (fetch direct → crawler Apify → extraction),
// sous le timeout client de 60 s (ImportSelector.tsx) : le client reçoit une
// vraie réponse (code TIMEOUT) plutôt qu'un abandon silencieux. Chaque appel
// OpenAI est déjà plafonné à 45 s (lib/openai.ts).
export const URL_IMPORT_BUDGET_MS = 55_000;

export function extractRecipeFromUrl(url: string, meta?: ImportMeta): Promise<ImportedRecipeData> {
  return withDeadline(
    extractRecipeFromUrlUnbounded(url, meta),
    URL_IMPORT_BUDGET_MS,
    () => new ImportError("Import timed out", "TIMEOUT"),
  );
}

async function extractRecipeFromUrlUnbounded(
  url: string,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  // Instagram : lecture dédiée (pages publiques, puis Apify en secours).
  if (isInstagramUrl(url)) {
    return extractRecipeFromInstagram(url, meta);
  }

  // 1. Direct fetch — free and fast, handles the large majority of sites.
  let cleaned: string;
  try {
    cleaned = await fetchAndCleanHtml(url);
  } catch (err) {
    // 2. Blocked or unreachable → retry through the headless crawler when Apify
    //    is configured; otherwise surface the original error as before.
    if (
      err instanceof ImportError &&
      (err.code === "SITE_BLOCKED" || err.code === "SITE_UNREACHABLE") &&
      isApifyConfigured()
    ) {
      return crawlWithApify(url, meta);
    }
    throw err;
  }

  // 3. 200 but near-empty body → JS-rendered page; crawl instead of parsing air.
  if (cleaned.length < MIN_CONTENT_LENGTH && isApifyConfigured()) {
    return crawlWithApify(url, meta);
  }

  return structureRecipeFromText(cleaned, { callType: "import_url", meta });
}
