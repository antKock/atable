# Lot 3 — Feature #15a : rôle invité, invitations à deux liens, membres & révocation

> Lire d'abord `00-socle.md` + `handoff/README.md` (Acte 2, §2.0–2.2) +
> `handoff/foyer-15.jsx` (InviteScreen, MembersScreen, MemberActionScreen).
> Prérequis : Lot 2 en staging. Toujours mono-appartenance (1 membership par owner) —
> la multi-appartenance est au Lot 4.

## Objectif

Livrer le rôle **invité** (lecture seule, live) : les deux liens d'invitation
stables par rôle, la gestion des membres (changer de rôle, retirer), et surtout
l'**enforcement lecture seule sur toutes les écritures** — 100 % applicatif (RLS
sans policies), donc c'est LE sujet de test du lot.

## 1. Migration `028_guest_join_code.sql`

```sql
ALTER TABLE households ADD COLUMN guest_join_code TEXT UNIQUE;
-- Backfill : générer un code (générateur join-code existant) pour chaque foyer.
-- Puis SET NOT NULL. Les nouveaux foyers en reçoivent un à la création.
```
Le `join_code` existant reste le lien **membre** (décision n°3). Pas de
régénération de lien au lancement (backlog).

## 2. Rejoindre avec un rôle

- `/join/[code]` + `POST /api/households/join` + `GET /api/households/lookup` :
  résoudre le code contre `join_code` OU `guest_join_code` → le rôle du membership
  créé en découle. Toujours `is_demo = false`, mêmes rate-limits.
- La confirmation (`JoinConfirmation`) affiche le rôle : copy « en lecture seule,
  en direct » pour un code invité.
- Ce lot conserve la sémantique « rejoindre = nouvelle session/owner » (le switch
  additif in-app est au Lot 4).

## 3. Écran « Inviter » (maquette 2.1)

- Depuis le détail du foyer : « Inviter quelqu'un » (ligne accent, membres only) →
  écran plein `/household/[id]/invite` :
  - bloc **Membre** (icône Users accent, « consulte et modifie ») : lien
    `https://<host>/join/<join_code>` — réutiliser la grammaire
    `InviteLinkDisplay`/`CodeDisplay` (lien + code + copier) ;
  - bloc **Invité** (icône œil, « lecture seule, en direct ») : idem avec
    `guest_join_code` ;
  - note : « Pour retirer quelqu'un plus tard, va dans Membres — pas besoin de
    changer le lien. »
- Les blocs code/lien du détail de foyer (hérités du Lot 1) sont remplacés par
  cette entrée « Inviter ».

## 4. Membres : action rôle-aware + retrait (maquettes 2.2, MemberActionScreen)

- Détail foyer : les chevrons des lignes membres deviennent actifs (pour les
  membres ; jamais en démo). Groupes « Membres » / « Invités » si les deux existent.
- Tap → **Dialog** (décision n°8 : pas de sheet) : nom + sous-titre rôle, puis :
  - membre → « Passer en invité (lecture seule) » ; invité → « Passer en membre
    (peut modifier) » → `PATCH /api/households/[id]/members/[ownerId] { role }` ;
  - « Retirer du foyer » (destructif) → `DELETE .../members/[ownerId]` = suppression
    du membership. **Effet immédiat** (résolution par requête du Lot 0) — copy :
    « La retirer coupe son accès immédiatement. »
- Règles serveur (withOwnerAuth + requireMember + assertNotDemoMutation) :
  - seul un **membre** du foyer gère les membres ;
  - pas d'action sur soi-même (se retirer = « Quitter », déjà couvert) ;
  - **jamais rétrograder/retirer le dernier membre** d'un foyer (un foyer sans
    membre est ingérable) → 409 avec message clair ;
  - viewer invité : ni inviter, ni gérer (l'UI cache, le serveur refuse).

## 5. Enforcement lecture seule (le cœur du lot)

- Généraliser `requireMember(ctx, householdId)` sur **toutes** les routes de
  mutation household-scopées : recipes create/update/delete, upload photo,
  imports IA, enrichissement, share-token mint, rename foyer, invitations, membres.
  Inventorier via `withHouseholdAuth`/`withOwnerAuth` (tout ce qui écrit) — en
  faire la liste exhaustive dans la PR.
- Invité, côté UI (détail foyer d'un foyer `role=guest`) :
  - bandeau lecture-seule (icône œil, « Tu peux consulter les recettes en direct,
    mais pas les modifier ») ; sous-titre « Invité · N personnes » ;
  - pas de crayon sur le nom, pas d'« Inviter », chevrons membres inertes,
    **seul « Quitter »** en bas ;
  - fiche recette d'un foyer invité : **pas de pill d'actions** (ni partager — le
    mint écrit un `share_token` — ni éditer/supprimer) ;
  - home/biblio : pas de CTA de création si l'unique foyer est en invité
    (cas mono-appartenance de ce lot).
- « invité → copier une recette dans son foyer » : **hors périmètre** (backlog),
  mais ne rien re-verrouiller qui l'empêcherait (`/api/recipes/copy` reste).

## Tests

- E2E (deux contextes navigateur A membre / B invité) :
  1. inviter par lien invité → B voit les recettes de A **en live** (A crée → B
     recharge et la voit) ;
  2. B en lecture seule PARTOUT : pas de pill d'actions, pas d'édition, et en
     direct-API : POST/PUT/DELETE recettes, rename, share-mint, gestion membres →
     tous **403** (boucle sur la liste des routes de mutation — LE test qui compte) ;
  3. A passe B membre → B peut créer/modifier ; A repasse B invité → re-403 ;
  4. A retire B → accès coupé immédiatement (page suivante → redirect landing ou
     foyer absent) ;
  5. dernier membre : A ne peut ni se rétrograder ni être retiré (409) ;
  6. lien membre → rôle membre (non-régression) ; codes invités exclus de la démo.
- Unit : résolution join_code vs guest_join_code, règles membres (dernier membre,
  self-action), requireMember.

## Points de vigilance

- Le « live » de l'invité = le polling/SWR existant, rien de plus (pas de realtime).
- Ne pas oublier les routes de mutation non évidentes : enrichissement, upload,
  activity ping (le ping n'écrit pas sur le foyer → reste autorisé).
- `LeaveHouseholdDialog` : « Supprimer le foyer » réservé aux membres.
- **Le Lot 1 attend ce lot pour partir en prod** (membres fantômes du backfill 027 :
  voir « Constats terrain » du socle). Le retrait de membre livré ici est donc le
  seul outil de ménage — le tri sera manuel, c'est assumé.
- **Défaut ouvert, non décidé** : `join` n'est pas idempotent. `/join/[code]` et
  `POST /api/households/join` sont publics, ne lisent jamais le cookie, et créent
  owner + membership + session même si le visiteur est **déjà membre** du foyer —
  chaque test de son propre lien d'invitation fabrique un fantôme. Correctif possible
  ici (~30 lignes) : si la session courante résout vers un owner déjà membre du foyer
  visé, ne rien créer et rediriger `/home`. **Re-poser la question à Anthony** avant
  de l'implémenter (arbitrage 2026-07-10 : « on verra plus tard »).

## Definition of Done

DoD commune + la matrice « invité ne peut pas écrire » exhaustive et verte.
