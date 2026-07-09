import openai from "@/lib/openai";
import { withRetry } from "@/lib/retry";
import { recordAiCost, textCostUsd, type AiCallType } from "@/lib/ai-cost";
import {
  runApifyActor,
  isApifyConfigured,
  APIFY_ACTORS,
  APIFY_PRICING,
  INCLUDE_INSTAGRAM_TRANSCRIPT,
} from "@/lib/apify";
import { ImportResultSchema } from "@/lib/schemas/import";
import type { ImportResult } from "@/lib/schemas/import";
import {
  VALID_SEASONS,
  VALID_PREP_TIMES,
  VALID_COOK_TIMES,
  VALID_COST_LEVELS,
  VALID_COMPLEXITY_LEVELS,
} from "@/lib/schemas/enrichment";
import { isSectionLine } from "@/lib/recipe-sections";
import { assertPublicUrl } from "@/lib/url-guard";
import type { RecipeFormData } from "@/types/recipe";

export type ImportedRecipeData = Omit<RecipeFormData, "tags" | "photoUrl">;

// Context for cost instrumentation. Routes pass it (household is known from the
// session); unit tests omit it, so no DB write happens in tests. Imports run
// before a recipe exists, so there's no recipe_id to attach yet.
export type ImportMeta = { householdId: string };

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: "SITE_BLOCKED" | "SITE_UNREACHABLE" | "EXTRACTION_FAILED" | "TRANSCRIPTION_FAILED",
  ) {
    super(message);
    this.name = "ImportError";
  }
}

// ---------- System prompt ----------

const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant culinaire expert. Extrais les données de la recette et retourne un JSON structuré en français.

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
function normaliseList(
  text: string | null,
  strip: (line: string) => string,
): string | null {
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
    ingredients:
      dedupeLines(normaliseList(result.ingredients, stripIngredientMarker)) ?? "",
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

export async function extractRecipeFromImages(
  base64Images: string[],
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  console.log(`[import/screenshot] OCR extraction — ${base64Images.length} image(s)`);
  return withRetry(async () => {
    const imageContent = base64Images.map((img) => ({
      type: "image_url" as const,
      image_url: {
        url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
      },
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: IMPORT_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrais la recette de cette/ces image(s) :",
            },
            ...imageContent,
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const parsed = ImportResultSchema.parse(JSON.parse(content));
    if (meta) {
      await recordAiCost({
        householdId: meta.householdId,
        callType: "ocr",
        model: "gpt-4o",
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        costUsd: textCostUsd("gpt-4o", response.usage?.prompt_tokens, response.usage?.completion_tokens),
      });
    }
    return toFormData(parsed);
  });
}

// ---------- Voice transcription ----------

export async function extractRecipeFromVoice(
  audioFile: File,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  // Step 1: Transcribe audio with Whisper
  const transcription = await withRetry(async () => {
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "fr",
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
      model: "whisper-1",
      costUsd: 0,
    });
  }

  // Step 2: Structure transcription into recipe JSON
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: IMPORT_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extrais la recette depuis cette transcription orale. Attention : peut contenir des hésitations, répétitions, ou corrections ('ah non, 200g pas 300') — utilise toujours la dernière valeur donnée :\n\n${transcription}`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const parsed = ImportResultSchema.parse(JSON.parse(content));
    if (meta) {
      await recordAiCost({
        householdId: meta.householdId,
        callType: "import_voice",
        model: "gpt-4o-mini",
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        costUsd: textCostUsd("gpt-4o-mini", response.usage?.prompt_tokens, response.usage?.completion_tokens),
      });
    }
    return toFormData(parsed);
  });
}

// ---------- Shared text → recipe structuring ----------

/**
 * Structure a free-text recipe (cleaned HTML, Instagram caption, crawler
 * markdown) into form data via gpt-4o-mini. Shared by all URL-derived import
 * paths; `callType` attributes the cost to the right voie in the dashboard.
 */
async function structureRecipeFromText(
  text: string,
  opts: { callType: AiCallType; meta?: ImportMeta },
): Promise<ImportedRecipeData> {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: IMPORT_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extrais la recette depuis ce contenu :\n\n${text}`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
    const parsed = ImportResultSchema.parse(JSON.parse(content));
    if (opts.meta) {
      await recordAiCost({
        householdId: opts.meta.householdId,
        callType: opts.callType,
        model: "gpt-4o-mini",
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        costUsd: textCostUsd("gpt-4o-mini", response.usage?.prompt_tokens, response.usage?.completion_tokens),
      });
    }
    return toFormData(parsed);
  });
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

const INSTAGRAM_HOST = /(?:^|\.)(instagram\.com|instagr\.am)$/i;

function isInstagramUrl(url: string): boolean {
  try {
    return INSTAGRAM_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

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

/**
 * Instagram post/reel → recipe. Uses the Apify reel scraper for the caption
 * (transcript is a paid add-on, gated behind INCLUDE_INSTAGRAM_TRANSCRIPT).
 */
async function extractRecipeFromInstagram(
  url: string,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  if (!isApifyConfigured()) {
    throw new ImportError("Instagram import unavailable", "SITE_UNREACHABLE");
  }

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
  await recordApifyCost(meta, "import_instagram", "instagram-reel-scraper", APIFY_PRICING.instagramReel);

  const item = items[0];
  const caption = item?.caption?.trim() || "";
  const transcript = INCLUDE_INSTAGRAM_TRANSCRIPT ? item?.transcript?.trim() || "" : "";
  const text = [caption, transcript].filter(Boolean).join("\n\n");
  if (!text) {
    throw new ImportError("No recipe text found in Instagram post", "EXTRACTION_FAILED");
  }

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
  await recordApifyCost(meta, "import_url_crawler", "website-content-crawler", APIFY_PRICING.websiteCrawler);

  const item = items[0];
  const markdown = (item?.markdown || item?.text || "").trim().slice(0, 50000);
  if (!markdown) {
    throw new ImportError("Crawler returned no content", "EXTRACTION_FAILED");
  }
  return structureRecipeFromText(markdown, { callType: "import_url_crawler", meta });
}

export async function extractRecipeFromUrl(
  url: string,
  meta?: ImportMeta,
): Promise<ImportedRecipeData> {
  // Instagram needs the dedicated scraper — a plain fetch sees nothing usable.
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
