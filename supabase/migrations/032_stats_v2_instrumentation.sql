-- Migration 032: instrumentation du dashboard v2 (funnel démo → carnet).
--
-- Le dashboard ne mesurait rien AVANT la création du premier carnet, alors que
-- la conversion démo → carnet est l'étape clé du produit. Trois trous comblés :
--
--   1. Le lien démo → carnet n'était capturé nulle part : à la conversion,
--      POST /api/households sait que l'owner courant est démo… et jette l'info.
--      → owners.demo_trial_started_at (created_at de l'owner démo abandonné,
--        posé sur le NOUVEL owner) : conversions/jour = owners marqués par jour,
--        time-to-convert = owners.created_at - demo_trial_started_at.
--      → households.origin : mix de création des carnets (landing directe /
--        conversion démo / carnet additionnel d'un owner existant).
--
--   2. Les données démo s'autodétruisent (recettes purgées chaque nuit à 3 h,
--      owners démo purgés à 30 j → cascade sessions → daily_activity anonymisée).
--      → stats_daily : agrégat quotidien pérenne, rempli par demo_stats_rollup()
--        (appelée par le cron demo-reset AVANT les purges, upsert GREATEST donc
--        idempotente et jamais décroissante). Porte aussi le funnel des
--        login_tokens (#14), purgés eux aussi 24 h après expiration.
--
--   3. Les frictions démo (403 « monde gelé ») n'étaient jamais comptées.
--      → demo_track_frozen() : incrément atomique (leçon du Lot 2 : un
--        read-modify-write applicatif n'est pas un compteur).
--
-- recipes.last_moved_at : trace du « Déplacer vers un carnet » (Lot 4), sinon
-- invisible (simple UPDATE de household_id). Ne garde que le dernier déplacement
-- par recette — suffisant pour un compteur macro.

-- ============================================================
-- 1. Marqueurs de conversion
-- ============================================================

ALTER TABLE owners
  ADD COLUMN demo_trial_started_at TIMESTAMPTZ;

ALTER TABLE households
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE households
  ADD CONSTRAINT households_origin_check
  CHECK (origin IN ('unknown', 'landing', 'demo_conversion', 'additif'));

ALTER TABLE recipes
  ADD COLUMN last_moved_at TIMESTAMPTZ;

-- Les fonctions owner-grain de la 033 sondent daily_activity par owner
-- (rétention, activité par carnet via memberships) ; 008 n'avait indexé que
-- (device_id, day) et household_id.
CREATE INDEX idx_daily_activity_owner_day ON daily_activity(owner_id, day);

-- ============================================================
-- 2. Agrégats quotidiens pérennes (démo + funnel de récupération)
-- ============================================================

CREATE TABLE stats_daily (
  day                    DATE PRIMARY KEY,
  -- Funnel démo (les sources vivantes sont purgées par le cron demo-reset)
  demo_trials            INT NOT NULL DEFAULT 0, -- sessions démo créées ce jour
  demo_active_devices    INT NOT NULL DEFAULT 0, -- devices distincts actifs sur la démo
  demo_recipes_added     INT NOT NULL DEFAULT 0, -- recettes ajoutées en démo (purgées à 3 h)
  demo_ai_calls          INT NOT NULL DEFAULT 0, -- appels IA depuis la démo
  demo_frozen_hits       INT NOT NULL DEFAULT 0, -- 403 « monde gelé » (incrément live)
  -- Funnel récupération/fusion (#14) — login_tokens purgés 24 h après expiration
  recovery_tokens_sent   INT NOT NULL DEFAULT 0,
  recovery_tokens_used   INT NOT NULL DEFAULT 0,
  merge_tokens_sent      INT NOT NULL DEFAULT 0,
  merge_tokens_used      INT NOT NULL DEFAULT 0,
  tokens_burned          INT NOT NULL DEFAULT 0, -- brûlés au plafond d'essais
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role only, comme le reste (005) : RLS activée sans policy.
ALTER TABLE stats_daily ENABLE ROW LEVEL SECURITY;

-- Incrément atomique d'un compteur de stats_daily. INSERT … ON CONFLICT en un
-- statement : sûr sous concurrence, contrairement à un read-modify-write
-- (leçon du Lot 2). Générique car plusieurs événements doivent être comptés à
-- l'émission : les login_tokens sont SUPPRIMÉS dès un « Renvoyer »
-- (createLoginToken purge les tokens non utilisés), donc un rollup nocturne
-- seul les sous-compterait. Allow-list stricte des colonnes incrémentables.
CREATE OR REPLACE FUNCTION stats_daily_increment(p_field text)
RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF p_field NOT IN (
    'demo_frozen_hits',
    'recovery_tokens_sent', 'recovery_tokens_used',
    'merge_tokens_sent', 'merge_tokens_used',
    'tokens_burned'
  ) THEN
    RAISE EXCEPTION 'stats_daily_increment: champ non autorisé (%)', p_field;
  END IF;
  EXECUTE format(
    'INSERT INTO stats_daily (day, %I) VALUES (current_date, 1)
     ON CONFLICT (day) DO UPDATE SET %I = stats_daily.%I + 1, updated_at = NOW()',
    p_field, p_field, p_field
  );
END;
$$;

-- Rollup quotidien, appelé par le cron demo-reset AVANT ses purges. Recalcule
-- les p_days derniers jours depuis les tables vivantes et upsert en GREATEST :
-- idempotent, ré-exécutable, et une purge ultérieure ne fait jamais régresser
-- un jour déjà consolidé. Les compteurs live (frozen, tokens sent/used) ne
-- sont jamais écrasés à la baisse grâce au GREATEST. Fenêtre par défaut 30 j :
-- si le cron tombe en panne plusieurs jours, rien ne purge non plus (même
-- cron), donc un rollup tardif à 30 j rattrape l'historique intact.
CREATE OR REPLACE FUNCTION demo_stats_rollup(p_demo_household uuid, p_days int DEFAULT 30)
RETURNS void
LANGUAGE sql VOLATILE AS $$
  INSERT INTO stats_daily AS s (
    day, demo_trials, demo_active_devices, demo_recipes_added, demo_ai_calls,
    recovery_tokens_sent, recovery_tokens_used,
    merge_tokens_sent, merge_tokens_used, tokens_burned
  )
  SELECT
    g.d,
    (SELECT count(*) FROM device_sessions ds
       WHERE ds.household_id = p_demo_household AND ds.created_at::date = g.d),
    (SELECT count(DISTINCT da.device_id) FROM daily_activity da
       WHERE da.household_id = p_demo_household AND da.device_id IS NOT NULL AND da.day = g.d),
    (SELECT count(*) FROM recipes r
       WHERE r.household_id = p_demo_household AND r.is_seed = false AND r.created_at::date = g.d),
    (SELECT count(*) FROM ai_costs c
       WHERE c.household_id = p_demo_household AND c.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'recovery' AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'recovery' AND lt.used_at IS NOT NULL AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'merge' AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.purpose = 'merge' AND lt.used_at IS NOT NULL AND lt.created_at::date = g.d),
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.used_at IS NULL AND lt.attempts >= 5 AND lt.created_at::date = g.d)
  FROM (SELECT (current_date - i)::date AS d FROM generate_series(0, p_days - 1) i) g
  ON CONFLICT (day) DO UPDATE SET
    demo_trials          = GREATEST(s.demo_trials,          EXCLUDED.demo_trials),
    demo_active_devices  = GREATEST(s.demo_active_devices,  EXCLUDED.demo_active_devices),
    demo_recipes_added   = GREATEST(s.demo_recipes_added,   EXCLUDED.demo_recipes_added),
    demo_ai_calls        = GREATEST(s.demo_ai_calls,        EXCLUDED.demo_ai_calls),
    recovery_tokens_sent = GREATEST(s.recovery_tokens_sent, EXCLUDED.recovery_tokens_sent),
    recovery_tokens_used = GREATEST(s.recovery_tokens_used, EXCLUDED.recovery_tokens_used),
    merge_tokens_sent    = GREATEST(s.merge_tokens_sent,    EXCLUDED.merge_tokens_sent),
    merge_tokens_used    = GREATEST(s.merge_tokens_used,    EXCLUDED.merge_tokens_used),
    tokens_burned        = GREATEST(s.tokens_burned,        EXCLUDED.tokens_burned),
    updated_at           = NOW();
$$;
