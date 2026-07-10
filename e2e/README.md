# Tests E2E — harnais Playwright + Supabase local

Filet de non-régression du chantier foyer (#14 + #15) : des **tests de
caractérisation** décrivent le comportement actuel et doivent rester verts,
inchangés, à travers les refactors (cf. `docs/specs/foyer/01-pre-lot-harnais.md`).

## Mise en route (de zéro)

Prérequis : un runtime Docker (colima, Docker Desktop…) démarré.

```bash
cp .env.test.example .env.test.local   # les clés Supabase locales seront remplies par le setup
npm run test:e2e:setup                 # Supabase local + Redis local + clés + seed (idempotent)
npm run test:e2e                       # lance la suite (démarre son propre next dev :3100)
```

`npm run test:e2e:ui` ouvre le mode UI de Playwright. `node scripts/e2e-setup.mjs --reset`
ré-applique les migrations sur une base vidée avant de re-seeder.

## Ce que fait le setup

- **Supabase local** (`supabase start`, config `supabase/config.toml`) : les
  migrations `supabase/migrations/` s'appliquent telles quelles. Le seed SQL de
  prod (`supabase/seed.sql`) est désactivé au profit de `scripts/seed-e2e.mjs`
  (bucket `recipe-photos`, foyer démo `DEMO-0000`, 3 recettes seed).
- **Redis local derrière un proxy REST compatible Upstash** (conteneurs
  `mijote-e2e-redis` + `mijote-e2e-srh`, port 8079). Nécessaire : les routes
  join/lookup ne sont **pas** fail-open — sans Redis joignable elles renvoient 500.
- Le `globalSetup` Playwright vérifie que tout tourne et **flush Redis** à
  chaque run (sinon les rate-limits par IP rendent les runs consécutifs non
  reproductibles).

## Choix de conception

- **L'environnement vient exclusivement de `.env.test.local`** : Playwright
  passe ces variables au `next dev` qu'il démarre ; comme `@next/env` n'écrase
  jamais une variable déjà définie, rien ne fuite de `.env.local` (les clés
  sensibles sont épinglées à des valeurs factices dans `e2e/helpers/env.ts`).
- **Serveur dédié port 3100, build dans `.next-e2e`** (`NEXT_DIST_DIR`) : ne
  cohabite pas avec un `next dev` de travail sur `.next`.
- **Flows IA exclus** (import URL/photo/voix) : clé OpenAI factice — la
  création de recette testée est la saisie manuelle ; l'enrichissement échoue
  en tâche de fond (log `invalid_api_key` attendu), sans impact UI.
- **Aucun email réel** : `RESEND_API_KEY` épinglée à vide → le transport de
  `src/lib/email/send.ts` est no-op. Les secrets de récup (#14) étant hashés
  en DB, les tests les REMPLACENT par des valeurs connues
  (`overrideLatestLoginToken` de `e2e/helpers/db.ts`) pour jouer les flows
  code/magic-link à travers la vraie logique serveur.
- **Un « visiteur » = un contexte navigateur isolé** avec une IP simulée unique
  (header `x-forwarded-for`) pour ne pas partager les rate-limits par IP
  (`e2e/helpers/onboarding.ts`).
- **1 worker** : les tests partagent la base ; la stabilité prime sur la durée
  (~20 s la suite).

## Contrat de caractérisation

Les specs `01`–`09` couvrent : onboarding créer/rejoindre (+ lien), recette
manuelle (CRUD), biblio + filtres (état dans l'URL), partage `/r/[token]` +
copie, écran foyer (rename/quitter/supprimer), démo (lecture seule), garde
d'auth. **Le Lot 0 doit les laisser verts sans les modifier** (seule exception :
un sélecteur cassé par un changement de DOM non fonctionnel, à justifier en PR).

Notes de caractérisation (comportement constaté, pas forcément souhaité) :

- La recherche texte de la biblio est locale, **pas** reflétée dans l'URL
  (contrairement aux filtres).
- Une API protégée sans cookie renvoie un **redirect 307 vers `/`** (middleware),
  pas un 401 — le 401 de `withHouseholdAuth` n'est pas observable via HTTP.
