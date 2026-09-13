-- 046 — A/B test onboarding (backlog #25) : « Commencer » en primaire (bras B)
-- contre la landing actuelle (bras A, démo en primaire).
--
-- 1. owners.onboarding_variant : bras vu par la personne à la landing, posé à
--    la création de l'owner (réel ET démo). Null = arrivée hors test (flag
--    éteint, invitation, récupération, owner antérieur au test).
-- 2. stats_daily : dénominateur du test = affectations par jour et par bras,
--    incrémentées à la POSE du cookie uniquement (proxy → landing). Sans elles,
--    on ne compare que des comptes absolus par bras.
--    landing_first_open_ios : premières ouvertures de la landing depuis le shell
--    natif iOS (indépendant du bras) — remplace la tuile « 1ʳᵉ ouverture iOS »
--    qui lisait les essais démo iOS et sous-compterait de moitié avec le bras B.
-- 3. analytics_v3_people expose le bras (nouvelle colonne en fin de liste →
--    DROP + CREATE, un CREATE OR REPLACE ne peut pas changer le type retourné).

-- ============================================================
-- 1. Bras par personne
-- ============================================================

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS onboarding_variant text
  CHECK (onboarding_variant IS NULL OR onboarding_variant IN ('a', 'b'));

-- ============================================================
-- 2. Compteurs quotidiens (incrément live, jamais touchés par le rollup démo)
-- ============================================================

ALTER TABLE stats_daily
  ADD COLUMN IF NOT EXISTS ab_onboarding_a        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_onboarding_b        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_first_open_ios INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION stats_daily_increment(p_field text)
RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF p_field NOT IN (
    'demo_frozen_hits',
    'recovery_tokens_sent', 'recovery_tokens_used',
    'merge_tokens_sent', 'merge_tokens_used',
    'tokens_burned',
    'ab_onboarding_a', 'ab_onboarding_b', 'landing_first_open_ios'
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

-- Lecture des affectations par jour (dashboard v3, section Activer).
CREATE OR REPLACE FUNCTION analytics_v3_ab_onboarding(p_since date)
RETURNS TABLE (day date, assigned_a int, assigned_b int, first_open_ios int)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT s.day, s.ab_onboarding_a, s.ab_onboarding_b, s.landing_first_open_ios
  FROM stats_daily s
  WHERE s.day >= p_since
  ORDER BY s.day;
$$;

-- ============================================================
-- 3. analytics_v3_people + onboarding_variant (corps identique à la 043)
-- ============================================================

DROP FUNCTION IF EXISTS analytics_v3_people();

CREATE FUNCTION analytics_v3_people()
RETURNS TABLE (
  id uuid, created_at timestamptz, display_name text,
  has_email boolean, named boolean, via_demo boolean,
  first_platform text, channel text,
  carnets int, guest_of int,
  first_method text, first_recipe_at timestamptz,
  recipes_7d int, recipes_28d int, recipes_total int,
  views_28d int, views_total int,
  returned_7d boolean,
  active_m1 boolean, active_m2 boolean, active_m3 boolean,
  active_28d boolean, active_prev28 boolean,
  active_days_28d int, last_active_day date,
  onboarding_variant text
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH o AS (
    SELECT o.id, o.created_at, o.created_at::date AS d0,
           COALESCE(o.name, o.alias) AS display_name,
           o.recovery_email IS NOT NULL AS has_email,
           o.name IS NOT NULL AS named,
           o.demo_trial_started_at IS NOT NULL AS via_demo,
           o.onboarding_variant
    FROM owners o WHERE owner_is_real(o.id)
  ),
  fs AS (
    SELECT o.id, (SELECT ds.platform FROM device_sessions ds WHERE ds.owner_id = o.id ORDER BY ds.created_at LIMIT 1) AS first_platform
    FROM o
  ),
  mem AS (
    SELECT o.id,
      (SELECT count(*) FROM memberships m WHERE m.owner_id = o.id AND m.role = 'member')::int AS carnets,
      (SELECT count(*) FROM memberships m WHERE m.owner_id = o.id AND m.role = 'guest')::int AS guest_of,
      -- A rejoint un carnet qui existait déjà avant lui → arrivée par invitation.
      EXISTS (SELECT 1 FROM memberships m JOIN households h ON h.id = m.household_id
              WHERE m.owner_id = o.id AND h.created_at < o.created_at - interval '2 minutes') AS joined_existing
    FROM o
  ),
  fr AS (
    SELECT o.id, rp.source AS first_method, rp.created_at AS first_recipe_at
    FROM o
    LEFT JOIN LATERAL (
      SELECT rp.source, rp.created_at FROM v3_recipe_people rp
      WHERE rp.owner_id = o.id AND rp.created_at >= o.created_at
      ORDER BY rp.created_at LIMIT 1
    ) rp ON true
  ),
  rc AS (
    SELECT o.id,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id AND rp.created_at >= o.created_at AND rp.created_at < o.created_at + interval '7 days')::int AS recipes_7d,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id AND rp.created_at::date >= current_date - 27)::int AS recipes_28d,
      (SELECT count(*) FROM v3_recipe_people rp WHERE rp.owner_id = o.id)::int AS recipes_total
    FROM o
  ),
  vw AS (
    SELECT o.id,
      COALESCE((SELECT sum(v.views) FROM recipe_views_daily v WHERE v.owner_id = o.id AND v.day >= current_date - 27), 0)::int AS views_28d,
      COALESCE((SELECT sum(v.views) FROM recipe_views_daily v WHERE v.owner_id = o.id), 0)::int AS views_total
    FROM o
  ),
  act AS (
    SELECT o.id,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 1  AND o.d0 + 7)   AS returned_7d,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 28 AND o.d0 + 55)  AS active_m1,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 56 AND o.d0 + 83)  AS active_m2,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN o.d0 + 84 AND o.d0 + 111) AS active_m3,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day >= current_date - 27) AS active_28d,
      EXISTS (SELECT 1 FROM daily_activity a WHERE a.owner_id = o.id AND a.day BETWEEN current_date - 55 AND current_date - 28) AS active_prev28,
      (SELECT count(DISTINCT a.day) FROM daily_activity a WHERE a.owner_id = o.id AND a.day >= current_date - 27)::int AS active_days_28d,
      (SELECT max(a.day) FROM daily_activity a WHERE a.owner_id = o.id) AS last_active_day
    FROM o
  )
  SELECT o.id, o.created_at, o.display_name, o.has_email, o.named, o.via_demo,
         fs.first_platform,
         CASE WHEN mem.joined_existing THEN 'invite'
              WHEN fs.first_platform = 'ios' THEN 'ios'
              WHEN fs.first_platform = 'android' THEN 'android'
              ELSE 'web' END AS channel,
         mem.carnets, mem.guest_of,
         fr.first_method, fr.first_recipe_at,
         rc.recipes_7d, rc.recipes_28d, rc.recipes_total,
         vw.views_28d, vw.views_total,
         act.returned_7d, act.active_m1, act.active_m2, act.active_m3,
         act.active_28d, act.active_prev28, act.active_days_28d, act.last_active_day,
         o.onboarding_variant
  FROM o
  JOIN fs  ON fs.id = o.id
  JOIN mem ON mem.id = o.id
  JOIN fr  ON fr.id = o.id
  JOIN rc  ON rc.id = o.id
  JOIN vw  ON vw.id = o.id
  JOIN act ON act.id = o.id
  ORDER BY o.created_at;
$$;

-- Privilèges : réservés à service_role (règle 039). Le DROP a effacé ceux de
-- analytics_v3_people ; stats_daily_increment garde les siens (CREATE OR REPLACE).
REVOKE ALL ON FUNCTION analytics_v3_people() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_v3_ab_onboarding(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_v3_people() TO service_role;
GRANT EXECUTE ON FUNCTION analytics_v3_ab_onboarding(date) TO service_role;
