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
| 1 | `03-lot1-hub-profil.md` | Hub « Toi + Tes foyers », détail foyer, profil (nom + alias) | à faire |
| 2 | `04-lot2-recuperation.md` | #14 : email de secours, hints, fork onboarding, récup Resend, fusion | à faire |
| 3 | `05-lot3-invite.md` | #15a : rôle invité, 2 liens d'invitation, membres + révocation, lecture seule | à faire |
| 4 | `06-lot4-multi-foyer.md` | #15b : multi-appartenance, choix de foyer, filtre biblio, déplacer | à faire |

**À la fin de chaque lot : mettre à jour la colonne Statut ici** (`staging` quand
déployé sur staging, `done` quand promu en prod — même convention que le backlog).

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
10. **Pas de foyer par défaut** : choix du foyer à chaque enregistrement (dialog),
    masqué en mono-foyer. Foyer invité = jamais une destination (grisé).
11. **Marqueur d'origine biblio** = label texte discret (nom du foyer), jamais de
    couleur. Filtre foyer = pill « Foyer » multi-select dans la `FilterBar`
    (pattern Popover existant). Rien sur la home.
12. **Magic link ouvre le web** ET l'app via Universal Link ; repli code 6 chiffres
    obligatoire. Emails : deux propositions HTML visualisables en navigateur avant
    implémentation (Anthony arbitre).

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

## Definition of Done commune à tous les lots

1. `npx tsc --noEmit` propre (hors `temp/`), eslint propre, vitest vert.
2. Suite E2E complète verte (caractérisation + tests du lot).
3. Non-régression démo vérifiée (flow « Essayer l'app » dans la suite E2E).
4. Statut du lot mis à jour dans ce fichier ; note vault mise à jour si jalon
   (cf. `CLAUDE.md` racine).
