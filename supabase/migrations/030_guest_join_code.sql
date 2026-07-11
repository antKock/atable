-- 030: guest_join_code — second lien d'invitation stable par foyer (#15a, Lot 3).
-- Cf. docs/specs/foyer/05-lot3-invite.md §1.
--
-- Décision n°3 du socle : le join_code existant reste le lien MEMBRE ; on ajoute
-- un code stable distinct pour le rôle INVITÉ (lecture seule). Pas de
-- régénération de lien au lancement — les deux codes vivent avec le foyer.
--
-- Sûre à appliquer AVANT le déploiement du code (migration avant code) :
--   - la colonne naît NULLABLE, on backfille, puis SET NOT NULL ; l'ancien code
--     (qui n'écrit jamais guest_join_code) continue de fonctionner entre le
--     db push et le déploiement, et le nouveau code posera toujours les deux.
--
-- Invariant d'unicité GLOBALE : lookup/join résolvent un code saisi contre
-- join_code OU guest_join_code. Un guest_join_code ne doit donc collisionner ni
-- avec un autre guest_join_code (contrainte UNIQUE de colonne) NI avec un
-- join_code existant (sinon le même code résoudrait deux foyers). Le backfill
-- vérifie les DEUX colonnes ; la génération applicative fait de même.

ALTER TABLE households ADD COLUMN guest_join_code TEXT UNIQUE;

-- Backfill idempotent : un code WORD-NNNN par foyer sans guest_join_code, même
-- grammaire que le générateur applicatif (src/lib/auth/join-code.ts), unique
-- across join_code + guest_join_code de TOUS les foyers.
DO $$
DECLARE
  words TEXT[] := ARRAY[
    'OLIVE','THYME','CUMIN','ANISE','BASIL','FENNEL','CAPER','SORREL',
    'SAGE','MISO','DASHI','SUMAC','TAHINI','SAFFRON','PAPRIKA','CARAWAY',
    'CHIVE','CLOVE','CURRY','FARRO','GHEE','JUNIPER','KOMBU','LEMON',
    'MAPLE','NETTLE','ORZO','PANKO','QUINCE','RAMEN','SOBA','TAMARI',
    'UMAMI','VADOUVAN','WALNUT','YUZU','MIRIN','HARISSA','ZAATAR','DUKKAH',
    'FURIKAKE','GARAM','HERBES','IKURA','JICAMA','KATSU','LAVENDER',
    'MACE','NIGELLA','PONZU'
  ];
  h RECORD;
  candidate TEXT;
BEGIN
  FOR h IN SELECT id FROM households WHERE guest_join_code IS NULL LOOP
    LOOP
      candidate := words[1 + floor(random() * array_length(words, 1))::int]
                   || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM households
        WHERE join_code = candidate OR guest_join_code = candidate
      );
    END LOOP;
    UPDATE households SET guest_join_code = candidate WHERE id = h.id;
  END LOOP;
END $$;

ALTER TABLE households ALTER COLUMN guest_join_code SET NOT NULL;
