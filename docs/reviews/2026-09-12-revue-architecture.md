# Revue d'architecture du 2026-09-12 — actions recommandées

> **Pour la session qui exécute ce plan.** Anthony ne relira ni ne testera rien : chaque
> lot doit être **entièrement vérifié par toi** avant d'être poussé sur `staging`, et validé
> en réel sur staging avant de demander le go prod. Il ne donnera que le go pour la
> promotion `staging → main`. Lis d'abord `CLAUDE.md`, puis la section « Protocole »
> ci-dessous : elle n'est pas optionnelle.

Contexte : revue faite le soir de la migration Supabase → VPS (base + photos + Redis sur le
VPS OVH, cf. `docs/infra/migration-supabase-vps.md`). Quatre passes (API/auth, accès
données, UI, pipeline IA/outillage) + vérification manuelle des points lourds. Base saine et
bien documentée ; le problème est la **répétition** (les bonnes primitives existent, elles ne
sont pas composées) et l'**absence de typage de la base**. Le coût de développement étant
nul, le seul critère est le **risque de régression** : tout ce qui suit est classé par
valeur, avec le risque, et l'ordre recommandé tient compte des deux.

## Protocole obligatoire (chaque lot)

1. **Une PR par lot**, petite, sur `staging`. Jamais deux lots dans un commit. Message de
   commit en français, style du repo (`Zone — quoi (pourquoi)`).
2. **Ne jamais `git add -A`** : une autre session Claude peut travailler dans le même
   working tree. `git add <fichiers précis>`. Vérifier `git status` avant de commiter et
   ne commiter que ses fichiers.
3. Avant chaque push, dans cet ordre, tout vert :
   ```sh
   npx tsc --noEmit
   npm run lint            # 0 erreur ; ne pas ajouter de warning
   npx vitest run          # 759+ tests
   npm run test:e2e:setup && npm run test:e2e   # 51+ E2E (stack locale : Supabase local + Redis)
   ```
   Un lot qui touche une route, une requête, un composant de formulaire ou l'auth **ajoute**
   des tests (unitaires et/ou E2E) qui échouent avant et passent après.
4. Après le push : attendre le workflow (`gh run watch`), vérifier
   `curl https://staging.mijote.anthonykocken.fr/api/version` = SHA poussé, puis les
   contrôles réels sur staging (section « Contrôles staging »), puis Sentry
   (`/organizations/antkock/issues/?statsPeriod=1h`, cf. mémoire `sentry-api-access`).
5. Migrations SQL : `node scripts/vps/migrate.mjs staging --dry-run` puis `staging`,
   contrôles, puis **prod seulement au moment du go** (`migrate.mjs prod`). Règle :
   migration AVANT le code pour les ajouts, APRÈS pour les suppressions.
6. Demander le go à Anthony avec : liste des PR, ce qui a été vérifié, ce qui reste.
   Promotion = `gh pr create --base main --head staging` + `gh pr merge --admin`
   (compte gh **antKock**), puis vérifier `/api/version` en prod et Sentry 30 min après.
7. Mettre à jour `docs/` (ce fichier : cocher les cases), le vault Obsidian
   (`Historique & Décisions.md`) et la mémoire à chaque lot livré.

### Contrôles staging (après chaque déploiement)

```sh
B=https://staging.mijote.anthonykocken.fr; J=/tmp/c.txt; rm -f $J
curl -s -c $J -b $J -o /dev/null -w 'demo %{http_code}\n' -X POST $B/api/demo/session -H 'content-type: application/json' -d '{}'
curl -s -b $J -o /dev/null -w 'recipes %{http_code}\n' $B/api/recipes
curl -s -b $J -o /dev/null -w 'home %{http_code}\n' $B/home
curl -s -b $J -o /dev/null -w 'library %{http_code}\n' $B/library
# écriture réelle : foyer + recette + photo + suppression (voir docs/infra/migration-supabase-vps.md, journal du 2026-09-12)
```
Puis : `ssh mijote-vps 'C=$(sudo docker ps -q -f name=mijote-staging-ju2bg3 | head -1); sudo docker logs --since 10m $C 2>&1 | grep -iE "error|fail"'`.

---

## Lot 0 — Bugs et risques (une PR, à faire en premier)

Tous confirmés sur le code le 2026-09-12. Risque faible ou nul.

- [x] **Photos orphelines à la suppression d'une recette** — `src/app/api/recipes/[id]/route.ts:192-198` supprime la ligne sans purger S3. Extraire `purgeRecipePhotos(...)` dans `src/lib/storage/photos.ts` et l'appeler depuis DELETE recette, `households/[id]/route.ts:145-162` et `admin/batch-enrich/route.ts:35-53` (les deux copies existantes). Test : DELETE appelle `remove` avec les deux chemins (photo + générée).
- [x] **Double facturation DALL-E** — `src/lib/enrichment.ts:326` et `:388/407` : `withRetry` entoure `generateAndUploadImage`, qui enregistre le coût (`:98`) avant l'upload (`:130`). Scinder génération / upload ; retenter l'upload seul. Test : un upload qui échoue puis réussit → un seul `images.generate`, une seule ligne `ai_costs`.
- [x] **Timeout OpenAI** — `src/lib/openai.ts:22` : `new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0 })` (`maxRetries: 0` pour ne pas doubler `withRetry`). Budget global ~55 s sur `extractRecipeFromUrl` (`src/lib/import.ts:533-565`), aligné sur le client (`ImportSelector.tsx:22` = 60 s).
- [x] **Limite de corps sur les routes publiques** — `households` POST, `households/join`, `recovery/{request,verify,consume}`, `demo/session`, `admin/batch-enrich` : brancher `rejectOversizedBody` (`src/lib/body-limit.ts:27`), aujourd'hui seulement dans `with-owner-auth.ts:86`. Voir aussi lot 2 (`withPublicRoute`).
- [x] **Rate limit sur `/api/demo/session`** — `src/app/api/demo/session/route.ts:9` : aucun. Ajouter un `Ratelimit` par IP dans `src/lib/redis.ts` (5/h, comme `householdCreateRateLimit`). Test : 6e appel → 429.
- [x] **Révocation ignorée sur les chemins additifs** — `households/route.ts:52-54` et `households/join/route.ts:66-68` résolvent l'owner depuis le cookie sans vérifier `revoked:<sid>` (Redis), contrairement à `recovery/consume/route.ts:58-61`. Extraire `resolveSessionOwnerFromCookie(request)` dans `src/lib/auth/` avec le contrôle, l'utiliser aux trois endroits. Risque moyen : tests unitaires + E2E 01/02/03.
- [x] **`.json()` sans `.catch`** (toast infini `Unexpected token '<'` sur une page d'erreur proxy) — `RecipeForm.tsx:359,395,399`, `ConfirmDeleteDialog.tsx:49`, `JoinConfirmation.tsx:33`, `TagInput.tsx:127`, `ImportSelector.tsx:109`, `useEnrichmentPolling.ts:50`. (Sera absorbé par `useApiMutation`, lot 3, mais corriger dès maintenant.)
- [x] **`IS_ANDROID` au niveau module** — `src/components/recipes/import/ScreenshotImporter.tsx:25`, lu dans le rendu `:293` : faux au prerender → désaccord d'hydratation Android. Passer en état initialisé dans un effet (`useState` + `useEffect`).
- [x] **Import capture d'écran sans `code` d'erreur** — `import/screenshot/route.ts:46,51` : le client (`ImportSelector.tsx:163-171`) ne mappe que par `code` → un 429 OpenAI affiche l'erreur générique. Toujours renvoyer `{ error, code }` sur les trois voies.
- [x] **Quota d'import consommé avant validation** — les trois routes `import/*` appellent `enforceImportQuota` avant de lire le corps. Inverser.
- [x] **Divers, nuls en risque** : messages en dur `'Not found'` (`households/[id]/members/[ownerId]/route.ts:65,116`) et messages zod bruts EN (`tags/route.ts:34,43`) à localiser ; comparaison de secret non constante dans `admin/batch-enrich/route.ts:13-17` (utiliser `timingSafeEqual` comme `cron-auth.ts:17`) ; retirer les `console.log` de `demo/session/route.ts:11,18,25,56,65` ; `activity/ping/route.ts:22-24` répond 401 sans foyer (le client purge le cookie) → 204 ; `/api/recipes/copy` sans rate limit (`copy/route.ts:37`) → réutiliser `shareRateLimit`.

## Lot 1 — Typage de la base (aucune requête modifiée)

- [x] Générer les types du schéma (`supabase gen types typescript --db-url …` via le tunnel
  `scripts/vps/tunnel.sh`, ou à partir du dump ; script npm `db:types`) dans
  `src/lib/db/types.ts`, et paramétrer `PostgrestClient<Database>` dans
  `src/lib/supabase/server.ts:36-41` + `export type DbClient = PostgrestClient<Database>`.
- [x] Corriger tout ce que `tsc` révèle (colonnes fantômes, 27 casts `as string` /
  `as unknown as` : `recipes/[id]/page.tsx:36,119,135`, `households/[id]/route.ts:154`,
  `owner-context.ts:71`…). Retirer les `eslint-disable no-explicit-any` de
  `src/lib/supabase/mappers.ts:4,15,46` en typant les entrées.
- [x] Documenter dans `CLAUDE.md` : « après une migration, régénérer les types ».

Valeur haute, risque très faible (compile-time). C'est le filet de tout le reste.

## Lot 2 — Socle des routes API

Duplications confirmées (fichier:ligne dans l'annexe A). Cibles, chacune avec ses tests :

- [x] `loadOwnedRecipe(db, id, owner, { write })` dans `src/lib/db/recipes.ts` : absorbe les 7
  copies « recette scopée + 404 » (`recipes/[id]/route.ts:22-31,56-65,176-185`,
  `photo:60-69`, `move:56-65`, `share:29-38`, `status:14-23`) et les 4 copies du triplet
  « 404 → requireMember → assertNotDemoSeedMutation » (ordre divergent dans `move:67-75` :
  **aligner sur 404 → membre → démo**).
- [x] `parseJsonBody(request, schema, { status })` : 6 copies du `try { json } catch { 400 }`
  + fermer les deux 500 sur JSON invalide (`recipes/route.ts:66`, `tags/route.ts:38`).
  Statuts : 400 illisible, 422 invalide, partout.
- [x] `withPublicRoute()` : limite de corps + parse + try/catch Sentry + 500 localisé, pour
  les 9 routes publiques (remplace les 6 réimplémentations du wrapper).
- [x] `revalidateRecipePaths()` dans `src/lib/` : source unique (`/home`, `/library`,
  `/recipes/[id]`) ; corrige `photo/route.ts:99` (`/` au lieu de `/home`) et les
  invalidations manquantes de `/library` sur POST et DELETE.
- [x] Préambule commun des 3 routes d'import (`getT` → `memberHouseholdIds` →
  `forbiddenResponse` → quota) : option `withOwnerAuth({ requireMemberHousehold, quota })`
  ou helper `resolveImportHousehold(owner)`. Valider l'audio par le schéma zod existant
  (`schemas/import.ts:51-58`) au lieu de `voice/route.ts:30-50`.
- [x] `countMembers` (`members/[ownerId]/route.ts:20-31` vs `households/[id]/route.ts:112-117`)
  et la clause `or` des tags (3 copies) → `src/lib/db/`.
- [x] `/api/admin/*` est un préfixe public du proxy (`src/proxy.ts:31`) : ajouter une garde
  par défaut (secret) pour que toute future route admin naisse protégée. *Fait : Bearer
  `ADMIN_API_SECRET` (repli `BATCH_ENRICH_SECRET`, déjà posé) vérifié dans le proxy.*
- [x] Déplacer `resetDemo()` hors de `cron/demo-reset/route.ts` (248 l.) vers
  `src/lib/demo/reset.ts` (testable hors HTTP).
- [x] **Tests manquants** : `recipes/[id]/move`, les 3 `import/*` (invité refusé, 429 quota,
  codes d'erreur, 413), `recovery/{request,verify,consume}`, `owner/email/verify`.

Chiffrage : ~350 lignes retirées des routes, ~150 ajoutées, 22 routes touchées.

## Lot 3 — Côté client

- [x] `useApiMutation(url, { method, onSuccess, fallbackError })` dans `src/hooks/` : 9
  copies du pattern fetch + toast + loading (`ConfirmDeleteDialog:44-65`,
  `RecipeForm:352-448`, `LeaveHouseholdDialog:44-62`, `MemberActionDialog:55-97`,
  `RecipeActionPill:58-77`, `ProfileForm:40-75`, `MergeVerifyScreen:48-80`,
  `HouseholdDetailContent:47-58`, `ShareButton:33-63`). Inclut le `.json().catch`.
- [x] `<CenteredState illustration title body cta />` : état vide identique dans
  `HomeContent.tsx:123-152` et `LibraryContent.tsx:206-235`, même structure que
  `LoadErrorState.tsx:13-40`.
- [x] Police d'affichage : déclarer `--font-display` (Fraunces) dans `@theme` de
  `src/app/globals.css` + utilitaires (`display-xl`, `display-md`, `display-italic`) ;
  remplacer les 27 blocs inline (23 fichiers). Variabiliser le dégradé `#EDE8E0` (4
  fichiers) et une utilitaire `.card-surface` (5 sites). `invalidateRecipeLists()` dans
  `lib/swr.ts` (3 doublons de `mutate`).
- [x] `RecipeForm.tsx` (676 l.) : extraire `useRecipeSave()` (`runSave`, `:327-449`, le
  code le plus fragile : upload différé, repli régénération, dismiss share-extension) et
  `recipe-form-state.ts` (reducer `:75-168`). Tests unitaires sur le hook.
- [x] `TagInput.tsx:40-45` : `useSWR("/api/tags")` au lieu du fetch brut qui avale les
  erreurs ; extraire `TagListbox` (IIFE à index mutable `:234-352`).
- [x] `ScreenshotImporter.tsx` : sortir la plomberie Capacitor (`:25-60`, `:145-195`) vers
  `src/lib/native/camera.ts` ; `useVoiceRecorder.ts:132,198` doit utiliser
  `getPlatform()` de `lib/native.ts`.
- [x] `RecipeView`, `RecipeCard`, `RecipeCarousel`, `MetadataGrid` : `"use client"` seulement
  à cause de `useT()`. Passer `t` en prop (ou `getT()` dans le parent) et les rendre
  serveur ; priorité à `RecipeView` (page publique `/r/[token]`). *Fait pour `RecipeView`
  + `MetadataGrid` (prop `t`). `RecipeCard` / `RecipeCarousel` restent clients : rendus
  dans `HomeContent` (SWR, client), un `t` en prop n'y changerait rien.*
- [x] Unifier les 3 boutons retour (`BackCircleButton`, `InAppBackButton`, SVG inline
  `RecoverFlow.tsx:115-137`, header `ArrowLeft` de `NewRecipeFlow.tsx:88-99` et
  `recipes/[id]/edit/page.tsx:41-51`).

## Lot 4 — Ménage (risque nul)

- [x] Migration `045_drop_analytics_v2.sql` : `DROP FUNCTION IF EXISTS` sur les **30**
  fonctions `analytics_*` hors `analytics_v3_*` (liste en annexe B), plus la surcharge
  inutilisée `demo_stats_rollup(uuid, int)` (`038`). Vérifier avant que
  `/admin/stats|explorer|sante` et le digest n'appellent que `analytics_v3_*`,
  `app_store_daily_replace`, `stats_daily_increment`, `demo_stats_rollup(uuid[])`.
  Appliquer avec `scripts/vps/migrate.mjs` (staging, contrôle des 3 pages, puis prod au go).
  *Fait : 30 fonctions + surcharge `demo_stats_rollup(uuid, int)` + helpers `owner_in_carnets`
  et `carnet_activity` (sans appelant restant). Appliquée sur staging le 2026-09-13, RPC v3
  vérifiées en 200 via PostgREST. **Prod : `node scripts/vps/migrate.mjs prod` au moment du go**
  (après le déploiement du code, qui ne référence plus la v2 depuis la 043).*
- [x] Supprimer les one-off : `scripts/backfill-activity-from-recipe-days.mjs`,
  `backfill-owner-alias.mjs`, `verify-owner-backfill.mjs`, `spec9-compare-carousels.ts`,
  et `scripts/bench/results/` (6 700 l. de sorties brutes ; garder `bench/fixtures/`).
  `migrate-photos-to-s3.mjs` reste jusqu'à la suppression des projets Supabase.
  *`bench/results/` n'était pas suivi par git (local seulement) — rien à retirer du repo.*
- [x] Exports morts : `transcriptionCostUsd` (`src/lib/ai-cost.ts:70`), `monthLabel`
  (`src/lib/admin/v3/weeks.ts:66`). Commentaire obsolète `ai-cost.ts:16` (RPC v2).
- [ ] Prettier + passe unique + `--check` en CI (deux styles coexistent : 17 fichiers
  quotes simples / sans point-virgule contre 18, rien que dans l'API). *`NextRequest`
  partout et forme d'erreur `{ error, code? }` typée (`ApiErrorBody`, lib/api/body.ts) :
  faits. Prettier : PR à part (diff massif), voir ci-dessous.*
- [x] `tsconfig.json` : `target: "ES2022"`, purger les `include` `.next-*` accumulés.
- [x] Rangement : `DeepLinkHandler.tsx` et `VersionWatcher.tsx` → `components/providers/` ;
  `components/app/` → `components/hints/` ; sous-découper `components/recipes/` (30
  fichiers) en `card/ form/ view/ import/` + `components/illustrations/` ; renommer
  `components/admin/charts-v3.tsx` et `ui.tsx` (PascalCase, sans `v3`), retirer le
  `eslint-disable no-explicit-any` global de `charts-v3.tsx:25` (Recharts 3 est typé) ;
  découper `src/app/admin/stats/page.tsx` (417 l.) en sections.
- [x] i18n : sortir les namespaces serveur (`api`, `email`, `validation`, `carousels`,
  14 % de `fr.ts`) dans `fr.server.ts` / `en.server.ts` avec le même `Widen<typeof fr>`
  (garde la complétude vérifiée par `tsc`). **Ne pas** découper par domaine, **ne pas**
  chercher à ne livrer qu'une locale (choix documenté dans `docs/specs/i18n/00-socle.md`).
  Corriger la note du vault : il n'y a aucun texte admin dans les dictionnaires.

## Lot 5 — Sagas d'onboarding (à faire en dernier, après une semaine de recul)

- [ ] `src/lib/db/owners.ts` + `sessions.ts` + `households.ts` : une seule fonction
  `provisionOwnerWithHousehold` / `attachOwnerToHousehold` pour les 3 copies « owner +
  membership + session + cookie » (`households/route.ts:88-163`, `join/route.ts:101-135`,
  `demo/session/route.ts:32-71`). Les rollbacks compensatoires **diffèrent** :
  `households:110` supprime l'owner seul, `:122-123` foyer puis owner, `join:115` compte
  sur la cascade. **Écrire la sémantique choisie dans le code avant d'unifier.**
  `households/route.ts:144` fait un `recipes.update().is('household_id', null)` non scopé
  déclaré no-op depuis la 027 : à supprimer.
- [ ] Réécrire les tests des routes concernées sur des mocks de fonctions `db/*` (le mock
  FIFO `src/test/supabase-mock.ts` ne reste que pour les tests de `src/lib/db/`).
- [ ] Filet : E2E `01`, `02`, `03`, `08-demo`, `14-lot4-multi-foyer`,
  `15-foyer-post-release-fixes`, et un test d'écriture réelle sur staging (créer, rejoindre,
  démo) avant le go.

Risque moyen : ce sont les trois chemins d'acquisition. Une régression ici est un incident
de conversion, pas un bug cosmétique.

## Lot 6 — Tests et robustesse du pipeline IA

- [ ] `src/test/openai-mock.ts:45-56` : ajouter `usage` à `chatCompletion` ; assertions sur
  `recordAiCost` par voie (`import_url`, `import_url_crawler`, `import_instagram`,
  `transcription`, `ocr`) — aujourd'hui aucun test ne vérifie le coût enregistré.
- [ ] Tests des voies Instagram et crawler Apify (`src/lib/import.ts:472-531`,
  `src/lib/apify.ts` : zéro test).
- [ ] Factoriser le bloc « appel → parse → coût » ×3 (`import.ts:238-251, 311-323, 358-371`)
  en `runExtraction({ model, messages, callType, meta, useEffortFallback })`.
- [ ] Cron `enrich-stale` : recettes `enrichment_status = 'pending'` depuis > 1 h (perdues
  quand le conteneur redémarre pendant `after()`), ~20 par passage, réutilise
  `enrichRecipe`. Crontab VPS (`scripts/vps/bootstrap.sh`, section crons) + `cron-auth`.
- [ ] Test d'invariant : chaque modèle de `AI_MODELS` a un prix dans `ai-cost.ts` ou une
  exemption explicite (`gpt-4o-mini-transcribe` manque déjà).
- [ ] Extraire 4-5 fonctions pures de `assembleV3` (`src/lib/admin/v3/assemble.ts:162-501`,
  340 l., 9 sections en bannières) pour les tester une à une (médianes, fenêtres glissantes).
- [ ] Test direct de `src/lib/cron-auth.ts`.

## À ne pas toucher

`src/lib/auth/owner-context.ts` (déjà la couche d'accès modèle), `ImportSelector.tsx` et
son `runImport`, `assemble.ts` pur et partagé page/digest (le découper en fonctions oui, le
dupliquer non), les micro-modules de sécurité (`cron-auth`, `request-ip`, `request-origin`,
`url-guard`, `body-limit` : leurs commentaires valent plus que le code), le choix SWR
limité aux deux listes avec cache localStorage, les règles ESLint `no-restricted-*`, le
`Widen<typeof fr>` de `src/lib/i18n/types.ts`, `next.config.ts`.

## Ordre recommandé

1. Lot 0 (bugs), une PR, go prod rapide.
2. Lot 1 (types), une PR : aucun changement de comportement, filet pour la suite.
3. Lot 3 puis lot 2, une PR par cible, chacune validée sur staging.
4. Lot 4 et lot 6 : n'importe quand, en PR séparées (la migration 045 seule dans sa PR).
5. Lot 5 en dernier.

Chaque go prod = une promotion `staging → main` groupant les PR validées depuis le go
précédent ; le message au moment du go liste ce qu'elle contient et ce qui a été vérifié.

---

## Annexe A — Inventaire des routes (état au 2026-09-12)

Garde : `wOA` = `withOwnerAuth` (401 + limite corps + garde démo par défaut) ; `wOA*` = avec
`allowDemoMutation` ; `cron` = `isCronAuthorized` ; `nu` = aucune (route publique du proxy).

| Route | Méthodes | Garde | Validation | Particularités |
|---|---|---|---|---|
| `/api/recipes` | GET, POST | wOA / wOA* | zod (422) | quota création, `after(enrichRecipe)` |
| `/api/recipes/[id]` | GET, PUT, DELETE | wOA / wOA* | zod (422) | rollback tags manuel `:117-148` ; DELETE sans purge S3 |
| `/api/recipes/[id]/photo` | POST | wOA* (4 Mo) | manuelle | chemin S3 dérivé serveur |
| `/api/recipes/[id]/move` | PATCH | wOA* | manuelle (422) | ordre des gardes inversé |
| `/api/recipes/[id]/share` | POST | wOA* | — | invités autorisés |
| `/api/recipes/[id]/status` | GET | wOA | — | polling |
| `/api/recipes/copy` | POST | wOA* | manuelle (422) | sans rate limit |
| `/api/recipes/import/{url,screenshot,voice}` | POST | wOA* | zod / zod / manuelle | quota avant parse ; contrat d'erreur divergent |
| `/api/households` | POST | nu | zod (422) | quota IP ; try/catch maison ; sans limite corps |
| `/api/households/[id]` | PUT, DELETE | wOA / wOA* | zod (400) | purge S3 + cascade |
| `/api/households/[id]/members/[ownerId]` | PATCH, DELETE | wOA | zod (400) | `'Not found'` en dur |
| `/api/households/{join,lookup}` | POST / GET | nu | zod (400) | double rate limit |
| `/api/owner`, `/api/owner/email`, `/api/owner/email/verify` | PUT / PUT / POST | wOA | zod (400) | |
| `/api/recovery/{request,verify,consume}` | POST | nu | zod / zod / regex | anti-énumération ; consume vérifie la révocation |
| `/api/demo/session` | POST | nu | — | sans rate limit, `console.log` |
| `/api/cron/{demo-reset,weekly-digest,app-store-sync}` | GET | cron | — | moniteurs Sentry |
| `/api/admin/batch-enrich` | POST | secret dédié | — | sans limite corps ; comparaison non constante |
| `/api/tags` | GET, POST | wOA | zod inline (422) | messages zod bruts |
| `/api/activity/ping` | POST | wOA* | tolérante | 401 sans foyer |
| `/api/carousels`, `/api/library` | GET | wOA | — | |
| `/api/auth/session`, `/api/auth/session/clear` | DELETE / GET | nu | — | |
| `/api/version`, `/api/aasa`, `/api/assetlinks` | GET | nu | — | statiques |

Duplications numérotées (références complètes) : (1) recette scopée + 404 ×7 ; (2) triplet
404/membre/démo ×4 ; (3) préambule import ×3 ; (4) purge photos ×2 (+ DELETE recette sans) ;
(5) clause `or` tags ×3 (`tags/route.ts:17-20,69`, `library/route.ts:50`) ; (6) « owner
sans foyer → vide » ×4 ; (7) session depuis cookie ×3 divergentes ; (8) création owner +
membership + session ×3 ; (9) parse JSON ×6 + 2 trous ; (10) try/catch Sentry ×6 ; (11)
`revalidatePath` incohérents ×6 ; (12) `countMembers` ×2.

## Annexe B — Accès données

| Table | Sites | Fichiers | Remarque |
|---|---:|---:|---|
| recipes | 52 | 19 | `enrichment.ts` en porte 17 ; 8 copies de la lecture scopée ; 4 copies littérales de `"*, recipe_tags(tag_id, tags(id, name, category))"` |
| owners | 19 | 8 | saga onboarding ×3 ; `findOwnerByEmail` existe (`queries/recovery.ts:22`) mais `owner/email/route.ts:67` la réécrit |
| households | 17 | 10 | foyer par id ×4 projections |
| memberships | 17 | 8 | `countMembers` ×2 ; membership par (owner, household) ×3 |
| recipe_tags | 9 | 5 | |
| device_sessions | 8 | 7 | |
| tags | 7 | 4 | |
| login_tokens | 4 | 2 | |
| ai_costs, digests_sent, app_store_*, daily_activity | 1-2 | 1 | mono-appelant, laisser |
| stats_daily, recipe_views_daily | 0 direct | — | RPC seulement, modèle |

`mapTags` copié à l'identique : `lib/supabase/mappers.ts:5-13` et `lib/queries/carousels.ts:17-32`.
Comptage seed démo + seuil défini deux fois avec deux comportements
(`cron/demo-reset/route.ts:13-24,117-121` et `lib/admin/v3/data.ts:14-17`).

RPC appelées (15) : `analytics_v3_{people,weekly_active,weekly_recipes,demo,health,sharing,carnets,daily}`,
`demo_stats_rollup`, `purge_recipe_views`, `track_recipe_view`, `stats_daily_increment`,
`verify_login_code`, `merge_owners`, `app_store_daily_replace`. Helper SQL utile : `owner_is_real`.

Fonctions `analytics_*` orphelines (30, vérifié en base prod) : `analytics_kpis`,
`analytics_activation`, `analytics_active_daily`, `analytics_active_daily_cohorts`,
`analytics_acquisition_daily`, `analytics_cumulative_parc_daily`, `analytics_login_frequency`,
`analytics_depth`, `analytics_owner_days`, `analytics_retention_cohorts`,
`analytics_adoption_since`, `analytics_enrichment`, `analytics_source_mix`,
`analytics_source_mix_monthly`, `analytics_recipes_by_platform`,
`analytics_recipes_created_daily`, `analytics_recipes_per_household_dist`,
`analytics_top_households`, `analytics_carnets_per_owner`, `analytics_carnet_people_dist`,
`analytics_guest_adoption`, `analytics_devices_per_owner`, `analytics_recovery`,
`analytics_sharing`, `analytics_demo_funnel`, `analytics_demo_summary`,
`analytics_demo_time_to_convert`, `analytics_ai_cost_daily`, `analytics_ai_cost_summary`,
`analytics_ai_cost_demo_daily` ; helpers `owner_in_carnets`, `carnet_activity` (033) à
vérifier. Lister avec :
`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'analytics_%' and proname not like 'analytics_v3_%'`.

Mock FIFO (`src/test/supabase-mock.ts`) : 22 fichiers, ~130 `queueResult`, couplage à
l'ordre des requêtes, file vide = `{ data: null }` silencieux. Cible : mocks de fonctions
`db/*` dans les tests de routes.

## Annexe C — UI

Fichiers > 300 lignes et verdict : `RecipeForm.tsx` (676) découper (`runSave`, reducer) ;
`TagInput.tsx` (357) partiel ; `ScreenshotImporter.tsx` (327) extraire le natif ;
`RecoverFlow.tsx` (307) non, juste le bouton retour ; `ImportSelector.tsx` (304) non ;
`admin/charts-v3.tsx` (308) non, renommer ; `admin/stats/page.tsx` (417) découper en sections.

Poids i18n embarqué côté client : `fr.ts` 27,9 Ko (9,8 gz) + `en.ts` 23,6 Ko (8,1 gz), les
deux locales toujours chargées ; namespaces serveur = 14 % de `fr.ts`.

Capacitor : bien isolé (`lib/native.ts`, `haptics.ts`, `review.ts`, `share-extension.ts`),
fuites dans `ScreenshotImporter.tsx` et `useVoiceRecorder.ts`.

## Annexe D — Pipeline IA et outillage

Voies d'import : quota avant parse (×3) ; `screenshot` sans `code` ; `voice` validation
manuelle ; attribution du coût au premier foyer membre non trié (`owner-context.ts:115-117`,
biais assumé). Cascade fetch direct → Apify bien conçue (`import.ts:542-562`),
`withEffortFallback` (`ai-models.ts:48-59`) et `retry.ts` corrects.

Scripts vivants : `apple-connect.mjs`, `dokploy.mjs`, `ovh.mjs`, `vps/*`, `e2e-*.mjs`,
`seed-e2e.mjs`, `demo-en/`, `restore-demo-from-staging.mjs`,
`sync-staging-demo-from-prod.mjs`, `recheck-diet-tags.mjs`, `lib/env.mjs`, `bench/*.mjs`,
`gen-android-icons.mjs`, `build-splash.mjs`.

E2E : 17 specs, `workers: 1` justifié, aucune spec sur l'import (coût OpenAI, pas de mock
serveur dans le harnais) ; specs nommées par lot de livraison (12, 15) plutôt que par
fonctionnalité.
