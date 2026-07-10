-- 029: vérification atomique du code de récupération (#14, Lot 2 — durcissement
-- post-revue). Cf. docs/specs/foyer/04-lot2-recuperation.md.
--
-- L'ancienne vérification lisait `attempts` puis l'incrémentait en deux requêtes
-- distinctes (read-modify-write applicatif) : sous rafale concurrente, N essais
-- lisent tous la même valeur et écrivent tous k+1 (last-writer-wins) → le
-- compteur n'avance quasiment pas et le plafond « 5 essais puis token brûlé »
-- devient contournable (brute-force des 10^6 codes sur les 15 min du token).
--
-- Ici tout se joue dans UNE fonction : SELECT ... FOR UPDATE sérialise les accès
-- concurrents au token, l'incrément et le claim single-use sont donc atomiques.

-- Doit rester aligné sur LOGIN_CODE_MAX_ATTEMPTS (src/lib/auth/login-token.ts).
CREATE FUNCTION verify_login_code(
  p_owner_id  UUID,
  p_purpose   TEXT,
  p_code_hash TEXT
) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_id       UUID;
  v_hash     TEXT;
  v_attempts INT;
BEGIN
  SELECT id, code_hash, attempts
    INTO v_id, v_hash, v_attempts
    FROM login_tokens
   WHERE owner_id = p_owner_id
     AND purpose = p_purpose
     AND used_at IS NULL
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  -- Aucun token actif, ou déjà brûlé par 5 essais ratés.
  IF v_id IS NULL OR v_attempts >= 5 THEN
    RETURN 'invalid';
  END IF;

  IF v_hash = p_code_hash THEN
    UPDATE login_tokens SET used_at = NOW() WHERE id = v_id;
    RETURN 'ok';
  END IF;

  UPDATE login_tokens SET attempts = attempts + 1 WHERE id = v_id;
  RETURN 'invalid';
END;
$$;
