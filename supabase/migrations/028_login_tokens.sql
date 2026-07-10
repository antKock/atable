-- 028: login_tokens — récupération d'accès + fusion d'owners (Lot 2, #14).
-- Cf. docs/specs/foyer/04-lot2-recuperation.md.
--
-- Un token = un email envoyé (magic-link + code 6 chiffres). Secrets HASHÉS
-- au repos (SHA-256) : le bearer en clair ne vit que dans l'email. Sûre à
-- appliquer avant le code (migration avant code) : table neuve, rien ne la lit.

CREATE TABLE login_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('recovery', 'merge')),
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 du token du magic-link (alphabet share-token, 48+ bits)
  code_hash   TEXT NOT NULL,          -- SHA-256 du code 6 chiffres
  expires_at  TIMESTAMPTZ NOT NULL,   -- 15 min
  attempts    INT NOT NULL DEFAULT 0, -- essais de code ; max 5 puis token brûlé
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_tokens_owner_id ON login_tokens(owner_id);

-- Même modèle que le reste (005/027) : RLS activée SANS policy — service role
-- only, règles 100 % applicatives.
ALTER TABLE login_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Fusion d'owners (§5 de la spec) — exécution ATOMIQUE du plan
-- ============================================================
-- Les décisions (union des memberships, rôle le plus fort, nom) sont calculées
-- côté app par la fonction pure mergePlan (src/lib/auth/merge-plan.ts, unit-
-- testée) ; cette fonction n'exécute le plan qu'en un bloc transactionnel —
-- PostgREST ne permet pas de transaction multi-requêtes, un échec au milieu
-- laisserait deux identités à moitié fusionnées.
--
-- La cible = l'owner qui portait déjà recovery_email. Le cookie du device
-- courant reste valide : son sid ne change pas, sa session est repointée.
CREATE FUNCTION merge_owners(
  p_source_id uuid,
  p_target_id uuid,
  p_name text,
  p_adopt_household_ids uuid[],   -- memberships source à repointer (foyers absents de la cible)
  p_upgrade_household_ids uuid[]  -- memberships cible à passer 'member' (source member, cible guest)
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE owners SET name = p_name WHERE id = p_target_id;

  UPDATE memberships SET owner_id = p_target_id
   WHERE owner_id = p_source_id
     AND household_id = ANY(p_adopt_household_ids);

  UPDATE memberships SET role = 'member'
   WHERE owner_id = p_target_id
     AND household_id = ANY(p_upgrade_household_ids);

  UPDATE device_sessions SET owner_id = p_target_id WHERE owner_id = p_source_id;
  UPDATE daily_activity  SET owner_id = p_target_id WHERE owner_id = p_source_id;

  -- Cascade : les memberships source restants (foyers en doublon) partent avec.
  DELETE FROM owners WHERE id = p_source_id;
END;
$$;
