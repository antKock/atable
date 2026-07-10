-- 027: owners + memberships — primitif partagé du chantier foyer (#14 récupération
-- d'accès + #15 multi-foyer à rôles). Cf. docs/specs/foyer/02-lot0-data-session.md.
--
-- Modèle cible : le foyer appartient à un owner abstrait (PAS un compte) ; un
-- device n'est qu'une session pointant vers cet owner ; l'appartenance est une
-- ligne memberships(owner_id, household_id, role).
--
-- Sûre à appliquer AVANT le déploiement du code (migration avant code) :
--   - device_sessions.owner_id reste NULLABLE — l'ancien code insère des
--     sessions sans owner_id ; un SET NOT NULL casserait l'onboarding entre le
--     db push et le déploiement. Le verrou viendra avec le décommissionnement
--     de device_sessions.household_id en fin de chantier.
--   - le backfill est idempotent (ré-exécutable si des sessions sans owner
--     naissent dans la fenêtre db push → deploy).

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE owners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT,        -- NULL → alias auto dérivé de l'id (jamais stocké)
  recovery_email TEXT UNIQUE, -- normalisé lowercase côté app ; propre à #14
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'guest')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, household_id)
);
CREATE INDEX idx_memberships_household_id ON memberships(household_id);

-- Même modèle que le reste (005) : RLS activée SANS policy — service role only,
-- les règles de rôle sont 100 % applicatives.
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- 1 owner ↔ N sessions
ALTER TABLE device_sessions
  ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE CASCADE;
CREATE INDEX idx_device_sessions_owner_id ON device_sessions(owner_id);

-- Attribution analytics. SET NULL : les lignes survivent à la purge des owners
-- démo, comme daily_activity.device_id survit à la suppression des sessions.
ALTER TABLE daily_activity
  ADD COLUMN owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Backfill (idempotent)
-- ============================================================

-- 1 owner par device_session — TOUTES, révoquées comprises : l'owner est une
-- identité, pas un accès. Les owners backfillés réutilisent l'id de leur
-- session (déterministe → ré-exécutable) ; les owners créés par le code auront
-- leur propre gen_random_uuid().
INSERT INTO owners (id, created_at)
SELECT ds.id, ds.created_at
FROM device_sessions ds
WHERE ds.owner_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE device_sessions SET owner_id = id WHERE owner_id IS NULL;

-- 1 membership 'member' par session NON révoquée, vers son foyer legacy.
INSERT INTO memberships (owner_id, household_id, role)
SELECT ds.owner_id, ds.household_id, 'member'
FROM device_sessions ds
WHERE ds.is_revoked = false
ON CONFLICT (owner_id, household_id) DO NOTHING;

UPDATE daily_activity da
SET owner_id = ds.owner_id
FROM device_sessions ds
WHERE da.device_id = ds.id AND da.owner_id IS NULL;

-- ============================================================
-- 3. recipes.household_id : SET NULL → CASCADE + NOT NULL
-- ============================================================
-- Décision n°4 du socle : suppression d'un foyer = suppression en cascade de
-- ses recettes ; fini les recettes orphelines.
--
-- Constat au 2026-07-09 : les seules recettes household_id IS NULL sont 7
-- doublons de test en prod (« Tarte aux pommes maison », créés en 12 min le
-- 2026-07-05) ; staging = 0. On purge et on verrouille : le code insère
-- toujours household_id (la « migration V1 » de POST /api/households devient
-- un no-op, décommissionnée en fin de chantier).
DELETE FROM recipes WHERE household_id IS NULL;
ALTER TABLE recipes ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE recipes
  DROP CONSTRAINT recipes_household_id_fkey,
  ADD CONSTRAINT recipes_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
