# Pré-lot — Harnais E2E + préparation Universal Links

> Lire d'abord `00-socle.md`. Ce lot ne change **aucun comportement produit**
> (seuls ajouts : chemins Universal Links, additifs). Son livrable principal est le
> filet de sécurité qui remplace le test manuel pour tous les lots suivants.

## Objectif

1. Un environnement de test local reproductible : **Supabase local + `next dev` +
   Playwright**, lançable en une commande.
2. Une suite de **tests de caractérisation** du comportement actuel : ils décrivent
   l'existant et devront rester verts, inchangés, à travers le refactor du Lot 0.
3. Préparer la propagation des Universal Links `/recover` (AASA + manifest Android)
   pour que tout soit en place bien avant le Lot 2.

## 1. Environnement local

- `supabase init` si absent (il n'y a pas de `supabase/config.toml` aujourd'hui —
  les migrations existent déjà dans `supabase/migrations/` et doivent s'appliquer
  telles quelles via `supabase db reset`).
- `.env.test.local` (gitignoré) + exemple versionné `.env.test.example` : les mêmes
  clés que `.env.local` mais pointant sur le Supabase local (URL + clés locales
  imprimées par `supabase start`), `SESSION_SIGNING_SECRET` de test, Redis :
  **vérifier le comportement sans Upstash** — le middleware et les rate-limits sont
  fail-open, sinon pointer un Redis local ou laisser les vars vides selon ce que le
  code tolère (à vérifier en implémentant, `src/lib/redis*`).
- Script de seed `scripts/seed-e2e.mjs` (service role local) : crée le foyer démo
  (+ `DEMO_HOUSEHOLD_ID` correspondant dans `.env.test.local`) et 2-3 recettes seed.
- Scripts npm : `test:e2e` (playwright test), `test:e2e:ui`. Un `globalSetup`
  Playwright vérifie que Supabase local tourne et que le seed est appliqué.
- **Flows IA exclus** du harnais (import URL/photo/voix → OpenAI/Apify) : trop de
  dépendances externes. La création de recette testée = saisie manuelle
  (`RecipeForm` mode create).

## 2. Helpers de test

- `e2e/helpers/db.ts` : client Supabase service role (local) pour préparer/asserter
  l'état et lire les secrets (plus tard : codes de récup). **Jamais** d'appel réseau
  externe dans les tests.
- `e2e/helpers/onboarding.ts` : `createHouseholdViaUI(page, name)`,
  `joinViaCode(page, code)` — les tests suivants s'appuient dessus.
- Chaque test = contexte navigateur isolé (cookies propres). Les scénarios à deux
  appareils utilisent deux `browser.newContext()`.

## 3. Tests de caractérisation (comportement ACTUEL)

À écrire contre l'existant, sans rien modifier. Liste minimale :

1. **Onboarding créer** : landing → « Créer un foyer » → nom → arrive sur `/home`,
   cookie posé, bannière post-création avec code.
2. **Onboarding rejoindre** : contexte B rejoint avec le code du foyer créé en A
   (saisie tolérante : minuscules/espaces) → `/home` du même foyer.
3. **Rejoindre par lien** : `/join/[code]` → confirmation → membre du foyer.
4. **Recette manuelle** : créer via le formulaire → visible sur home + biblio ;
   éditer le titre ; supprimer (dialog de confirmation) → disparue.
5. **Biblio + filtres** : recherche texte, un filtre tag, filtre « De saison »,
   état reflété dans l'URL.
6. **Partage** : fiche → partager → mint du `share_token` (lire en DB), la page
   publique `/r/[token]` s'affiche sans cookie ; « copier » depuis un autre foyer
   via `POST /api/recipes/copy` (ou le flow UI) → recette copiée.
7. **Écran foyer** : rename inline, code + lien affichés ; quitter le foyer →
   retour landing, cookie invalidé ; supprimer le foyer (double confirmation).
8. **Démo** : « Essayer l'app » → home démo, bannière démo visible, rename foyer
   impossible (readOnly), suppression du foyer refusée (403 → message).
9. **Auth guard** : accès `/home` sans cookie → redirigé landing ; route API
   protégée sans cookie → 401.

Chacun de ces tests est un **contrat** : le Lot 0 doit les laisser verts sans les
modifier (seule exception tolérée : un sélecteur cassé par un changement de DOM non
fonctionnel — à justifier dans la PR).

## 4. Universal Links `/recover` (préparation, additif)

- `src/app/api/aasa/route.ts` : ajouter `{ "/": "/recover/*", comment: "Access recovery magic links" }`
  aux `components`. Déployé = la propagation Apple CDN démarre (aucune release iOS,
  l'entitlement est domain-wide et déjà dans l'app publiée).
- `android/app/src/main/AndroidManifest.xml` : ajouter les `<data ... pathPrefix="/recover" />`
  pour les deux hosts, à côté de `/r/` et `/join/`. Anthony déclenchera un build
  Play (alpha) quand ça l'arrange — non bloquant pour le web. Au passage ce build
  embarquera la suppression de `@capacitor/action-sheet` (déjà retirée du JS).
- `src/app/api/assetlinks/route.ts` : vérifier qu'aucun changement n'est requis
  (les App Links Android se déclarent par manifest, pas par assetlinks).
- Pas encore de route `/recover` côté Next : un chemin AASA vers une 404 est sans
  effet. La route arrive au Lot 2.

## Hors périmètre

- Toute modification du comportement produit, du schéma DB, de l'auth.
- CI GitHub Actions pour les E2E (local uniquement pour l'instant ; à reconsidérer
  une fois la stabilité du harnais prouvée).

## Definition of Done

- `supabase start` + seed + `npm run dev` + `npm run test:e2e` documentés dans un
  `e2e/README.md` court et reproductibles de zéro.
- Les 9+ tests de caractérisation passent de façon **stable** (3 runs consécutifs).
- AASA + manifest mis à jour, déployés sur staging.
- DoD commune du socle (tsc/lint/vitest, statut mis à jour).
