# Lot 1 — Interface (livré sur staging le 2026-09-04)

> Contexte et décisions : `00-socle.md`. Ce document décrit ce qui a été fait et
> les conventions à respecter pour toute nouvelle chaîne.

## Fait

- **73 imports statiques** `import { t } from "@/lib/i18n/fr"` migrés : `useT()`
  (client), `await getT()` (Server Components / routes API / libs serveur).
  Les composants partagés client ↔ serveur (`RecipeCard`, `RecipeCarousel`,
  `RecipeView`, `RolePill`, `BackCircleButton`, `RecipeReminderCard`) sont
  passés `"use client"` + `useT()` — obligatoire aussi pour leurs tests RTL
  (un composant async ne se rend pas en jsdom ; hors provider, `useT()` retombe
  sur `fr`, ce qui garde les tests inchangés).
- **Chaînes en dur extraites** : titres des écrans création/code, actes du
  formulaire (`L'essentiel`/`Les détails`, `requis`/`optionnel`), phrases de
  chargement d'import, placeholders, messages d'erreur des routes API
  (`t.api.*`), messages zod (`t.validation.*`, schémas devenus des factories
  `buildXSchema(t)` avec constantes FR par défaut), emails de récupération
  (`t.email.*`, `renderRecoveryEmail(payload, t, lang)`).
- **Valeurs stockées → libellés** (`src/lib/i18n/labels.ts`) : coût
  `€/€€/€€€` → `$/$$/$$$` en EN, temps de cuisson `Aucune` → `None`, complexité
  `facile/moyen/difficile` → `Easy/Medium/Hard`. Catégories de tags : clés =
  valeurs canoniques FR de `tags.category`, libellés dans `t.tagCategories`.
- **Alias** : `aliasForOwner(id, locale)` — listes EN « Adjective Animal »
  (`Curious Fox`). L'alias stocké à la création d'un owner prend la langue du
  créateur (c'est un pseudo-nom, identique pour tous) ; le repli d'affichage
  prend la langue du lecteur.
- **Catalogue de carrousels** : `buildCarouselCatalog(t)` ; `CAROUSEL_CATALOG`
  (FR figé) ne sert plus qu'au script `spec9-compare-carousels.ts`.
- `getLocale()` retombe sur `fr` hors portée de requête (handlers appelés
  directement en vitest) — aucun mock nécessaire dans les tests de routes.

## Conventions (à partir de maintenant)

1. Toute chaîne visible va dans `fr.ts` **et** `en.ts` (tsc refuse sinon).
2. Jamais `import { t } from "@/lib/i18n/fr"` hors tests, admin, scripts et
   défauts de schémas.
3. Une valeur stockée (enum) ne se traduit pas en base : on ajoute un libellé
   dans `labels.ts` ou une table `t.xxx` indexée par la valeur stockée.
4. Nouvelle route API : `const t = await getT()` en tête de handler.

## Hors périmètre du lot (traités plus loin)

- Prompts IA et libellés des tags prédéfinis (Lot 2).
- Démo EN, landing/support/légal/`/r`, `offline.html` (Lot 3).
- Codes d'erreur techniques (`rate_limit`, `extraction_failed`, `Unauthorized`,
  `Forbidden`, `Not found`) : mappés côté client ou jamais affichés — inchangés.

## Vérification

tsc, lint, 585 unitaires, 49/49 E2E ; captures Playwright iPhone 13 en EN :
landing, création, code, hub, profil, home démo, bibliothèque, fiche recette,
sélecteur d'import, formulaire manuel (haut/bas), états vides.
