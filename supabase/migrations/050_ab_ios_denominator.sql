-- 050 — A/B onboarding (#25) : dénominateur limité au shell iOS natif.
--
-- Constat du 2026-09-15 : `ab_onboarding_{a,b}` compte TOUT rendu de la landing
-- par un appareil sans cookie — donc les scanners à UA de navigateur falsifié
-- (le filtre `CRAWLER_UA` ne prend que bot|crawl|spider|…), les visites web qui
-- n'installent jamais, la navigation privée. Sur les 17 affectations du 14-15/09,
-- 2 seulement venaient du shell iOS, alors que la quasi-totalité des carnets
-- créés en vient : le ratio « carnets / affectations » était faux de construction.
--
-- Le shell natif s'identifie par son user-agent `MijoteNative/…` (capacitor.config.ts),
-- qu'aucun scanner n'envoie : compter à part les affectations iOS donne un
-- dénominateur propre sans filtre anti-robot supplémentaire.
-- Les colonnes « toutes surfaces » restent alimentées, en information.

ALTER TABLE stats_daily
  ADD COLUMN IF NOT EXISTS ab_onboarding_a_ios INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_onboarding_b_ios INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION stats_daily_increment(p_field text)
RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF p_field NOT IN (
    'demo_frozen_hits',
    'recovery_tokens_sent', 'recovery_tokens_used',
    'merge_tokens_sent', 'merge_tokens_used',
    'tokens_burned',
    'ab_onboarding_a', 'ab_onboarding_b',
    'ab_onboarding_a_ios', 'ab_onboarding_b_ios',
    'landing_first_open_ios'
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

-- Deux colonnes de plus en retour → DROP + CREATE (046).
DROP FUNCTION IF EXISTS analytics_v3_ab_onboarding(date);

CREATE FUNCTION analytics_v3_ab_onboarding(p_since date)
RETURNS TABLE (
  day date,
  assigned_a int, assigned_b int,
  assigned_a_ios int, assigned_b_ios int,
  first_open_ios int
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT s.day,
         s.ab_onboarding_a, s.ab_onboarding_b,
         s.ab_onboarding_a_ios, s.ab_onboarding_b_ios,
         s.landing_first_open_ios
  FROM stats_daily s
  WHERE s.day >= p_since
  ORDER BY s.day;
$$;

REVOKE ALL ON FUNCTION analytics_v3_ab_onboarding(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_v3_ab_onboarding(date) TO service_role;
