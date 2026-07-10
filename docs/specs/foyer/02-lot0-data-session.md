# Lot 0 — Data + session : le primitif `owner`/`membership`

> Lire d'abord `00-socle.md`. Prérequis : pré-lot (harnais E2E vert).
> **Lot invisible** : aucun changement d'UI ni de comportement. Sa réussite se mesure
> à la suite de caractérisation qui reste verte SANS modification, et au script de
> vérification du backfill.

## Objectif

Poser le primitif de données partagé par #14 et #15, et faire basculer la résolution
d'identité de « le JWT porte le foyer » à « le JWT porte la session ; la DB porte
l'owner et ses appartenances » — sans toucher aux cookies existants.

## 1. Migration `026_owners_memberships.sql`

```sql
CREATE TABLE owners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT,                    -- NULL → alias auto (dérivé, jamais stocké)
  recovery_email TEXT UNIQUE,             -- normalisé lowercase côté app ; propre à #14
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','guest')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, household_id)
);
CREATE INDEX ON memberships(household_id);

ALTER TABLE device_sessions ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE CASCADE;
CREATE INDEX ON device_sessions(owner_id);

ALTER TABLE daily_activity ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- Backfill : 1 owner par device_session (toutes, révoquées comprises — l'owner est
-- une identité) ; 1 membership 'member' par session NON révoquée.
-- daily_activity.owner_id backfillé via device_id → device_sessions.owner_id.
-- Puis : ALTER TABLE device_sessions ALTER COLUMN owner_id SET NOT NULL;
```

- RLS : activer sur `owners`, `memberships` **sans policy** (même modèle que le
  reste — service role only).
- **`recipes.household_id`** (décision n°4 du socle) : passer la FK en
  `ON DELETE CASCADE`. Vérifier d'abord s'il reste des `household_id IS NULL`
  (recettes V1 non migrées) — si zéro sur staging ET prod, ajouter `SET NOT NULL` ;
  sinon les rattacher/purger d'abord (décider au vu des données réelles).
- Écrire la migration idempotente là où c'est possible ; tester via
  `supabase db reset` local (le harnais la rejoue à chaque run E2E).

## 2. Résolution owner par requête (le cœur du lot)

**Principe : le `sid` du JWT est la seule clé.** Pas de nouveau champ dans le JWT,
pas de migration de cookie : les cookies existants `{hid, sid}` continuent de
fonctionner, `hid` devient vestigial (gardé pour rollback).

- Nouveau module `src/lib/auth/owner-context.ts` :
  ```ts
  type OwnerContext = {
    ownerId: string;
    sessionId: string;
    memberships: { householdId: string; role: 'member' | 'guest'; isDemo: boolean }[];
  };
  // getOwnerContext(): résout x-session-id → device_sessions(owner_id, is_revoked)
  // JOIN memberships JOIN households(is_demo) en UNE requête service role.
  // null si session inconnue/révoquée. Mémoïsé par requête (React cache()).
  ```
- `src/lib/api/with-owner-auth.ts` : équivalent de `withHouseholdAuth` fournissant
  `OwnerContext` + helpers :
  - `requireMember(ctx, householdId)` → 403 si pas membership `member` (posé
    maintenant, utilisé à partir du Lot 3) ;
  - `assertNotDemoMutation(ctx, householdId)` → 403 sur toute mutation
    foyer/membership/profil visant la démo (**stratégie C** — LE garde-fou central,
    posé maintenant, branché sur les routes au fil des lots).
- **Compatibilité transitoire** : réimplémenter `withHouseholdAuth` PAR-DESSUS
  `getOwnerContext()` — `householdId` = l'unique membership de l'owner (invariant
  vrai jusqu'au Lot 4). Signature et comportement identiques → **aucune route
  existante ne change**. Les Server Components qui lisent `x-household-id`
  continuent de marcher (le middleware continue d'injecter le header depuis le JWT).
  La bascule des lectures vers `getOwnerContext` se fera route par route dans les
  lots suivants, pas ici.
- Middleware : inchangé (vérif cookie + révocation Redis + injection headers).

## 3. Écritures : créer l'owner aux points d'entrée

- `POST /api/households` (créer) : crée `owner` → `household` → `membership(member)`
  → `device_session(owner_id)` → JWT. Conserver la migration des recettes V1.
- `POST /api/households/join` : crée `owner` + `membership(member)` + session.
  (Un device qui « change de foyer » crée donc un owner neuf — comportement actuel
  conservé ; l'additivité arrive au Lot 4.)
- `POST /api/demo/session` : idem vers le foyer démo.
- `DELETE /api/households/[id]?action=leave|delete` :
  - `leave` = supprimer le membership de l'owner (+ comportement actuel de sortie) ;
  - `delete` = **nettoyer le Storage des images du foyer PUIS supprimer le foyer**
    (cascade DB efface recettes + memberships). S'inspirer de la manipulation
    Storage de `POST /api/recipes/copy` pour lister/supprimer les objets du foyer.
- Heartbeat `/api/activity/ping` : renseigner `daily_activity.owner_id`.

## 4. Cron démo (stratégie C, part data)

`/api/cron/demo-reset` : en plus des recettes non-seed, purger les
`memberships`/`owners`/`device_sessions` du foyer démo plus vieux que N jours
(N = aligné sur la rétention actuelle des sessions démo ; ne PAS toucher aux owners
ayant un membership hors démo — impossible en théorie avant Lot 4, mais coder le
garde-fou quand même).

## 5. Script de vérification du backfill

`scripts/verify-owner-backfill.mjs` (service role, lancé sur staging puis prod après
`db push`) — doit imprimer PASS/FAIL sur :

- `count(device_sessions) == count(device_sessions where owner_id is not null)` ;
- `count(owners) == count(device_sessions)` (backfill 1:1) ;
- chaque session non révoquée a exactement 1 membership, vers son `household_id`
  legacy, rôle `member` ;
- aucun membership orphelin (owner ou household manquant) ;
- `daily_activity.owner_id` renseigné partout où `device_id` l'est encore.

## Tests

- **E2E : la suite de caractérisation passe inchangée.** C'est le critère n°1.
- Unit (vitest) : `getOwnerContext` (session inconnue / révoquée / ok),
  `requireMember`, `assertNotDemoMutation`, compat `withHouseholdAuth`.
- E2E additionnel : un cookie forgé avec un `sid` inexistant → traité comme
  déconnecté (redirect landing), pas de 500.

## Points de vigilance

- +1 requête DB par requête serveur : la mémoïser (`cache()`) pour que layout +
  page ne la fassent qu'une fois. Pas d'optimisation prématurée au-delà.
- Ne PAS supprimer `device_sessions.household_id` ni le header `x-household-id`
  dans ce lot (rollback possible, décommissionnement en fin de chantier).
- Migration avant code : `db push` staging → script de vérif → puis déploiement code.

## Definition of Done

- Migration appliquée staging + prod, script de vérif PASS sur les deux.
- Caractérisation E2E verte inchangée ; DoD commune du socle.
