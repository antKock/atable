# Lot 2 — IA et données (livré sur staging le 2026-09-04)

> Contexte et décisions : `00-socle.md` (décision 2 : les recettes gardent leur
> langue source ; décision 4 : tags en clé canonique FR).

## Fait

- **Prompt d'extraction** (`src/lib/import.ts`, `EXTRACTION_SYSTEM_PROMPT`) :
  « retourne un JSON structuré en français » remplacé par une consigne de langue
  explicite — title/ingredients/steps/notes dans la langue de la source, jamais
  traduits ; valeurs énumérées (temps, coût, difficulté, saisons) = codes
  inchangés quelle que soit la langue ; titre jamais tout en capitales, casse
  habituelle de la langue (FR : première majuscule ; EN : Title Case).
- **Prompt d'enrichissement** (`src/lib/enrichment.ts`) : précise que la recette
  peut être dans n'importe quelle langue et que les tags/valeurs énumérées sont
  des codes FR à reprendre tels quels. L'image prompt était déjà demandé en
  anglais. Whisper auto-détectait déjà la langue (inchangé).
- **Libellés des 48 tags prédéfinis** (migration 004) : `t.tagNames` (FR =
  identité, EN traduit), helper `tagLabel(t, name)` appliqué dans la fiche
  (`RecipeView`), les filtres (`FilterBar`) et la saisie (`TagInput`, y compris
  la recherche : « veg » trouve « Végétarien » via « Vegetarian »). Les tags
  libres s'affichent tels quels. Base de données inchangée.

## Vérification du prompt (banc temporaire, non versionné)

gpt-5.6-luna `reasoning_effort: none`, ancien vs nouveau prompt, sur les 7
fixtures texte de `scripts/bench/fixtures/text/` (FR + PT) et 2 recettes
anglaises (blog, légende Instagram), 3 répétitions sur les cas sensibles :

- FR : titres identiques, comptes d'ingrédients/étapes et valeurs énumérées
  qui varient de ±1 **dans les deux sens et avec les deux prompts** (bruit du
  modèle, pas d'effet du prompt).
- L'ancien prompt gardait déjà l'anglais en pratique (le modèle ne traduisait
  pas malgré « en français ») : le nouveau explicite le comportement voulu.
- Effet de bord corrigé en cours de route : une première formulation « casse
  de phrase » abaissait les titres anglais (« 15-minute garlic shrimp pasta ») ;
  la formulation finale rend « 15-Minute Garlic Shrimp Pasta » et « Pâtes à la
  crème de courgettes » (source en capitales) — 3/3 stables.

Coût du banc : ~40 appels, < 0,05 $.

## Hors périmètre

- Le bench versionné `scripts/bench/bench-models.mjs` garde sa copie de
  l'ancien prompt (modifs locales d'Anthony en attente, non touchées) : à
  resynchroniser à la prochaine campagne.
