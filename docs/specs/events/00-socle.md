# Chantier « Événements produit » (#28) — Socle

> **À lire en premier par toute session Claude Code travaillant sur ce chantier.**
> Décidé avec Anthony le 2026-09-15 (discussion « outil de tracking UX »). Note backlog :
> vault `Backlog/Journal des événements produit.md` (`id: 28`). En cas d'écart doc ↔ code,
> **le code fait foi** ; mettre la doc à jour dans le même commit.

## 0. En deux lignes

Toute l'instrumentation actuelle est **pré-agrégée** (`stats_daily` = une colonne par question,
`daily_activity` = un ping par jour, `recipe_views_daily` = un compteur). Une question nouvelle
coûte une migration, un déploiement et des semaines d'accumulation. On pose **un journal
d'événements bruts** dans le Postgres du VPS, alimenté par trois flux automatiques ; le **sens**
(« un import a commencé », « une recette a été rouverte ») est défini **a posteriori** en SQL.

Pas d'outil tiers (PostHog auto-hébergé ne tient pas sur le VPS — 3,7 Go de RAM — et son
self-hosting n'est plus supporté ; un SDK de tracking dans la WebView rouvrirait App Privacy et le
consentement). Pas de session replay : on lit des parcours, et on observe des vrais gens pour le reste.

## 1. Les questions à servir

Chaque choix ci-dessous se justifie par au moins une de ces questions (historique des demandes
d'Anthony : revue stats v3 §2.2-2.3, #4, #6, #7, #23-#25).

| # | Question | Aujourd'hui |
|---|---|---|
| Q1 | Où les nouveaux abandonnent-ils entre la landing et la première recette ? (par bras A/B) | compteurs par bras, chemin invisible |
| Q2 | **« Essaie puis s'évapore »** : qu'ont fait les intenses que les inactifs n'ont pas fait ? Dernier écran avant de disparaître ? | jours actifs seulement |
| Q3 | Import : méthode, taux d'échec **et cause** par méthode, durée d'attente, abandon en cours, repli manuel | `recipes.source` ne voit que les succès |
| Q4 | Cuisine-t-on avec l'app (écran allumé, convives, temps sur la recette, **même recette rouverte** vs recettes différentes) ? | un compteur par jour |
| Q5 | Le partage et le foyer amènent-ils du monde qui reste ? | émissions non datées |
| Q6 | Que regardent les visiteurs démo, combien d'écrans avant de partir ? | un compteur d'essais |
| Q7 | iOS / Android / web se comportent-ils différemment ? | sur les jours actifs seulement |
| Q8 | La découverte (recherche, filtres, carrousels) sert-elle ? | rien |

## 2. Principes (décisions du 2026-09-15)

1. **Brut d'abord, sens ensuite.** On émet des faits (écran vu, élément cliqué, appel API, impression),
   pas des interprétations. Les « moments » (`import.started`, `recipe.reopened`…) sont des **vues SQL
   versionnées** ; une question nouvelle = une requête, jamais une migration de colonne.
2. **Trois flux automatiques** posés une fois pour toutes (écrans, clics, appels API) et **trois
   événements explicites** seulement, là où aucun flux ne peut reconstruire le fait (impression,
   erreur affichée, cuisson). Étendre l'instrumentation = poser un attribut `data-track`.
3. **Le sens est figé par un identifiant, jamais par un libellé** : l'app est bilingue, le texte d'un
   bouton n'est pas un contrat ; `data-track="import.url"` en est un (on renomme le libellé, jamais
   l'identifiant).
4. **Une seule chose reste impossible à reconstruire : la cause d'un échec.** Le serveur pose un
   `error_code` (enum) sur tout appel API en échec. C'est la seule sémantique figée à l'émission.
5. **Identifiants, jamais de contenu.** `recipe_id`, `household_id`, `hint`, `carousel` : oui — ils
   joignent les tables métier (source, tags, seed, enrichissement). Titre, URL importée, texte saisi,
   e-mail : **jamais** dans `props`.
6. **L'existant ne bouge pas.** `stats_daily`, `trackStat`, `daily_activity`, `recipe_views_daily`,
   le dashboard v3 et l'A/B #25 restent tels quels. Le journal est la couche en dessous.
7. **Sondes jamais écrites, démo écrite et marquée** (`is_demo`), admin jamais tracé.

## 3. Modèle de données — migration `051_events.sql`

```sql
CREATE TABLE events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL,           -- horloge de l'ÉMETTEUR (client ou serveur)
  received_at   timestamptz NOT NULL DEFAULT now(),
  -- identité (§4)
  anon_id       uuid NOT NULL,                  -- cookie appareil, posé par le proxy
  owner_id      uuid REFERENCES owners(id) ON DELETE SET NULL,   -- null avant tout carnet
  device_id     uuid,                           -- device_sessions.id, null avant session
  household_id  uuid,                           -- carnet courant (informatif, pas de FK : survit à la suppression)
  -- contexte photographié à l'émission (§5)
  platform      text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios','android','web','unknown')),
  app_version   text,
  locale        text,                           -- 'fr' | 'en'
  variant       text,                           -- bras A/B onboarding ('a' | 'b' | null)
  is_demo       boolean NOT NULL DEFAULT false,
  -- le fait
  source        text NOT NULL CHECK (source IN ('client','server')),
  name          text NOT NULL,                  -- catalogue §6, allow-list côté serveur
  props         jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX events_at_idx        ON events (at DESC);
CREATE INDEX events_owner_at_idx  ON events (owner_id, at DESC) WHERE owner_id IS NOT NULL;
CREATE INDEX events_anon_at_idx   ON events (anon_id, at DESC);
CREATE INDEX events_name_at_idx   ON events (name, at DESC);
CREATE INDEX events_props_gin     ON events USING gin (props jsonb_path_ops);
```

- **Privilèges** : comme la 039 — `REVOKE ALL FROM PUBLIC, anon, authenticated`, écriture et lecture
  `service_role` uniquement. Le client PostgREST typé y accède via `createServerClient()`.
- **Purge** : `purge_events(p_keep_days int DEFAULT 400)` (13 mois, pattern `purge_recipe_views`),
  appelée par le cron `demo-reset`.
- **Volume** : ~22 actifs / 7 j × ~40 événements par session (clics compris) ⇒ **< 5 000 lignes/jour**,
  < 2 M lignes/an, de l'ordre du Go avec les index. 28 Go libres sur le VPS.
- **`npm run db:types`** après la migration (harnais local d'abord : `npx supabase db reset --local`),
  types commités avec la migration.

## 4. Identité — recoller l'onboarding

`owner_id` est la personne (plusieurs appareils depuis le chantier foyer). Mais Q1 commence **avant**
qu'un owner existe. D'où :

- **`anon_id`** : cookie `mijote_aid` (uuid v4, 1 an, `httpOnly`, `SameSite=Lax`), posé par
  `src/proxy.ts` sur toute première requête, quel que soit le point d'entrée (`/`, `/join/[code]`,
  `/r/[token]`). Même mécanique que `mijote_ab_onboarding` (le shell natif a son propre cookie jar →
  un `anon_id` par installation, c'est ce qu'on veut). Le client **ne manipule jamais** cet
  identifiant : il poste des événements, le serveur attache l'identité depuis les cookies.
- **Rattachement** : dès qu'une session existe, chaque ligne porte `anon_id` **et** `owner_id`. Il
  n'y a pas d'événement de liaison : la vue `v_identity` = `DISTINCT (anon_id, owner_id)` suffit, et
  le funnel d'onboarding se lit **par `anon_id`** de bout en bout.
- **Sessions** : dérivées en SQL (vue `v_sessions`) — même `anon_id`, trou > 30 min ⇒ nouvelle
  session. Aucune colonne dédiée.
- **Exclusions** : sonde (`isProbeHeaders` / cookie `mijote_probe`) ⇒ rien n'est écrit ;
  `owner` admin (`isAdminOwner`) ⇒ rien n'est écrit ; pages `/admin/*` ⇒ pas de client.

## 5. Contexte photographié à l'émission

Tout est posé **au moment T** pour qu'une question du type « les iOS 1.3 en bras B » soit un `WHERE`
et non une jointure fragile sur l'état courant.

| Colonne | Client (`POST /api/events`) | Serveur (`trackEvent`) |
|---|---|---|
| `platform`, `app_version` | dans le corps du lot, comme le ping (`Capacitor.getPlatform()`, `/lib/version`) | `device_sessions.platform` de la session (rafraîchi par le ping) |
| `locale` | cookie `mijote_locale` / `Accept-Language` résolu par le serveur | idem |
| `variant` | cookie `mijote_ab_onboarding` | idem |
| `is_demo` | owner démo (`isDemoOwner`) | idem |
| `household_id` | `memberships[0]` comme le ping ; `null` sans session | idem, ou le foyer cible de la route |
| `at` | **horloge du client**, borne : si \|`at` − `now()`\| > 10 min ⇒ `at := received_at` | `now()` |

## 6. Catalogue — trois flux automatiques, trois explicites

Source unique : **`src/lib/events/catalog.ts`** — `EVENT_NAMES as const` (allow-list serveur),
type `EventProps` indexé par nom (props typées, `tsc` refuse une prop inconnue), et
`DATA_TRACK_IDS as const` (liste des identifiants posables). Client et serveur l'importent.

### 6.1 Flux A — écrans (client, automatique)

| Nom | Props | Quand |
|---|---|---|
| `screen.viewed` | `{ route, params }` — `route` = motif (`/recipes/[id]`), `params` = identifiants uniquement (`{ id }`) | chaque changement de `usePathname()` + le montage |
| `screen.left` | `{ route, params, duration_ms }` | au changement suivant ou `visibilitychange: hidden` |

`route` est le **motif** Next, jamais le chemin concret (les identifiants vont dans `params`). Les
routes `/admin/*` sont exclues. Les routes publiques `(landing)` et `/r/[token]` sont incluses
(Q1, Q5).

**Origine d'entrée** (ajout du 2026-09-15 soir) : la première `screen.viewed` d'un chargement
porte `entry` = `{ referrer_host, utm_source, utm_medium, utm_campaign, in_app, click_id }`.
Ce que le navigateur en dit, et pas plus : le **referrer est vide** depuis les navigateurs intégrés
(Messenger, Instagram, WhatsApp…) et le shell natif — c'est la signature du User-Agent (`in_app`)
qui les révèle, et les **UTM que tu poses toi-même dans tes liens** (bio, posts, campagne) qui sont
la seule source précise. `click_id` = le nom du paramètre (`fbclid`, `gclid`…), jamais sa valeur.
Vues : `v_entries` (une entrée par appareil, `source` consolidée) et `v_onboarding_funnel` enrichie
(053) ; requête `scripts/events/queries/sources.sql`.

### 6.2 Flux B — clics (client, automatique)

| Nom | Props | Quand |
|---|---|---|
| `ui.clicked` | `{ target, route, params }` | `click` sur `button`, `a`, `[role=button]`, `input[type=submit]` (listener global capturant sur `document`) |

- `target` = l'attribut **`data-track`** de l'élément ou de son ancêtre le plus proche qui en porte un.
- **Sans `data-track`** : `target = "?" + tag + ("#" + id)?` — trace de secours, **non contractuelle**
  (jamais le texte, bilinguisme). Elle sert à voir l'imprévu, pas à définir un moment.
- Un élément `data-track="none"` n'est pas tracé (ex. boutons de saisie de texte répétitifs).

### 6.3 Flux C — appels API (serveur, automatique)

| Nom | Props | Quand |
|---|---|---|
| `api.called` | `{ route, method, status, duration_ms, error_code? }` | à la fin de chaque route API, `route` = motif (`/api/recipes/[id]`) |

- Émis par `withOwnerAuth` (toutes les routes authentifiées) **et** à la main dans les routes
  publiques : `/api/households/join`, `/api/households/lookup`, `/api/demo/session`,
  `/api/recovery/*`, `/api/auth/session`.
- Exclus : `/api/activity/ping` (déjà `app.opened`), `/api/events`, `/api/version`, `/api/admin/*`,
  `/api/cron/*`, `/aasa`, `/assetlinks`, `/api/carousels`, et les lectures automatiques en GET
  (`/api/recipes/[id]/status` — polling —, `/api/tags`, `/api/library`, `/api/recipes`) : des
  chargements d'écran, pas des intentions ; les écritures sur ces routes restent tracées.
- **`error_code`** : quand `status ≥ 400`, le champ **`code`** du corps JSON (contrat d'erreur
  existant des routes : `INVALID_DATA`, `SITE_BLOCKED`, `TIMEOUT`, `RATE_LIMIT`, `EXTRACTION_FAILED`,
  `TRANSCRIPTION_FAILED`, quotas…) — repli sur `error` s'il est un slug, jamais un message localisé.
  **C'est la seule sémantique qu'on fige à l'émission** (§2.4). Les codes existants suffisent ;
  en affiner (`no_recipe_found`, `audio_too_short`…) reste possible sans toucher au journal.
- `props` porte les identifiants que la route connaît : `recipe_id` / `household_id` du chemin,
  `method_kind` (= `url` / `photo` / `voice` pour `/api/recipes/import/*`, = `source` pour
  `POST /api/recipes`), `recipe_id` lu dans la réponse d'une création / copie. Une route
  complète son événement par l'en-tête **interne** `x-mijote-event` (`withApiEventExtra`), lu
  puis retiré de la réponse avant l'envoi — jamais vu par le client. L'import par URL y ajoute
  **`site`** (hôte du site importé, sans `www.`) quelle que soit l'issue : « où ça échoue »
  (Q3), lisible dans `v_import_extracted.site` et `sources.sql`. Un hôte est un identifiant,
  pas du contenu ; l'URL complète, elle, n'est jamais journalisée.
  L'import photo réussi y ajoute **`image_kind`** (`screenshot` / `printed_photo` / `handwritten` /
  `other`), la nature des images estimée par gpt-4o dans le même appel OCR (chantier « OCR sur
  l'appareil », 2026-09-18) : une catégorie, jamais le contenu ; lecture
  `scripts/events/queries/image-kinds.sql`.
  L'import Instagram y ajoute, en succès comme en échec, **`ig_path`** (`direct_embed` /
  `direct_og` / `apify` / `cache` / `failed` — la voie qui a fourni la légende), **`ig_fallback`**
  (raisons d'abandon de la lecture directe, page embed puis page du reel : `http_429/login_wall`…)
  et **`ig_read_ms`** (lecture seule, hors modèle) — chantier « Instagram sans Apify », 2026-09-18.
  Des catégories, jamais l'URL ni la légende ; lecture `scripts/events/queries/instagram-paths.sql`,
  et le voyant « Instagram » de la Santé (taux de secours sur 24 h).

### 6.4 Explicites (les seuls faits qu'aucun flux ne voit)

| Nom | Source | Props | Quand |
|---|---|---|---|
| `ui.seen` | client | `{ target, route, params }` | `IntersectionObserver` sur `[data-track][data-seen]` — **opt-in** par l'attribut `data-seen`, une fois par vue d'écran (hints, CTA d'onboarding, bannière install) |
| `error.shown` | client | `{ kind, route }` | une erreur affichée sans appel API derrière (`LoadErrorState`, toasts) ; `kind` = enum court |
| `app.opened` / `app.resumed` | client | `{}` | là où part le ping (`DeviceTokenProvider`) et au `resume` Capacitor |

Rien d'autre. Toute tentation d'ajouter un événement explicite doit d'abord répondre : « un flux
A/B/C ne le voit-il vraiment pas ? »

### 6.5 Identifiants `data-track` posés (lot 1, livré)

Convention `domaine.cible`, stable, en anglais, jamais renommé (le libellé oui). **La liste qui
fait foi est `DATA_TRACK_IDS` dans `catalog.ts`** ; ci-dessous l'état posé — les identifiants
de la première ébauche sans élément correspondant dans l'UI (convives, notes, copie in-app,
annuler/réessayer un import, install sur la landing) n'ont pas été créés : on ne pose que ce
qui existe.

| Écran | Identifiants |
|---|---|
| Landing | `landing.start`, `landing.demo`, `landing.join` (par ACTION, pas par position : comparable entre bras), `landing.recover`, `household.join_code` (fork « j'ai déjà un carnet ») |
| Import (`/recipes/new`) | conteneur par méthode `import.url` / `import.photo` / `import.voice` (tout clic dans le panneau), `import.manual`, `import.sample` (« essaie celle-ci »), `import.submit`, `import.back` |
| Formulaire recette | `recipe.save`, `recipe.add_photo` (conteneur), `recipe.add_tag` (conteneur) |
| Vue recette | `recipe.edit`, `recipe.delete` (déclencheur), `recipe.share`, `recipe.move`, `recipe.back` |
| Accueil / bibliothèque | `home.carousel.<key>` (section du carrousel), `library.search`, `library.filter.<dish\|cuisine\|diet\|duration\|cost\|foyer\|season>` (pilule ET panneau Radix), `nav.home`, `nav.new`, `nav.library` |
| Foyer | `household.invite`, `household.invite_link`, `household.invite_code`, `household.join_code`, `household.switch`, `household.leave`, `household.email_add` |
| Hints | conteneur `hint.<share\|email\|demo\|install\|install_code>` + `data-seen` (impression), `hint.<name>.act`, `hint.<name>.dismiss` |
| Partage public `/r/[token]` | `share.copy_to_mine` |

Les composants qui ne relaient pas leurs props (`BackButton`, `RecipeCard`, `RecipeCarousel`,
`CenteredState`, `ConfirmDeleteDialog`, `MiniStrip`) ont reçu une prop `track` (avec un défaut :
`nav.back`, `recipe.open`, `state.cta`). Les portails Radix (dialogs, popovers) ne sont pas sous
leur déclencheur : leurs boutons sont nommés un à un.

**Règle (2026-09-15, après les premières lectures prod) : tout élément cliquable est nommé.**
`catalog.test.ts` scanne `src/` : un `button` / `Button` / `Link` / `a href` sans `data-track`
(ni prop `track`) fait échouer la CI, sauf dans un fichier déclaré dans `INHERITS` avec le
conteneur dont ses cliquables héritent (options de filtres, panneaux d'import, pages légales).
La trace de secours `?button` reste pour l'imprévu réel (éléments dynamiques), jamais pour
l'oubli. Attribution des cartes : `home.carousel.<key>` depuis un carrousel, `library.open`
depuis la bibliothèque (la carte prend l'identifiant de son contexte, `closest()` oblige).

## 7. Émission

### 7.1 Client — un module, un provider

**`src/lib/events/client.ts`** + **`src/components/layout/EventsProvider.tsx`** monté dans le layout
`(app)` / `(app-fullscreen)` / `(landing)` / `(public)` — pas dans `admin`. Tout tient là :

- `track(name, props)` — empile `{ name, props, at: Date.now() }` dans une file mémoire.
- Hook routeur (`usePathname` + `useParams`) ⇒ `screen.viewed` / `screen.left`.
- Listener `click` global (capture) ⇒ `ui.clicked` (résolution de `target` par `closest('[data-track]')`).
- `IntersectionObserver` sur `[data-track][data-seen]` ⇒ `ui.seen`.
- **Vidage** : toutes les 5 s, ou dès 20 événements, ou à `screen.left`, ou sur
  `visibilitychange: hidden` / `pagehide` via **`navigator.sendBeacon`** (le `fetch` normal sinon).
  Lot maximal 50 événements ; au-delà, on coupe en plusieurs envois.
- **Résilience** : une file qui échoue est retentée une fois, puis abandonnée (best-effort, jamais
  d'erreur remontée à l'utilisateur, jamais de stockage local — pas de `localStorage` à purger).
- Aucun identifiant d'identité côté client : le serveur lit les cookies.

### 7.2 Serveur — `trackEvent` et `POST /api/events`

**`src/lib/events/server.ts`** :

- `trackEvent(name, props, ctx?)` — **à attendre pendant la requête** : le contexte (en-têtes,
  cookies, langue, sonde, admin) est capturé avant `after()` — Next interdit `cookies()` dans
  `after()` et une continuation non attendue peut y glisser (vu en E2E). Seule l'insertion part
  dans `after()`, best-effort, no-op hors requête (tests unitaires). `owner.platform` vient de
  `device_sessions` (ajouté à `OwnerContext`) ; `app_version` reste `null` côté serveur.
- `recordApiCall(...)` appelé par `withOwnerAuth` (toutes les routes owner : succès, 403 démo,
  500 ; pas les 401) et par `withPublicRoute` (routes publiques, anonymes) ; `withApiEvent` enveloppe
  les deux handlers nus (`GET /api/households/lookup`, `DELETE /api/auth/session`).

**`POST /api/events`** (`src/app/api/events/route.ts`) :

- **Sans `withOwnerAuth`** (la landing n'a pas de session) : résolution d'owner *si* cookie de session,
  sinon `anon_id` seul. Sonde ⇒ `204` sans rien écrire. Pas de cookie `mijote_aid` ⇒ `204` (client
  hors proxy : ne rien inventer).
- Validation stricte : `name ∈ EVENT_NAMES` sinon la ligne est ignorée (pas le lot), `props` ≤ 1 Ko
  sérialisé, chaînes ≤ 200 caractères, ≤ 50 événements par lot, corps ≤ 32 Ko (`maxBodyBytes`),
  `at` borné (§5). Un `insert` multi-lignes par lot.
- Répond `204` toujours (jamais d'erreur au client), les rejets sont comptés dans un log serveur.

## 8. Lecture

### 8.1 Le sens : vues SQL versionnées — migration `052_events_views.sql`

Chaque « moment » = une vue, avec sa définition en commentaire (la question qu'elle sert). Une vue
change **par migration** (sans donnée, donc gratuit) ; une question nouvelle reste une requête
ad hoc sur `events`. Douzaine initiale :

| Vue | Définition (résumé) | Sert |
|---|---|---|
| `v_identity` | `DISTINCT (anon_id, owner_id)` | tout |
| `v_sessions` | par `anon_id`, découpage à 30 min : début, fin, `n_events`, plateforme, `first_route`, `last_route` | Q2, Q6, Q7 |
| `v_screen_views` | flux A + durée (`screen.left`) | Q2, Q6 |
| `v_recipe_views` | `screen.viewed` sur `/recipes/[id]` avec `recipe_id`, durée, `from` (route précédente de la session) | **Q4 (même recette ×5 vs 5 recettes)**, Q2 |
| `v_import_started` | `ui.clicked` sur `import.url` / `import.photo` / `import.voice` / `import.manual` | Q3 |
| `v_import_extracted` | `api.called` sur `/api/recipes/import/*` : statut, `duration_ms`, `error_code`, `method` | Q3 |
| `v_recipe_saved` | `api.called` `POST /api/recipes` 201 avec `source` | Q3, Q1 |
| `v_import_funnel` | par session : started → extracted OK → saved ; les trous sont les abandons **et leur étape** | Q3 |
| `v_onboarding_funnel` | par `anon_id` : `landing.viewed` (bras) → carnet créé (`POST /api/households` / `/api/demo/session` / join) → 1ʳᵉ recette → 3 recettes | **Q1**, Q6 |
| `v_share_loop` | lien créé (`POST /api/recipes/[id]/share`) → ouverture `/r/[token]` par un **autre** `anon_id` → `share.copy_to_mine` / carnet créé | Q5 |
| `v_household_joins` | `POST /api/households/join` + `via` | Q5 |
| `v_cooking` | fiche de recette restée ouverte ≥ 2 min (055 ; l'événement wake lock partait à chaque ouverture) | Q4 |

Requêtes non matérialisées en vue (trop ad hoc), livrées dans **`scripts/events/queries/*.sql`** :
« dernier écran avant disparition » (Q2), « intenses vs évaporés : que font-ils de différent
la première semaine » (Q2), « comparaison iOS / Android / web » (Q7), « découverte » (Q8).

**Garde-fou anti-dérive** — `src/lib/events/catalog.test.ts` :
1. chaque littéral `data-track="…"` du code ∈ `DATA_TRACK_IDS` (grep de `src/`) ;
2. chaque `target = '…'` référencé dans `052_events_views.sql` et `scripts/events/queries/` ∈
   `DATA_TRACK_IDS` **et** est encore posé dans `src/`. Une vue orpheline = CI rouge.

### 8.2 Page « Parcours » — `/admin/parcours`

Le *replay pauvre*. Admin (`isAdminOwner`), server components, même style que `/admin/explorer`.

- **`/admin/parcours`** : les 50 dernières sessions (personne ou « anonyme », plateforme, durée,
  nombre d'écrans, première/dernière route, bras). Filtre `?demo=1`.
- **`/admin/parcours/[anonId]`** (lien depuis la liste **et** depuis la liste des personnes
  d'Explorer via `v_identity`) : la timeline brute, groupée par session, un événement par ligne
  (`hh:mm:ss`, nom, `target`/`route`, statut, durée). **On affiche le brut**, y compris les
  `target` de secours `?button…` : c'est là qu'on voit ce qu'on n'avait pas prévu.
- Rien d'interactif au-delà : pas de filtres, pas de graphes. Une question qui revient devient une
  vue (§8.1) ou une tuile v3 (§8.3).

### 8.3 Lot 3 — le comportement du dashboard depuis `events` (décidé le 2026-09-15, déclencheur mi-octobre)

**Cible : l'état depuis les tables, le comportement depuis les événements.** Pas « tout depuis les
logs » : personnes, carnets, recettes, liens, enrichissement, App Store restent sur les tables
métier (transactionnel, exhaustif, permanent — un log est best-effort et purgé). En revanche
actifs, consultations, funnels démo et A/B, méthodes d'import, activation, rétention passent sur
`events`, et `stats_daily` / `daily_activity` / `recipe_views_daily` / `trackStat` disparaissent.
Bonus : dashboard et Parcours partagent la source, chaque chiffre devient cliquable jusqu'aux
personnes.

Règles de la bascule :
- **Double lecture d'abord** — `scripts/events/queries/reconcile.sql` compare chaque compteur à
  son équivalent événements sur 14 j ; c'est aussi le premier usage : **un écart = un bug de
  l'ancienne instrumentation ou un trou de la nouvelle**. Un compteur est supprimé quand sa ligne
  concorde 4 semaines de suite. Jamais de bascule sèche : la continuité des séries hebdo prime.
- **Première métrique** : la North Star « a consulté ou ajouté » (prévue mi-octobre) = `v_recipe_views`
  ∪ `v_recipe_saved`, à la place du ping.
- **Histoire** : les cohortes depuis mai 2026 restent lues sur `owners` + `daily_activity` tant que
  les événements ne couvrent pas la fenêtre.
- **Purge** : monter à 25 mois (volume dérisoire) et **agréger avant de purger** — table
  `owner_months` (personne × mois × a-consulté / a-ajouté), minuscule et permanente.
- **Calcul** : matérialisation nocturne (cron `demo-reset`) pour ce que la page lit ; les vues live
  restent l'outil des questions ad hoc.
- **Ce qu'on ne fait pas** : réécrire la v3 ; une UI de requêtage ; des tuiles sur vues non
  matérialisées. **Aucune nouvelle colonne `stats_daily` par question** dès maintenant.

## 9. Vie privée

- Aucun contenu, aucun texte libre, aucun e-mail (§2.5). Identifiants internes seulement.
- Pseudonyme (`anon_id`, `owner_id`), lisible par le seul admin, sur le VPS (UE), purge à 13 mois.
- Aucun tiers ajouté. **App Privacy** : la catégorie reste « Usage Data › Product Interaction »,
  déjà couverte par le ping et les compteurs — **à vérifier sur ASC avant la promotion en prod**
  (`scripts/apple-connect.mjs`), pas de nouvelle catégorie attendue.
- Les événements ne sont pas un journal de sécurité : pas d'IP, pas d'user-agent.

## 10. Lots

| Lot | Contenu | Effort | Vérification |
|---|---|---|---|
| **0 — socle** | migration 051 (table, index, purge, privilèges) + `db:types` · cookie `mijote_aid` dans le proxy · `catalog.ts` · `client.ts` + `EventsProvider` (flux A, B, `ui.seen`, batcher, beacon) · `server.ts` (`trackEvent`, `trackApiCall` dans `withOwnerAuth` + routes publiques) · `POST /api/events` · `error_code` sur les routes d'import · exclusions sonde/admin/démo · purge dans `demo-reset` | ½ j | vitest (validation du lot, allow-list, borne `at`, sonde ⇒ 204, extraction `error_code`) ; E2E : un spec **sans** en-tête sonde qui poste un lot et vérifie la ligne ; le harnais E2E (sonde par défaut) ne doit écrire **aucune** ligne ailleurs |
| **1 — identifiants** | pose des `data-track` (§6.5) et `data-seen` · `error.shown` · `recipe.cooking_started` · `app.opened`/`resumed` · `catalog.test.ts` (garde-fou) | ½ j | `catalog.test.ts` vert ; parcours manuel sur staging : landing → carnet → import URL → recette → partage, puis lecture des lignes |
| **2 — lecture** | migration 052 (vues) · `scripts/events/queries/` · `/admin/parcours` + lien Explorer | ½ j | vues vérifiées sur staging après le parcours manuel du lot 1 ; page Parcours affiche la session |
| 3 — rollup | tuiles v3 depuis `events` | à la demande | — |

Lots 0 + 1 + 2 sur `staging` en une passe (la donnée s'accumule dès le déploiement) ; promotion en
prod après le **protocole de vérification** de `docs/reviews/2026-09-12-revue-architecture.md`
(tsc, lint, vitest, E2E, contrôles staging, Sentry) et **`migrate.mjs prod --dry-run` relu juste
avant** (incident 046). Q1 / Q3 / Q6 lisibles deux à trois semaines après la mise en prod.

## 11. Ce qu'on ne fait pas

- Pas de session replay, pas de heatmap, pas de SDK tiers, pas de consentement supplémentaire.
- Pas de tracking des pages admin ni des sondes.
- Pas de texte de bouton, de titre, d'URL ou de saisie dans `props` — jamais, même « pour déboguer ».
- Pas de `localStorage` de file d'attente (une file perdue à la fermeture est acceptable).
- Pas de nouvelle colonne `stats_daily` pour une question qui peut se lire dans `events`.
- Pas de vue « intelligente » qui devine : une vue = un motif brut explicite et lisible.

## 12. Journal

- **2026-09-18 (soir)** — props `ig_path` / `ig_fallback` / `ig_read_ms` sur l'`api.called` de
  l'import URL quand la source est Instagram (lecture directe des pages publiques, Apify en
  secours). Pas de nouvel événement ni de vue : requête `instagram-paths.sql` + voyant Santé.
- **2026-09-18** — prop `image_kind` sur l'`api.called` de l'import photo (étape 1 du chantier
  « OCR sur l'appareil » : mesurer la part captures / pages imprimées / manuscrits avant de
  pondérer le banc Apple Vision). Pas de nouvel événement ni de vue : requête `image-kinds.sql`.
- **2026-09-16 (16 h)** — deux réglages issus des premières lectures (« go » d'Anthony, données
  voulues pour la relecture d'octobre) : `entry.in_app = "share-extension"` quand la page est chargée
  avec `?ext=1` (l'archétype « import par partage » devient mesurable) ; `data-seen` sur « Enregistrer »
  du formulaire (« l'ont-ils vu avant de faire retour ? »). **Relecture ≈ 2026-10-06.**
- **2026-09-16 (15 h)** — **premières lectures prod** (2 664 événements, 19 appareils, 17 personnes
  en 15 h) : parcours lisibles, funnel d'import déjà exploitable, zéro anomalie structurelle. Trois
  corrections (migration **055**) : **`app.opened` jamais émis en prod** (activation du journal après
  l'émission ; le Strict Mode de dev masquait le défaut — c'est la ligne « ping vs app.opened » de
  `reconcile.sql` qui l'aurait montré) ; **lectures automatiques exclues du flux C** (polling
  `/status` = 158 lignes sur 442, tags, bibliothèque, liste) ; **`recipe.cooking_started` retiré**
  (le wake lock part à chaque ouverture de fiche, 113 pour 115 vues — « on cuisine » = fiche ouverte
  ≥ 2 min, `v_cooking` redéfinie sur la durée) ; `v_sessions.platform` = majoritaire hors `unknown`.
- **2026-09-16 (00 h 30)** — **tout cliquable nommé** (111 identifiants, règle en CI) après les
  premières lignes prod (tests d'Anthony : quatre `?a` / `?button` sur son parcours). Et : owner
  `is_probe` muet dans le journal (son shell iOS n'a pas le cookie sonde), `?probe=1` accepté sur
  toute page (lien universel pour marquer le shell), garde contre le double `screen.left` iOS.
- **2026-09-15 (nuit)** — **origine d'entrée + site d'import** (migration 053, `v_entries`,
  `sources.sql`) après la question d'Anthony « que ne pourra-t-on pas analyser ? » : la source
  d'acquisition web était le trou principal. Rappel des limites : referrer vide depuis les apps
  et le shell natif ; source d'installation iOS invisible par personne (agrégat App Analytics
  seulement) ; pont web → App Store → app non reliable (deux `anon_id`).
- **2026-09-15 (soir)** — **lots 0 + 1 + 2 livrés sur `staging`** en une passe : migrations 051 +
  052, `catalog.ts` / `client.ts` / `server.ts` / `api-call.ts`, `EventsProvider` (racine, hors
  admin), `POST /api/events`, cookie `mijote_aid` + `x-anon-id` dans le proxy, ~45 `data-track`,
  13 vues, 6 requêtes dans `scripts/events/queries/` + `query.mjs` (lecture seule, ssh),
  `/admin/parcours` (+ lien Explorer). Vérifié : tsc, lint, 999 vitest (dont anti-dérive et
  validation du lot), 62 E2E dont `18-events` (vrai visiteur de bout en bout, sonde muette,
  allow-list), page Parcours lue sur la stack locale. Écarts avec le cadrage : `error_code` =
  `code` existant ; identifiants sans élément d'UI non créés ; effet écrans idempotent (Strict
  Mode) ; `trackEvent` attendu (piège `cookies()` dans `after()`).
- **2026-09-15** — cadrage (discussion « Amplitude open-source ? ») : diagnostic « pas d'outil, pas de
  granularité » ; PostHog self-hosted écarté (VPS 3,7 Go, support abandonné, App Privacy) ;
  choix brut + vues a posteriori plutôt que moments explicites (décision Anthony) ; `recipe_id` et
  identifiants gardés, contenu exclu. Spec rédigée.
