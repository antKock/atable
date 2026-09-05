#!/usr/bin/env node
// Banc d'essai qualité/coût des modèles OpenAI sur les flux IA de Mijote.
// Compare, sur les fixtures de scripts/bench/fixtures/ (cf. prepare-fixtures.mjs) :
//  - structuration texte → JSON recette : gpt-4o-mini (actuel) vs gpt-5.6-luna vs gpt-5-nano
//  - OCR captures d'écran            : gpt-4o (actuel) vs gpt-5.6-luna
//  - transcription audio             : whisper-1 (actuel) vs gpt-4o-mini-transcribe vs gpt-4o-transcribe
//  - enrichissement métadonnées      : mêmes modèles texte
// Mesure : tokens réels (dont reasoning), coût USD, latence. Résultats bruts en
// JSON dans scripts/bench/results/ pour l'étape de jugement qualité.
// Usage : node scripts/bench/bench-models.mjs [--only text|ocr|audio|enrich]
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(ROOT, "fixtures");
const OUT = path.join(ROOT, "results");
const REPO = path.resolve(ROOT, "../..");

// ---------- Clé API (.env.local, comme recheck-diet-tags.mjs) ----------
const envFile = await readFile(path.join(REPO, ".env.local"), "utf8");
const OPENAI_KEY = envFile.match(/^OPENAI_SERVICE_KEY=(.+)$/m)?.[1]?.trim();
if (!OPENAI_KEY) {
  console.error("OPENAI_SERVICE_KEY introuvable dans .env.local");
  process.exit(1);
}
const GEMINI_KEY = envFile.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!GEMINI_KEY) {
  console.error("GEMINI_API_KEY introuvable dans .env.local");
  process.exit(1);
}

// Provider déduit du nom du modèle : « gemini-* » → Google, sinon OpenAI.
// (Les noms restent bruts dans results.json pour que judge-results.mjs et les
// mappings aveugles A/B/C… continuent de fonctionner sans changement.)
function providerOf(model) {
  return model.startsWith("gemini") ? "google" : "openai";
}

// ---------- Tarifs (USD / 1M tokens ; transcription : USD / minute) ----------
const TOKEN_PRICING = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  // Google — grille payante au 2026-09-03. Les modèles à fourchette sont
  // facturés au tarif bas sous 200k tokens de prompt : nos cas y sont tous.
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-transcribe": { input: 2, output: 12 },
};
const TRANSCRIBE_PRICING_PER_MIN = {
  "whisper-1": 0.006,
  "gpt-4o-transcribe": 0.006,
  "gpt-4o-mini-transcribe": 0.003,
};

// Round 5 (2026-09-03) : on compare la stack OpenAI en prod aux candidats
// Google. Côté Google on retient les deux paliers « lite » (les seuls dont le
// prix au token approche gpt-5.6-luna) plus un flash haut de gamme comme
// plafond de qualité.
const TEXT_MODELS = [
  "gpt-5.6-luna", // en prod
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];
const OCR_MODELS = [
  "gpt-4o", // en prod
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];
const TRANSCRIBE_MODELS = [
  "gpt-4o-mini-transcribe", // en prod
  "gemini-3.5-transcribe",
];

// ---------- Prompts & schémas (copie de src/lib/import.ts / enrichment.ts) ----------
const VALID_SEASONS = ["printemps", "ete", "automne", "hiver"];
const VALID_PREP_TIMES = ["< 10 min", "10-20 min", "20-30 min", "30-45 min", "> 45 min"];
const VALID_COOK_TIMES = ["Aucune", "< 15 min", "15-30 min", "30 min - 1h", "1h - 2h", "> 2h"];
const VALID_COST_LEVELS = ["€", "€€", "€€€"];
const VALID_COMPLEXITY_LEVELS = ["facile", "moyen", "difficile"];

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
      complexity: { type: ["string", "null"], enum: [...VALID_COMPLEXITY_LEVELS, null] },
      seasons: { type: "array", items: { type: "string", enum: [...VALID_SEASONS] } },
      servings: { type: ["integer", "null"] },
    },
    required: [
      "title", "ingredients", "steps", "notes", "prepTime",
      "cookTime", "cost", "complexity", "seasons", "servings",
    ],
    additionalProperties: false,
  },
};

// Tags prédéfinis + descriptions (copie de la migration 021, source DB).
const PREDEFINED_TAGS = [
  ["Entrée", "Se sert en début de repas, avant le plat principal"],
  ["Plat principal", "Plat central et consistant d'un repas"],
  ["Accompagnement", "Se sert à côté d'un plat principal (riz, légumes, purée…)"],
  ["Dessert", "Préparation sucrée servie en fin de repas"],
  ["Soupe", "Préparation liquide ou veloutée, servie chaude ou froide"],
  ["Salade", "Plat froid assaisonné à base de feuilles, crudités ou ingrédients mélangés"],
  ["Apéro", "Bouchées ou plats à partager avant le repas"],
  ["Petit-déjeuner", "Se consomme au petit-déjeuner ou au brunch"],
  ["Goûter", "Collation sucrée de l'après-midi"],
  ["Boisson", "Se boit : cocktail, smoothie, jus, café…"],
  ["Sauce / Condiment", "Préparation destinée à accompagner ou assaisonner d'autres plats"],
  ["Pain / Pâtisserie", "Boulangerie ou pâtisserie : pain, brioche, viennoiserie…"],
  ["Végétarien", "STRICT : aucune viande, volaille, poisson, fruit de mer ni gélatine. Une recette contenant du poisson ou des fruits de mer n'est JAMAIS végétarienne. Œufs et produits laitiers autorisés."],
  ["Végan", "STRICT : aucun produit d'origine animale — ni viande, volaille, poisson, fruits de mer, œufs, produits laitiers, miel ni gélatine"],
  ["Sans gluten", "Aucun ingrédient contenant du gluten (blé, orge, seigle, épeautre…)"],
  ["Sans lactose", "Aucun produit laitier contenant du lactose"],
  ["Léger", "Peu calorique, adapté à un repas léger"],
  ["Comfort food", "Plat réconfortant, riche et généreux"],
  ["Poulet", "Le poulet ou une autre volaille est la protéine principale"],
  ["Bœuf", "Le bœuf ou le veau est la protéine principale"],
  ["Porc", "Le porc (jambon, lardons, saucisse, bacon…) est la protéine principale"],
  ["Agneau", "L'agneau ou le mouton est la protéine principale"],
  ["Poisson", "Un poisson (saumon, thon, cabillaud…) est la protéine principale"],
  ["Fruits de mer", "Crustacés ou coquillages (crevettes, moules, calamars…) en protéine principale"],
  ["Œufs", "Les œufs sont la protéine principale"],
  ["Tofu / Protéines végétales", "Tofu, tempeh, seitan ou autres substituts végétaux en protéine principale"],
  ["Légumineuses", "Lentilles, pois chiches, haricots secs… en protéine principale"],
  ["Française", "Tradition culinaire française"],
  ["Italienne", "Tradition culinaire italienne (pâtes, risotto, pizza…)"],
  ["Indienne", "Tradition culinaire indienne (currys, épices…)"],
  ["Libanaise / Orientale", "Cuisine libanaise ou moyen-orientale (mezze, houmous…)"],
  ["Mexicaine", "Cuisine mexicaine ou tex-mex"],
  ["Asiatique", "Cuisine d'Asie de l'Est ou du Sud-Est (chinoise, japonaise, thaïe…)"],
  ["Africaine", "Cuisine du continent africain (maghrébine, subsaharienne…)"],
  ["Américaine", "Cuisine nord-américaine (burgers, BBQ, brunch…)"],
  ["Méditerranéenne", "Cuisine méditerranéenne (huile d'olive, légumes du soleil, grillades…)"],
  ["Nordique", "Cuisine scandinave ou d'Europe du Nord"],
  ["Rapide", "Prête en 30 minutes ou moins, préparation et cuisson comprises"],
  ["En batch", "Se prête au batch cooking et aux grandes quantités"],
  ["Repas de fête", "Adaptée aux grandes occasions et repas festifs"],
  ["Pique-nique", "Se transporte facilement et se mange froide"],
  ["Lunchbox", "Adaptée à une gamelle, froide ou réchauffée, pour le déjeuner"],
  ["Pas cher", "Ingrédients économiques et courants"],
  ["Facile", "Peu de technique, accessible aux débutants"],
  ["One-pot", "Se cuisine entièrement dans un seul récipient"],
  ["Sans cuisson", "Aucune cuisson nécessaire"],
  ["Pour les enfants", "Plaît généralement aux enfants"],
  ["À congeler", "Se congèle et se réchauffe bien"],
];

const IMAGE_PROMPT_INSTRUCTION = `Décris visuellement le plat terminé en anglais (pour un générateur d'images). Sois précis sur la présentation, les couleurs, l'angle de vue. Si la recette liste des ingrédients, ne représente QUE les ingrédients, garnitures et accompagnements listés — n'ajoute aucun aliment, ingrédient, herbe, feuille verte, sauce ou décoration non mentionné, et ne suggère pas de garniture "pour la présentation". EXCEPTION : si aucun ingrédient n'est listé (par exemple seulement un titre), imagine librement une version classique et appétissante du plat d'après son nom.`;

const ENRICH_SYSTEM_PROMPT = `Tu es un assistant culinaire expert. Analyse la recette et retourne un JSON structuré.

TAGS — choisis uniquement parmi cette liste, en respectant strictement la définition de chaque tag :
${PREDEFINED_TAGS.map(([n, d]) => `- ${n} : ${d}`).join("\n")}

Règles d'attribution des tags :
- N'assigne un tag que s'il est factuellement vrai pour cette recette, d'après sa définition et les ingrédients listés.
- Les tags de régime alimentaire (Végétarien, Végan, Sans gluten, Sans lactose) sont binaires : à poser uniquement si TOUS les ingrédients satisfont strictement la définition, jamais par défaut ni approximativement.
- La plupart des recettes ont 3 à 5 tags (maximum 10). Si trop de tags s'appliquent, garde les plus informatifs — ne sacrifie jamais un tag de régime ou de protéine, réduis d'abord parmi Occasion et Caractéristiques.

SEASONS — valeurs possibles : ${VALID_SEASONS.join(", ")}
PREP TIME — valeurs possibles : ${VALID_PREP_TIMES.join(", ")}
COOK TIME — valeurs possibles : ${VALID_COOK_TIMES.join(", ")}
COST — valeurs possibles : ${VALID_COST_LEVELS.join(", ")}
COMPLEXITY — valeurs possibles : ${VALID_COMPLEXITY_LEVELS.join(", ")}
SERVINGS — nombre de personnes pour lequel la recette est prévue (entier 1 à 20) : uniquement si la recette l'indique explicitement ou si les quantités le rendent évident ; sinon null — n'invente jamais de nombre.

IMAGE PROMPT — ${IMAGE_PROMPT_INSTRUCTION}

Réponds UNIQUEMENT avec le JSON structuré, sans texte supplémentaire.`;

const ENRICH_JSON_SCHEMA = {
  name: "enrichment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string" }, maxItems: 10 },
      seasons: { type: "array", items: { type: "string", enum: [...VALID_SEASONS] } },
      prepTime: { type: "string", enum: [...VALID_PREP_TIMES] },
      cookTime: { type: "string", enum: [...VALID_COOK_TIMES] },
      cost: { type: "string", enum: [...VALID_COST_LEVELS] },
      complexity: { type: "string", enum: [...VALID_COMPLEXITY_LEVELS] },
      servings: { type: ["integer", "null"] },
      imagePrompt: { type: "string" },
    },
    required: ["tags", "seasons", "prepTime", "cookTime", "cost", "complexity", "servings", "imagePrompt"],
    additionalProperties: false,
  },
};

// Recettes structurées pour le bench d'enrichissement (entrées déterministes).
const ENRICH_RECIPES = [
  {
    slug: "ratatouille",
    title: "Ratatouille",
    ingredients: "350 g d'aubergines\n350 g de courgettes\n350 g de poivrons\n350 g d'oignons\n500 g de tomates\n6 cuillères à soupe d'huile d'olive\n2 gousses d'ail\n1 brin de thym\n1 feuille de laurier\nsel\npoivre",
    steps: "Coupez les légumes en morceaux.\nFaites revenir les oignons dans l'huile d'olive.\nAjoutez les poivrons puis les aubergines et les courgettes.\nAjoutez les tomates, l'ail, le thym et le laurier.\nLaissez mijoter 45 minutes à feu doux.\nSalez et poivrez.",
  },
  {
    slug: "saumon-teriyaki",
    title: "Saumon teriyaki au riz",
    ingredients: "4 pavés de saumon\n10 cl de sauce soja\n2 cuillères à soupe de miel\n1 gousse d'ail\ngingembre frais\n300 g de riz\ngraines de sésame\n2 oignons nouveaux",
    steps: "Mélangez la sauce soja, le miel, l'ail et le gingembre râpés.\nFaites mariner le saumon 20 minutes.\nFaites cuire le riz.\nSaisissez le saumon à la poêle 3 minutes par face en arrosant de marinade.\nServez sur le riz, parsemé de sésame et d'oignons nouveaux.",
  },
  {
    slug: "houmous",
    title: "Houmous maison",
    ingredients: "400 g de pois chiches cuits\n2 cuillères à soupe de tahini\n1 citron\n1 gousse d'ail\n4 cuillères à soupe d'huile d'olive\ncumin\nsel",
    steps: "Mixez les pois chiches avec le tahini, le jus de citron et l'ail.\nAjoutez l'huile d'olive progressivement jusqu'à obtenir une texture lisse.\nAssaisonnez avec le cumin et le sel.\nServez avec un filet d'huile d'olive.",
  },
];

// ---------- Appels API ----------

// reasoning_effort : les gpt-5.x raisonnent par défaut ; pour de l'extraction
// JSON on veut l'effort minimal. La valeur acceptée varie selon la génération —
// on essaie dans l'ordre et on retient la première acceptée.
// « none » d'abord : le 2026-09-02, Luna a basculé de la gamme minimal/… à la
// gamme none/low/…/xhigh en cours de journée.
const EFFORT_CANDIDATES = ["none", "minimal", "low"];
const effortByModel = new Map();

function isReasoningModel(model) {
  return model.startsWith("gpt-5");
}

async function postJson(url, body) {
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const ms = Date.now() - started;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, ms };
}

// ---------- Google Gemini ----------

// Le responseSchema de Gemini est un sous-ensemble du JSON Schema d'OpenAI :
// pas de `additionalProperties`, pas de type union — un champ nullable se
// déclare avec `nullable: true`, et un enum nullable ne doit pas porter `null`
// dans sa liste de valeurs. `propertyOrdering` fige l'ordre des clés (Gemini le
// recommande pour la stabilité des sorties).
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== "object") return node;

  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "additionalProperties" || k === "strict") continue;
    if (k === "type" && Array.isArray(v)) {
      const types = v.filter((t) => t !== "null");
      out.type = types[0];
      if (v.includes("null")) out.nullable = true;
      continue;
    }
    if (k === "enum" && Array.isArray(v)) {
      const values = v.filter((e) => e !== null);
      out.enum = values;
      if (v.includes(null)) out.nullable = true;
      continue;
    }
    if (k === "properties") {
      out.properties = Object.fromEntries(
        Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)]),
      );
      out.propertyOrdering = Object.keys(v);
      continue;
    }
    out[k] = toGeminiSchema(v);
  }
  return out;
}

/** Traduit les messages façon OpenAI en `systemInstruction` + `contents`. */
function toGeminiContents(messages) {
  let systemInstruction = null;
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = { parts: [{ text: m.content }] };
      continue;
    }
    const parts = [];
    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else {
      for (const part of m.content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image_url") {
          const [, mimeType, data] = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
          parts.push({ inlineData: { mimeType, data } });
        }
      }
    }
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  return { systemInstruction, contents };
}

/** Usage → tokens comparables à OpenAI (les tokens de pensée sont facturés en sortie). */
function geminiUsage(model, usage = {}) {
  const inTok = usage.promptTokenCount ?? 0;
  const thinkTok = usage.thoughtsTokenCount ?? 0;
  const outTok = (usage.candidatesTokenCount ?? 0) + thinkTok;
  const p = TOKEN_PRICING[model] ?? { input: 0, output: 0 };
  return {
    inputTokens: inTok,
    outputTokens: outTok,
    reasoningTokens: thinkTok,
    costUsd: (inTok * p.input + outTok * p.output) / 1e6,
  };
}

async function geminiGenerate(model, body) {
  const started = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    },
  );
  const ms = Date.now() - started;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, ms };
}

async function callGeminiChat(model, messages, jsonSchema, label) {
  const { systemInstruction, contents } = toGeminiContents(messages);
  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(jsonSchema.schema),
    },
  };

  let lastErr = null;
  // 3 tentatives : les crédits fraîchement provisionnés renvoient encore des
  // 429 intermittents, et l'API renvoie des 5xx passagers sous charge.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { ok, status, json, ms } = await geminiGenerate(model, body);
    if (ok) {
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      let parsed = null;
      let parseError = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parseError = String(e);
      }
      return {
        label, model, effort: null, ms,
        ...geminiUsage(model, json.usageMetadata),
        output: parsed, parseError,
        finishReason: json.candidates?.[0]?.finishReason ?? null,
      };
    }
    lastErr = json?.error?.message ?? `HTTP ${status}`;
    if (status === 429 || status >= 500) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    break;
  }
  return { label, model, error: lastErr };
}

/** Transcription Gemini : l'audio passe en inlineData sur generateContent. */
async function callGeminiTranscribe(model, filePath, durationSec) {
  const buf = await readFile(filePath);
  const body = {
    contents: [{
      role: "user",
      parts: [
        // Même contrat que l'API transcription d'OpenAI : texte brut, pas de
        // traduction, pas de commentaire — sinon la comparaison de WER est faussée.
        { text: "Transcris intégralement et fidèlement cet enregistrement audio. Conserve la langue parlée. Ne traduis pas, n'ajoute aucun commentaire, ne corrige pas les hésitations : renvoie uniquement le texte transcrit." },
        { inlineData: { mimeType: "audio/mp4", data: buf.toString("base64") } },
      ],
    }],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { ok, status, json, ms } = await geminiGenerate(model, body);
    if (ok) {
      // gemini-3.5-transcribe ne renvoie pas `parts[].text` mais
      // `parts[].audioTranscription.text` — on accepte les deux formes.
      const text = (json.candidates?.[0]?.content?.parts
        ?.map((p) => p.audioTranscription?.text ?? p.text ?? "")
        .join("") ?? "").trim();
      const u = geminiUsage(model, json.usageMetadata);
      return { model, ms, text, costUsd: u.costUsd, inputTokens: u.inputTokens, outputTokens: u.outputTokens };
    }
    if (status === 429 || status >= 500) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    return { model, error: json?.error?.message ?? `HTTP ${status}` };
  }
  return { model, error: "retries exhausted" };
}

async function callOpenAiChat(model, messages, jsonSchema, label) {
  const base = {
    model,
    response_format: { type: "json_schema", json_schema: jsonSchema },
    messages,
  };
  const efforts = isReasoningModel(model)
    ? effortByModel.has(model) ? [effortByModel.get(model)] : EFFORT_CANDIDATES
    : [undefined];

  let lastErr = null;
  for (const effort of efforts) {
    const body = effort ? { ...base, reasoning_effort: effort } : base;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { ok, status, json, ms } = await postJson("https://api.openai.com/v1/chat/completions", body);
      if (ok) {
        if (effort) effortByModel.set(model, effort);
        const usage = json.usage ?? {};
        const inTok = usage.prompt_tokens ?? 0;
        const outTok = usage.completion_tokens ?? 0;
        const reasoningTok = usage.completion_tokens_details?.reasoning_tokens ?? 0;
        const p = TOKEN_PRICING[model] ?? { input: 0, output: 0 };
        let parsed = null;
        let parseError = null;
        try {
          parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "");
        } catch (e) {
          parseError = String(e);
        }
        return {
          label, model, effort: effort ?? null, ms,
          inputTokens: inTok, outputTokens: outTok, reasoningTokens: reasoningTok,
          costUsd: (inTok * p.input + outTok * p.output) / 1e6,
          output: parsed, parseError,
        };
      }
      const message = json?.error?.message ?? `HTTP ${status}`;
      // Paramètre d'effort refusé → candidat suivant, sans retry.
      if (status === 400 && /reasoning[._ ]?effort/i.test(message)) {
        lastErr = message;
        break;
      }
      lastErr = message;
      if (status === 429 || status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  return { label, model, error: lastErr };
}

/** Point d'entrée unique : route vers le provider d'après le nom du modèle. */
function callChat(model, messages, jsonSchema, label) {
  return providerOf(model) === "google"
    ? callGeminiChat(model, messages, jsonSchema, label)
    : callOpenAiChat(model, messages, jsonSchema, label);
}

async function callOpenAiTranscribe(model, filePath, durationSec) {
  const buf = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mp4" }), path.basename(filePath));
  form.append("model", model);
  form.append("response_format", "text");
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
      signal: AbortSignal.timeout(180000),
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      return {
        model, ms: Date.now() - started, text,
        costUsd: (durationSec / 60) * (TRANSCRIBE_PRICING_PER_MIN[model] ?? 0),
      };
    }
    const errText = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return { model, error: `HTTP ${res.status} ${errText.slice(0, 300)}` };
  }
  return { model, error: "retries exhausted" };
}

function callTranscribe(model, filePath, durationSec) {
  return providerOf(model) === "google"
    ? callGeminiTranscribe(model, filePath, durationSec)
    : callOpenAiTranscribe(model, filePath, durationSec);
}

function audioDurationSec(filePath) {
  const out = execFileSync("afinfo", [filePath], { encoding: "utf8" });
  const m = out.match(/estimated duration: ([\d.]+) sec/);
  return m ? parseFloat(m[1]) : 0;
}

// Petit limiteur de concurrence (4 appels en vol max).
function pLimit(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
const limit = pLimit(4);

// ---------- Cas de test ----------

async function benchText() {
  const cases = [];
  for (const slug of ["marmiton-ratatouille", "cuisineaz-sauce-pommes", "750g-tarte-pommes"]) {
    const text = await readFile(path.join(FIX, "text", `${slug}.txt`), "utf8");
    cases.push({ slug, userContent: `Extrais la recette depuis ce contenu :\n\n${text}` });
  }
  const insta = await readFile(path.join(FIX, "text", "insta-caption.txt"), "utf8");
  cases.push({ slug: "insta-caption", userContent: `Extrais la recette depuis ce contenu :\n\n${insta}` });
  for (const slug of ["voice-fr-hesitations", "voice-pt-caldo"]) {
    const t = await readFile(path.join(FIX, "text", `${slug}.txt`), "utf8");
    cases.push({
      slug,
      userContent: `Extrais la recette depuis cette transcription orale. Attention : peut contenir des hésitations, répétitions, ou corrections ('ah non, 200g pas 300') — utilise toujours la dernière valeur donnée :\n\n${t}`,
    });
  }

  const runs = [];
  for (const c of cases) {
    for (const model of TEXT_MODELS) {
      runs.push(limit(async () => {
        const r = await callChat(model, [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: c.userContent },
        ], IMPORT_JSON_SCHEMA, c.slug);
        console.log(`text ${c.slug} × ${model} — ${r.error ? "ERREUR " + r.error : `${r.ms}ms, ${r.inputTokens}in/${r.outputTokens}out (${r.reasoningTokens} raisonnement), $${r.costUsd?.toFixed(5)}`}`);
        return r;
      }));
    }
  }
  return Promise.all(runs);
}

async function benchOcr() {
  const runs = [];
  for (const slug of ["marmiton-ratatouille", "cuisineaz-sauce-pommes", "750g-tarte-pommes"]) {
    const images = [];
    for (const n of [1, 2]) {
      const buf = await readFile(path.join(FIX, "images", `${slug}-${n}.png`));
      images.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${buf.toString("base64")}` },
      });
    }
    for (const model of OCR_MODELS) {
      runs.push(limit(async () => {
        const r = await callChat(model, [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [{ type: "text", text: "Extrais la recette de cette/ces image(s) :" }, ...images],
          },
        ], IMPORT_JSON_SCHEMA, slug);
        console.log(`ocr ${slug} × ${model} — ${r.error ? "ERREUR " + r.error : `${r.ms}ms, ${r.inputTokens}in/${r.outputTokens}out (${r.reasoningTokens} raisonnement), $${r.costUsd?.toFixed(5)}`}`);
        return r;
      }));
    }
  }
  return Promise.all(runs);
}

async function benchAudio() {
  const runs = [];
  for (const slug of ["voice-fr-hesitations", "voice-fr-simple", "voice-pt-caldo"]) {
    const file = path.join(FIX, "audio", `${slug}.m4a`);
    const duration = audioDurationSec(file);
    const reference = await readFile(path.join(FIX, "text", `${slug}.txt`), "utf8");
    for (const model of TRANSCRIBE_MODELS) {
      runs.push(limit(async () => {
        const r = await callTranscribe(model, file, duration);
        console.log(`audio ${slug} × ${model} — ${r.error ? "ERREUR " + r.error : `${r.ms}ms, $${r.costUsd?.toFixed(5)}`}`);
        return { label: slug, durationSec: duration, reference, ...r };
      }));
    }
  }
  return Promise.all(runs);
}

async function benchEnrich() {
  const runs = [];
  for (const recipe of ENRICH_RECIPES) {
    const userContent = `Titre: ${recipe.title}\nIngrédients:\n${recipe.ingredients}\nPréparation:\n${recipe.steps}`;
    for (const model of TEXT_MODELS) {
      runs.push(limit(async () => {
        const r = await callChat(model, [
          { role: "system", content: ENRICH_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ], ENRICH_JSON_SCHEMA, recipe.slug);
        console.log(`enrich ${recipe.slug} × ${model} — ${r.error ? "ERREUR " + r.error : `${r.ms}ms, ${r.inputTokens}in/${r.outputTokens}out (${r.reasoningTokens} raisonnement), $${r.costUsd?.toFixed(5)}`}`);
        return r;
      }));
    }
  }
  return Promise.all(runs);
}

// ---------- Main ----------
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
await mkdir(OUT, { recursive: true });

const results = {};
if (!only || only === "text") results.text = await benchText();
if (!only || only === "ocr") results.ocr = await benchOcr();
if (!only || only === "audio") results.audio = await benchAudio();
if (!only || only === "enrich") results.enrich = await benchEnrich();

const outFile = path.join(OUT, only ? `results-${only}.json` : "results.json");
await writeFile(outFile, JSON.stringify(results, null, 2));

// Récap coûts par tâche × modèle.
for (const [task, runs] of Object.entries(results)) {
  const byModel = {};
  for (const r of runs) {
    if (r.error) continue;
    byModel[r.model] ??= { calls: 0, usd: 0, ms: 0 };
    byModel[r.model].calls++;
    byModel[r.model].usd += r.costUsd ?? 0;
    byModel[r.model].ms += r.ms ?? 0;
  }
  console.log(`\n=== ${task}`);
  for (const [m, s] of Object.entries(byModel)) {
    console.log(`  ${m}: ${s.calls} appels, $${s.usd.toFixed(4)}, ${(s.ms / s.calls / 1000).toFixed(1)}s/appel en moyenne`);
  }
}
console.log(`\nRésultats bruts : ${outFile}`);
