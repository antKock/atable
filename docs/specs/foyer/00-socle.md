# Chantier « Foyer » — Socle commun (#14 récupération d'accès + #15 multi-foyer à rôles)

> **À lire en premier par toute session Claude Code travaillant sur un lot.**
> Ce document porte le contexte partagé ; chaque lot a sa spec (`01-…` à `06-…`).
> Les maquettes hi-fi et le README design sont dans `./handoff/` (copie versionnée du
> handoff v5). En cas d'écart doc ↔ composant réel, **le composant réel fait foi**.

## Vue d'ensemble

Deux features convergent sur l'écran `/household` et un même primitif de données :

- **#14 — Récupération d'accès** : survivre à la perte/changement d'appareil via un
  email de secours 100 % optionnel (« casier de secours », PAS un compte).
- **#15 — Multi-foyer à rôles** : appartenir à plusieurs foyers, en *membre*
  (lecture + écriture) ou *invité* (lecture seule, live).

Le primitif partagé : le foyer appartient à un **`owner`** abstrait ; le device n'est
qu'une **session** pointant vers cet owner ; l'appartenance est une ligne
**`membership(owner_id, household_id, role)`**.

## Ordre des lots (strictement séquentiel)

| # | Spec | Contenu | Statut |
|---|---|---|---|
| P | `01-pre-lot-harnais.md` | Harnais E2E Playwright + Supabase local + tests de caractérisation ; préparation Universal Links `/recover` | done |
| 0 | `02-lot0-data-session.md` | Migration `owners`/`memberships`, résolution owner par requête, invisible pour l'utilisateur | done |
| 1 | `03-lot1-hub-profil.md` | Hub « Toi + Tes foyers », détail foyer, profil (nom + alias) | done |
| 2 | `04-lot2-recuperation.md` | #14 : email de secours, hints, fork onboarding, récup Resend, fusion | done |
| 3 | `05-lot3-invite.md` | #15a : rôle invité, 2 liens d'invitation, membres + révocation, lecture seule | done |
| 4 | `06-lot4-multi-foyer.md` | #15b : multi-appartenance, choix de foyer, filtre biblio, déplacer | done |

**À la fin de chaque lot : mettre à jour la colonne Statut ici** (`staging` quand
déployé sur staging, `done` quand promu en prod — même convention que le backlog).

> ⚠️ **Le Lot 1 reste sur staging jusqu'à la livraison du Lot 3** (décision Anthony,
> 2026-07-10). Il rend visibles les « membres fantômes » du backfill 027 alors qu'il
> supprime la liste d'appareils et sa révocation (décision n°5) : l'utilisateur verrait
> des inconnus dans son foyer sans aucun moyen de les retirer. Le Lot 3 réintroduit le
> retrait de membre. Lots 1→3 promus ensemble. Voir « Constats terrain » ci-dessous.

## Architecture ACTUELLE (cartographiée le 2026-07-09)

### Données (`supabase/migrations/`, dernière = `026`)

- `households(id, name, join_code UNIQUE, is_demo, created_at)` — migration `002`.
- `device_sessions(id, household_id FK CASCADE, device_name, platform, last_seen_at, is_revoked, created_at)` — un « membre » actuel = un appareil.
- `recipes.household_id` : **nullable**, FK `ON DELETE SET NULL` (migration `002`). Colonnes notables : `share_token` (unique partiel, `013`), `source`, `created_by_device_id`, `is_seed`.
- `daily_activity(household_id, device_id, day)` — heartbeat analytics (`008`).
- **RLS activée SANS policies** (`005`) : tout l'accès passe par le service role
  (`src/lib/supabase/server.ts`). Les règles de rôle seront donc 100 % applicatives.

### Auth (à bien comprendre avant tout lot)

- Pas d'utilisateurs. Cookie `atable_session` = **JWT signé** (jose HS256,
  `SESSION_SIGNING_SECRET`), payload `{ hid, sid, iat }` (`src/types/household.ts`),
  180 j glissants (re-signé après 30 j). Fichier central : `src/lib/auth/session.ts`.
- `src/middleware.ts` : vérifie le cookie, check révocation Redis (`revoked:<sid>`),
  **injecte `x-household-id` + `x-session-id`** sur chaque requête. Routes publiques
  dans `PUBLIC_ROUTES`/`PUBLIC_PREFIXES`.
- Consommation : `src/lib/api/with-household-auth.ts` (routes API) et lectures
  directes `headers().get('x-household-id')` dans les Server Components
  (`(app)/layout.tsx`, `home`, `library`, `household`, `recipes/[id]`, `admin/stats`).
- Le `household_id` n'est **jamais** un paramètre client : toujours déduit du cookie.
  `POST /api/recipes` ne reçoit aucun `household_id`.

### Onboarding & partage

- `LandingScreen.tsx` (menu → create/join/démo), `CreateHouseholdForm`,
  `CodeEntryForm` (tous deux extensibles via `onSuccess`/`headerSlot`).
- `POST /api/households` (crée foyer + session, migre recettes V1), `POST
  /api/households/join` (rate-limits IP + par code), `GET /api/households/lookup`,
  page `/join/[code]`. Code = `MOT-NNNN` (`src/lib/auth/join-code.ts`,
  `JoinCodeSchema` dans `src/lib/schemas/household.ts`).
- Partage recette : `share_token` 8 chars (`src/lib/auth/share-token.ts`), page
  publique `(public)/r/[token]`, `POST /api/recipes/copy` (copie + duplication des
  images Storage — **les images sont rangées par foyer dans le Storage**).

### Démo

- Foyer désigné par l'env `DEMO_HOUSEHOLD_ID`. Entrée : `POST /api/demo/session`.
- Protections : delete 403, exclu de join/lookup (`is_demo=false`), reset cron
  (`/api/cron/demo-reset`, garde les recettes `is_seed`), exclu des analytics.
- `(app)/layout.tsx` calcule `isDemo` et affiche `DemoBanner`, masque la bannière
  d'install. **Incident passé** (2026-06) : démo supprimable par ses visiteurs →
  4 semaines d'outage. Leçon : garde-fous serveur centralisés, pas éparpillés.

### Mobile / liens

- Capacitor iOS + Android (alpha fermée Play). L'app charge l'URL distante.
- Universal Links : entitlement iOS **domain-wide** (`applinks:mijote.anthonykocken.fr`
  + staging) déjà dans l'app publiée ; AASA **dynamique** (`src/app/api/aasa/route.ts`,
  liste les chemins `/r/*`, `/join/*`). Android : `pathPrefix` **en dur dans le
  manifest** (`android/app/src/main/AndroidManifest.xml`) → nouveau chemin = nouveau
  build Play. `DeepLinkHandler.tsx` route n'importe quel chemin du domaine — générique,
  pas de modif nécessaire.
- Gotcha récurrent : **cookie jar WKWebView ≠ Safari** (d'où le repli code 6 chiffres
  dans #14, et la bannière install 2 étapes).

## Architecture CIBLE

- `owners(id, name NULL, recovery_email NULL UNIQUE)` — nom vide → **alias auto**
  dérivé déterministe de l'id (jamais stocké). Pas d'avatar.
- `memberships(owner_id, household_id, role ∈ {member, guest}, UNIQUE(owner_id, household_id))`.
- `device_sessions.owner_id` : 1 owner ↔ N sessions.
- **Le `sid` du JWT devient la clé de résolution** : chaque requête serveur résout
  `device_session → owner → memberships` en DB (le `hid` du JWT devient vestigial,
  AUCUNE migration de cookie nécessaire). La révocation d'accès = suppression de la
  ligne membership → effet immédiat.
- Écritures : `household_id` explicite dans le payload, validé contre un membership
  `role = member`. Lecture (biblio, carrousels) : union des foyers de l'owner.
- 1 recette = 1 foyer (`recipes.household_id` inchangé) ; « Déplacer » = update.

## Décisions actées (revue produit 2026-07-09 — ne pas re-litiger)

1. **Email** : Resend (plan gratuit). Clé dans `.env.local` (Anthony) ; à pousser dans
   Vercel staging + prod. L'email est saisi **au profil, sans envoi** ; l'envoi
   (magic-link + code) n'a lieu qu'à la récupération sur nouvel appareil.
2. **Universal Link `/recover` requis** : iOS = ajout AASA (serveur, pas de release) ;
   Android = manifest → release Play (alpha, peu coûteux). Préparé dès le pré-lot.
3. **Liens d'invitation** : réutiliser `join_code` comme lien **membre** ; ajouter un
   second code stable pour **invité**. Pas de régénération de lien au lancement.
4. **Suppression d'un foyer = suppression en cascade des recettes** (+ nettoyage
   Storage). Fini le `SET NULL`/recettes orphelines.
5. **Gestion par appareil abandonnée** : la liste de devices et `DELETE /api/devices/[id]`
   disparaissent au profit de la gestion des membres (retirer un membre = kick).
6. **Fusion d'owners uniquement depuis le profil** (email déjà pris) ; à la récup sur
   nouvel appareil = simple reconnexion. Anti-énumération à la récup (même écran que
   l'email existe ou non) ; la fuite d'existence côté profil est **assumée**.
7. **Démo = stratégie C (monde gelé)** : owner+membership normaux mais toute la surface
   foyer/membership/profil est coupée (UI **et** guard serveur central → 403).
   Conversion démo → owner neuf. Cron reset étendu aux owners/memberships démo.
   Hints #14 (partage/email) jamais affichés en démo.
8. **Dialog partout** : le `ui/dialog.tsx` existant sert pour mobile ET desktop.
   Pas de bottom-sheet à créer (précédent : remplacement de l'action-sheet Android
   dans `ScreenshotImporter.tsx`).
9. **Deux hints mineurs** de même gabarit : démo (CTA conversion) et install ;
   priorité démo ; install jamais en démo (déjà le cas). Le hint principal
   (partage/email) est distinct, un seul à la fois.
   **Hints = vue principale `/home` uniquement** (arbitrage 2026-07-11, Lot 3) :
   aucun hint (install + partage/email) sur les autres écrans (biblio, foyer,
   fiche…). Implémenté via `x-pathname` (middleware) + garde `isMainView` dans
   `(app)/layout.tsx`. Évite notamment un doublon d'affordance « Inviter
   quelqu'un » sur le détail de foyer (CTA du hint partage vs entrée d'invitation).
10. **Pas de foyer par défaut** : choix du foyer à chaque enregistrement (dialog),
    masqué en mono-foyer. Foyer invité = jamais une destination (grisé).
11. **Marqueur d'origine biblio** = label texte discret (nom du foyer), jamais de
    couleur. Filtre foyer = pill « Foyer » multi-select dans la `FilterBar`
    (pattern Popover existant). Rien sur la home.
12. **Magic link ouvre le web** ET l'app via Universal Link ; repli code 6 chiffres
    obligatoire. Emails : deux propositions HTML visualisables en navigateur avant
    implémentation (Anthony arbitre).

## Constats terrain — « membres fantômes » (mesuré en prod le 2026-07-10)

> Constat, pas décision. Documenté pour ne pas être re-découvert lot après lot.
> **Aucune action pour l'instant** (arbitrage Anthony) : on verra plus tard si
> c'est un vrai problème. Ne pas « corriger » sans re-poser la question.

**Le fait.** Le backfill de la 027 (Lot 0) a créé **un owner par `device_session`**.
Or une même personne possède plusieurs sessions. En prod, 74 owners, **aucun nommé** :

| Foyer | memberships | réalité probable |
|---|---|---|
| Los Kockenos | 11 | 2 humains |
| Bruno (106 recettes) | 6 | **1 humain** — 6 sessions créées en 5 jours d'onboarding, 1 seule porte les 106 recettes, les 5 autres n'ont **rien écrit** |
| Jojo & Toto | 4 | 2 humains |
| Chez Jojo & Toto | 3 | 1 humain (aucune session vue depuis 116 j) |
| Maison de Pauline & Ugo | 3 | 2 humains |
| Démo Mijote | 27 | 1 owner par visiteur (traité : vue solo au Lot 1) |

Invisible jusqu'au Lot 0 ; **rendu visible par le Lot 1** (liste des membres +
compteur « N personnes »). D'où la décision de **ne pas promouvoir le Lot 1 en prod
avant le Lot 3** (qui réintroduit le retrait de membre) — cf. tableau des lots.
La note « doublon de membre inoffensif » du Lot 1 est **invalidée** : le doublon est
la norme sur les foyers réellement utilisés, pas l'exception.

**La cause.** Une `device_session` ne naît QUE de trois inserts explicites
(`POST /api/households`, `POST /api/households/join`, `POST /api/demo/session`) —
relancer l'app n'en crée jamais (cookie `HttpOnly`, 180 j glissants, jar WKWebView
persistant). Mais **une session = un cookie jar + un join**, pas un téléphone : sur
un seul iPhone, Safari, Safari privé, Chrome iOS, la WebView de l'app, celle de la
Share Extension et chaque navigateur intégré (Instagram, WhatsApp…) sont des jars
distincts. `device_name` ne distingue d'ailleurs pas l'app native de Safari (Bowser
lit un UA Safari-like ; `MijoteNative/1.0` n'est pas enregistré).

**Le multiplicateur (défaut ouvert).** `/join/[code]` et `POST /api/households/join`
sont des routes **publiques** : la page ne lit jamais le cookie et la route crée
inconditionnellement owner + membership + session, puis écrase le cookie. Un
utilisateur **déjà membre** qui tape son propre lien d'invitation se fabrique donc
une identité neuve, l'ancienne gardant son membership. La bannière d'install
*demande explicitement* de rejoindre avec le code depuis l'app. C'est la fabrique à
fantômes. Correctif possible (~30 lignes, non décidé) : si la session courante
résout vers un owner déjà membre du foyer visé, ne rien créer et rediriger `/home`.

**Ce que la fusion du Lot 2 ne réglera pas.** Elle se déclenche à la saisie d'un
email déjà pris depuis le profil : il faudrait reposer le même email depuis chaque
jar encore vivant. Les sessions dormantes (Chez Jojo & Toto, 116 j) ne fusionneront
jamais. Le tri restera manuel, via le retrait de membre du Lot 3.

## Conventions de développement (rappel)

- **Migration avant code** : la migration DB se déploie et s'applique (staging) avant
  le code qui en dépend. `supabase db push --linked` (re-link pour changer d'env).
- Branche `staging` = déploiement auto Vercel. `main` = prod, protégée : promotion
  via `gh pr create` + `gh pr merge --admin` avec le compte gh **antKock**.
- CI = eslint + `tsc --noEmit` + vitest. Lancer les trois en local avant commit.
  Les E2E Playwright (pré-lot) se lancent en local : ils sont le filet de
  non-régression — **un lot n'est terminé que si toute la suite E2E passe**.
- Utiliser `/verify` avant de committer un lot ; ne pas committer sans feu vert
  des suites.
- Un lot = une PR staging. Soak de quelques jours sur staging avant promotion main.
- Copies d'écran / composants : réutiliser le DS (Tailwind 4, shadcn, Radix,
  tokens de `globals.css`). Si un composant ne se réutilise pas tel quel :
  **s'arrêter et prévenir** (composant, raison, option de refacto minimale).
- Wording : tout en français, ajouter les chaînes dans `src/lib/i18n/fr.ts`.

## Lot 4 — décisions d'implémentation (livré sur staging)

> Notes pour les sessions suivantes (promotion prod, débogage).

- **Aucune migration DB** : le schéma du Lot 0 (memberships `UNIQUE(owner_id,
  household_id)`) supporte déjà N appartenances. Lot 4 = 100 % applicatif.
- **`hid` du JWT + header `x-household-id` décommissionnés** : `signSession` ne
  signe plus que `sid` ; `verifySession` ignore un éventuel `hid` (anciens
  cookies valides, **aucune migration de cookie**) ; le middleware n'injecte
  plus `x-household-id`. Tout scoping passe par `getOwnerContext` (résolution
  `session → owner → memberships` en DB). `withHouseholdAuth` supprimé au profit
  de `withOwnerAuth` + `requireMember(owner, householdId)`.
- **Rejoindre / créer additif** : `POST /api/households/join` et `POST
  /api/households` détectent la session courante (lecture directe du cookie, ces
  routes sont publiques) et ajoutent un membership à l'owner **sans** nouvelle
  session ni réécriture de cookie. Owner démo → chemin « owner neuf »
  (conversion), jamais d'ajout sur/de la démo. Fusion des rôles au re-join :
  `planRoleMerge` (jamais de rétrogradation).
- **Quitter/supprimer un foyer parmi N** : la session survit tant qu'il reste
  ≥1 membership (retour au hub, cookie intact). `device_sessions.household_id`
  garde une FK `ON DELETE CASCADE` (colonne vestigiale) : avant de **supprimer**
  un foyer alors qu'il en reste d'autres, on **repointe** la session courante
  vers un foyer survivant pour éviter que la cascade ne détruise la session.
- **Dernier membre qui quitte = suppression du foyer** (arbitrage 2026-07, revue
  sécurité) : un `action=leave` par le dernier membre réel détruit le foyer
  (cascade + purge Storage), peu importe les invités restants — plus jamais
  d'orphelin. UI : « Quitter » masqué pour le dernier membre (seule « Supprimer »
  reste). Un invité, ou un membre non-dernier, ne fait que retirer son membership.
- **Gardes de suppression durcis (revue sécurité, avant prod)** : `action=delete`
  exige désormais `requireMember` (un invité ne peut plus détruire un foyer) ; la
  page détail ne sérialise plus le `join_code` membre vers un invité (escalade
  invité→membre via re-join fermée) ; purge Storage corrigée (regex `[^?]+`, le
  cache-buster `?v=` faisait un `remove()` no-op → images orphelines).
  *Limite connue non traitée* : si un AUTRE appareil du même owner avait sa
  session pointée vers le foyer supprimé, il est déconnecté (cascade) — cas
  extrême, non couvert (une nullabilité de la colonne serait la vraie fin de
  décommissionnement, hors périmètre Lot 4).
- **Défaut ouvert « join non idempotent »** (fabrique à fantômes) : toujours
  **non traité** (arbitrage Anthony) — cf. « Constats terrain ».

## Correctifs post-release (Lots 1-4 en prod — branche `foyer-post-release-fixes`)

> Petits bugs remontés après la mise en prod. Un correctif par bug ; tests
> unit/E2E ajoutés (`e2e/15-foyer-post-release-fixes.spec.ts`,
> `RecoveryCodeInput.test.tsx`, cas Whisper dans `import.test.ts`).

1. **Créer un foyer depuis le hub → Home** : `POST /api/households` (chemin
   additif) renvoyait `redirect: /household/<id>` (édition du nouveau foyer).
   Renvoie `/home`. Le chemin cold-onboarding aussi (voir #9).
2. **Filtre « Foyer » en tête** : dans `FilterBar`, la pill « Foyer » est
   rendue en première position (avant « De saison »), toujours gardée par
   `foyers.length > 1`.
3. **Coller le magic code (mobile)** : `RecoveryCodeInput` gère désormais un
   `onPaste` explicite (certaines WebView ne routent pas le collage via
   `onChange` dans un champ contrôlé).
4 & 8. **Hints déplacés du layout vers `HomeHints` (page /home)** : rendus SOUS
   la top bar et uniquement sur la Home. Un layout partagé ne se ré-évalue pas
   à la navigation client → le hint restait collé après un clic (bug 4) et se
   peignait au-dessus de la top bar (bug 8). `x-pathname`/`isMainView`
   décommissionnés (middleware nettoyé).
5. **Safe-area bas Android** : `paddingBottom` des `main` (app + fullscreen)
   inclut `env(safe-area-inset-bottom)` (edge-to-edge forcé, targetSdk 36).
   **Correctif web (déployé via l'URL distante, pas de build Play).**
   ⚠️ **À valider sur un vrai appareil Android** : si la WebView Android ne
   renseigne pas `env(safe-area-inset-*)`, il faudra le plugin
   `@capacitor-community/safe-area` (→ build Play). Non vérifiable en E2E.
6. **Dialog rôle** : `MemberActionDialog` — la ligne « Retirer du foyer » porte
   désormais une icône (LogOut) comme la bascule de rôle → lignes icône+libellé
   homogènes (maquette 2.2).
7. **Freeze au 2ᵉ retrait de membre** : cause réelle = `isSubmitting` restait à
   `true` après un retrait réussi (reset seulement dans le `catch` ;
   `router.refresh()` ne redémonte pas le composant client) → boutons
   `disabled` (`pointer-events:none`) ET `close()` bloqué au 2ᵉ membre. Reset de
   `isSubmitting` à chaque ouverture. `DialogContent` piloté par l'état `open`
   de Radix (plus de démontage brutal `{member && …}`).
9. **Ancien hint « foyer créé - code invitation »** : `PostCreationBanner`
   supprimé (remplacé par le hint partage de la Home) ; le `redirect` cold-create
   ne porte plus `?code=&householdName=`.
10. **Transcript audio multilingue** : `extractRecipeFromVoice` ne force plus
    `language: "fr"` sur Whisper (auto-détection) — une dictée en portugais, etc.
    ne cassait plus.

## Definition of Done commune à tous les lots

1. `npx tsc --noEmit` propre (hors `temp/`), eslint propre, vitest vert.
2. Suite E2E complète verte (caractérisation + tests du lot).
3. Non-régression démo vérifiée (flow « Essayer l'app » dans la suite E2E).
4. Statut du lot mis à jour dans ce fichier ; note vault mise à jour si jalon
   (cf. `CLAUDE.md` racine).
