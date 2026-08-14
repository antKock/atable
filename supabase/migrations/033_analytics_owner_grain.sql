-- Migration 033: analytics v2 — le grain de référence devient la PERSONNE (owner).
--
-- Depuis la 027, appareil ≠ personne (plusieurs cookie jars par humain) et
-- foyer ≠ utilisateur (multi-carnet, rôles member/guest). Toutes les fonctions
-- d'activité comptaient encore des device_id et joignaient la colonne vestigiale
-- device_sessions.household_id. Cette migration :
--
--   - redéfinit l'activité/rétention/activation/fréquence/profondeur au grain
--     owner (daily_activity.owner_id, rempli et backfillé depuis la 027) ;
--   - conserve la série appareils (mau_devices) en parallèle : l'écart mesure
--     directement le bruit des identités fantômes ;
--   - scope l'activité d'un carnet via memberships (plus le household_id
--     arbitraire du ping — un owner multi-carnet rend actifs TOUS ses carnets) ;
--   - ajoute les fonctions du funnel démo → carnet (sur owners.demo_trial_started_at
--     + stats_daily de la 032), des carnets (rôles, multi-carnet), du compte
--     (#14) et du partage ;
--   - supprime les fonctions devenues sans consommateur.
--
-- Limites assumées (affichées sur le dashboard) : avant la 027, un owner
-- backfillé ≡ une session, donc les séries « personnes » pré-juillet 2026 sont
-- un MAJORANT ; le funnel démo ne démarre qu'à la pose du marqueur (032).
--
-- Exclusions : une « personne » réelle = un owner avec AU MOINS un membership
-- vers un carnet réel, et AUCUN vers le carnet démo ou un carnet « Test% »
-- (un owner réel n'a jamais de membership démo : la conversion crée un owner
-- neuf, et rejoindre la démo par code est bloqué). Exiger un membership réel
-- écarte les owners orphelins : le backfill 027 a créé un owner par session,
-- révoquées comprises, mais des memberships seulement pour les sessions non
-- révoquées — sans ce garde, ces coquilles vides compteraient comme des
-- personnes (et la purge démo, elle aussi membership-based, ne les voit pas).

-- ============================================================
-- 0. Prédicats partagés
-- ============================================================

CREATE OR REPLACE FUNCTION owner_is_real(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    JOIN households h ON h.id = m.household_id
    WHERE m.owner_id = p_owner AND h.is_demo = false AND h.name NOT ILIKE 'test%')
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    JOIN households h ON h.id = m.household_id
    WHERE m.owner_id = p_owner AND (h.is_demo OR h.name ILIKE 'test%'));
$$;

CREATE OR REPLACE FUNCTION owner_in_carnets(p_owner uuid, p_household_ids uuid[])
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_household_ids IS NULL OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.owner_id = p_owner AND m.household_id = ANY(p_household_ids));
$$;

-- Dernière activité par carnet = activité de ses membres ACTUELS (via
-- memberships), unionnée au household_id historique des lignes (lignes pré-027
-- ou membres partis). Un owner multi-carnet rend actifs tous ses carnets —
-- assumé, et plus juste que l'attribution memberships[0] du ping. Fonction
-- ensembliste (une passe groupée) plutôt que scalaire par carnet : la variante
-- par carnet forçait un scan de daily_activity par household à chaque rendu.
CREATE OR REPLACE FUNCTION carnet_activity()
RETURNS TABLE (household_id uuid, last_active date)
LANGUAGE sql STABLE AS $$
  SELECT x.hid, max(x.day)
  FROM (
    SELECT d.household_id AS hid, d.day FROM daily_activity d
    UNION ALL
    SELECT m.household_id, d.day
    FROM daily_activity d
    JOIN memberships m ON m.owner_id = d.owner_id
  ) x
  WHERE x.hid IS NOT NULL
  GROUP BY x.hid;
$$;

-- ============================================================
-- 1. KPIs
-- ============================================================

-- Seuls les champs réellement affichés : le MAU « personnes actives 30 j » est
-- déjà le dernier point d'analytics_active_daily, et le total carnets le
-- dernier point du parc cumulé — pas de double calcul ici.
DROP FUNCTION IF EXISTS analytics_kpis(uuid[]);
CREATE FUNCTION analytics_kpis(p_household_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  owners_total    bigint,
  recipes_total   bigint,
  dormant_carnets bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM owners o
       WHERE owner_is_real(o.id) AND owner_in_carnets(o.id, p_household_ids)),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND r.is_seed = false
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))),
    -- Dormant = a déjà eu de l'activité, puis plus rien depuis 30 j. Un carnet
    -- sans AUCUNE activité enregistrée n'est ni actif ni dormant (même
    -- convention que la v1) — il reste visible via le parc et le top carnets.
    (SELECT count(*) FROM households h
       JOIN carnet_activity() ca ON ca.household_id = h.id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids))
         AND ca.last_active < current_date - 30);
$$;

-- ============================================================
-- 2. Activité (grain owner + série appareils héritée)
-- ============================================================

-- Les paires (owner, day) éligibles sont matérialisées UNE fois (prédicats
-- d'exclusion évalués une fois par paire, pas à chaque fenêtre) ; les fenêtres
-- glissantes 7 j / 30 j balaient ensuite ces petits ensembles en mémoire.
DROP FUNCTION IF EXISTS analytics_active_daily(int, text, uuid[]);
CREATE FUNCTION analytics_active_daily(
  p_days          int    DEFAULT 90,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (day date, wau bigint, mau bigint, mau_devices bigint, stickiness numeric)
LANGUAGE sql STABLE AS $$
  WITH owner_days AS (
    SELECT DISTINCT d.owner_id, d.day
    FROM daily_activity d
    WHERE d.owner_id IS NOT NULL
      AND d.day >= current_date - (p_days + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND owner_is_real(d.owner_id)
      AND owner_in_carnets(d.owner_id, p_household_ids)
  ),
  -- Ancienne métrique (appareils, périmètre v1) : l'écart avec mau mesure le
  -- bruit des identités fantômes. Affichée en filigrane sur le chart.
  device_days AS (
    SELECT DISTINCT d.device_id, d.day
    FROM daily_activity d
    JOIN households h ON h.id = d.household_id
    WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND d.device_id IS NOT NULL
      AND d.day >= current_date - (p_days + 29)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND (p_household_ids IS NULL OR d.household_id = ANY(p_household_ids))
  )
  SELECT t.day, t.wau, t.mau, t.mau_devices,
         round(100.0 * t.wau / nullif(t.mau, 0), 1) AS stickiness
  FROM (
    SELECT g.d AS day,
      (SELECT count(DISTINCT o.owner_id) FROM owner_days o
         WHERE o.day BETWEEN g.d - 6 AND g.d) AS wau,
      (SELECT count(DISTINCT o.owner_id) FROM owner_days o
         WHERE o.day BETWEEN g.d - 29 AND g.d) AS mau,
      (SELECT count(DISTINCT dd.device_id) FROM device_days dd
         WHERE dd.day BETWEEN g.d - 29 AND g.d) AS mau_devices
    FROM (
      SELECT (current_date - g)::date AS d
      FROM generate_series(0, p_days - 1) g
    ) g
  ) t
  ORDER BY t.day;
$$;

-- Fréquence d'usage : jours actifs distincts par PERSONNE sur p_days.
DROP FUNCTION IF EXISTS analytics_login_frequency(int, text, uuid[]);
CREATE FUNCTION analytics_login_frequency(
  p_days          int    DEFAULT 30,
  p_platform      text   DEFAULT NULL,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (bin text, owners bigint)
LANGUAGE sql STABLE AS $$
  WITH per_owner AS (
    SELECT d.owner_id, count(DISTINCT d.day) AS active_days
    FROM daily_activity d
    WHERE d.owner_id IS NOT NULL
      AND d.day >= current_date - p_days
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND owner_is_real(d.owner_id)
      AND owner_in_carnets(d.owner_id, p_household_ids)
    GROUP BY d.owner_id
  ),
  binned AS (
    SELECT
      CASE
        WHEN active_days = 1               THEN '1 j'
        WHEN active_days BETWEEN 2 AND 3   THEN '2–3 j'
        WHEN active_days BETWEEN 4 AND 7   THEN '4–7 j'
        WHEN active_days BETWEEN 8 AND 15  THEN '8–15 j'
        ELSE '16+ j'
      END AS bin,
      CASE
        WHEN active_days = 1               THEN 0
        WHEN active_days BETWEEN 2 AND 3   THEN 1
        WHEN active_days BETWEEN 4 AND 7   THEN 2
        WHEN active_days BETWEEN 8 AND 15  THEN 3
        ELSE 4
      END AS ord
    FROM per_owner
  )
  SELECT bin, count(*) AS owners
  FROM binned
  GROUP BY bin, ord
  ORDER BY ord;
$$;

-- Profondeur : recettes créées par jour-personne actif (scalaire).
CREATE OR REPLACE FUNCTION analytics_depth(
  p_days          int    DEFAULT 30,
  p_household_ids uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT round(
    (SELECT count(*)::numeric FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND r.is_seed = false
         AND r.created_at >= current_date - p_days
         AND (p_household_ids IS NULL OR h.id = ANY(p_household_ids)))
    / nullif((
      SELECT count(*) FROM (
        SELECT d.owner_id, d.day
        FROM daily_activity d
        WHERE d.owner_id IS NOT NULL
          AND d.day >= current_date - p_days
          AND owner_is_real(d.owner_id)
          AND owner_in_carnets(d.owner_id, p_household_ids)
        GROUP BY d.owner_id, d.day
      ) active_owner_days
    ), 0)
  , 1);
$$;

-- ============================================================
-- 3. Cohortes (activation + rétention) au grain owner
-- ============================================================
-- Recette → personne via recipes.created_by_device_id → device_sessions.owner_id.

DROP FUNCTION IF EXISTS analytics_activation(date, date);
CREATE FUNCTION analytics_activation(
  p_from date DEFAULT '2000-01-01',
  p_to   date DEFAULT '2999-12-31'
)
RETURNS TABLE (cohort_week date, owners bigint, activated bigint, rate numeric)
LANGUAGE sql STABLE AS $$
  WITH coh AS (
    -- Cohortes limitées aux owners MEMBRES d'au moins un carnet réel : un
    -- invité (lecture seule) ne peut structurellement pas créer de recette et
    -- diluerait le taux sans rien signifier.
    SELECT o.id, date_trunc('week', o.created_at)::date AS cohort_week, o.created_at
    FROM owners o
    WHERE owner_is_real(o.id)
      AND EXISTS (
        SELECT 1 FROM memberships m
        JOIN households h ON h.id = m.household_id
        WHERE m.owner_id = o.id AND m.role = 'member'
          AND h.is_demo = false AND h.name NOT ILIKE 'test%')
      AND o.created_at::date BETWEEN p_from AND p_to
  ),
  act AS (
    SELECT c.cohort_week,
           EXISTS (
             SELECT 1 FROM recipes r
             JOIN device_sessions ds ON ds.id = r.created_by_device_id
             WHERE ds.owner_id = c.id AND r.is_seed = false
               AND r.created_at <= c.created_at + interval '7 days'
           ) AS activated
    FROM coh c
  )
  SELECT cohort_week,
         count(*)                          AS owners,
         count(*) FILTER (WHERE activated) AS activated,
         round(100.0 * count(*) FILTER (WHERE activated) / nullif(count(*), 0), 1) AS rate
  FROM act
  GROUP BY cohort_week
  ORDER BY cohort_week;
$$;

DROP FUNCTION IF EXISTS analytics_retention_cohorts(int, int);
CREATE FUNCTION analytics_retention_cohorts(
  p_cohorts  int DEFAULT 3,
  p_max_week int DEFAULT 8
)
RETURNS TABLE (cohort date, week_offset int, owners bigint, active bigint, pct numeric)
LANGUAGE sql STABLE AS $$
  WITH coh AS (
    SELECT o.id, date_trunc('month', o.created_at)::date AS cohort, o.created_at
    FROM owners o
    WHERE owner_is_real(o.id)
      AND o.created_at >= date_trunc('month', current_date) - make_interval(months => p_cohorts - 1)
  ),
  grid AS (
    SELECT c.id, c.cohort, c.created_at, w.w
    FROM coh c
    CROSS JOIN generate_series(0, p_max_week) w(w)
  )
  SELECT g.cohort, g.w AS week_offset,
    count(*) AS owners,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity d
      WHERE d.owner_id = g.id
        AND d.day >= (g.created_at::date + g.w * 7)
        AND d.day <  (g.created_at::date + (g.w + 1) * 7)
    )) AS active,
    round(100.0 * count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM daily_activity d
      WHERE d.owner_id = g.id
        AND d.day >= (g.created_at::date + g.w * 7)
        AND d.day <  (g.created_at::date + (g.w + 1) * 7)
    )) / nullif(count(*), 0), 0) AS pct
  FROM grid g
  GROUP BY g.cohort, g.w
  ORDER BY g.cohort, g.w;
$$;

-- ============================================================
-- 4. Croissance (parc cumulé + acquisition) au grain owner/carnet
-- ============================================================

-- Personnes + carnets uniquement : le cumul de recettes n'est plus affiché
-- (échelle incomparable sur un même axe — décision maquette v2), inutile de le
-- recalculer par jour.
DROP FUNCTION IF EXISTS analytics_cumulative_parc_daily(int);
CREATE FUNCTION analytics_cumulative_parc_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, owners bigint, carnets bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM owners o
       WHERE owner_is_real(o.id) AND o.created_at::date <= g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date <= g.d)
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;

-- Acquisition : nouvelles personnes + nouveaux carnets par jour. first_carnets =
-- carnets nés d'une arrivée (landing ou conversion démo), par opposition aux
-- carnets additionnels d'un owner existant. 'unknown' (pré-032) n'y compte pas.
DROP FUNCTION IF EXISTS analytics_acquisition_daily(int);
CREATE FUNCTION analytics_acquisition_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, new_owners bigint, new_carnets bigint, first_carnets bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    (SELECT count(*) FROM owners o
       WHERE owner_is_real(o.id) AND o.created_at::date = g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date = g.d),
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%' AND h.created_at::date = g.d
         AND h.origin IN ('landing', 'demo_conversion'))
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;

-- Top carnets : volume de recettes + dernière activité fiabilisée (memberships).
CREATE OR REPLACE FUNCTION analytics_top_households(p_limit int DEFAULT 10)
RETURNS TABLE (household_id uuid, name text, recipes bigint, last_active date)
LANGUAGE sql STABLE AS $$
  SELECT h.id, h.name,
         count(r.id) FILTER (WHERE r.is_seed = false) AS recipes,
         max(ca.last_active) AS last_active
  FROM households h
  LEFT JOIN recipes r ON r.household_id = h.id
  LEFT JOIN carnet_activity() ca ON ca.household_id = h.id
  WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
  GROUP BY h.id, h.name
  ORDER BY recipes DESC, last_active DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ============================================================
-- 5. Carnets & cercles (multi-carnet, rôles) — nouveaux
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_carnets_per_owner()
RETURNS TABLE (bucket text, owners bigint)
LANGUAGE sql STABLE AS $$
  WITH per_owner AS (
    SELECT o.id, count(m.id) AS n
    FROM owners o
    JOIN memberships m ON m.owner_id = o.id
    JOIN households h ON h.id = m.household_id
    WHERE owner_is_real(o.id)
      AND h.is_demo = false AND h.name NOT ILIKE 'test%'
    GROUP BY o.id
  )
  SELECT CASE WHEN n = 1 THEN '1' WHEN n = 2 THEN '2' ELSE '3+' END AS bucket,
         count(*) AS owners
  FROM per_owner
  GROUP BY 1, (CASE WHEN n = 1 THEN 1 WHEN n = 2 THEN 2 ELSE 3 END)
  ORDER BY (CASE WHEN n = 1 THEN 1 WHEN n = 2 THEN 2 ELSE 3 END);
$$;

-- Personnes par carnet, ventilées membre/invité (remplace la « taille des
-- foyers » qui comptait des cookie jars via device_sessions.household_id).
CREATE OR REPLACE FUNCTION analytics_carnet_people_dist()
RETURNS TABLE (bucket text, carnets bigint, members bigint, guests bigint)
LANGUAGE sql STABLE AS $$
  WITH per_carnet AS (
    SELECT h.id,
           count(*) FILTER (WHERE m.role = 'member') AS n_members,
           count(*) FILTER (WHERE m.role = 'guest')  AS n_guests
    FROM households h
    JOIN memberships m ON m.household_id = h.id
    WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
    GROUP BY h.id
  )
  SELECT
    CASE WHEN n_members + n_guests = 1 THEN '1'
         WHEN n_members + n_guests = 2 THEN '2'
         WHEN n_members + n_guests = 3 THEN '3'
         ELSE '4+' END AS bucket,
    count(*)       AS carnets,
    sum(n_members) AS members,
    sum(n_guests)  AS guests
  FROM per_carnet
  GROUP BY 1, (CASE WHEN n_members + n_guests >= 4 THEN 4 ELSE n_members + n_guests END)
  ORDER BY (CASE WHEN n_members + n_guests >= 4 THEN 4 ELSE n_members + n_guests END);
$$;

CREATE OR REPLACE FUNCTION analytics_guest_adoption()
RETURNS TABLE (carnets_total bigint, carnets_with_guest bigint, guests_total bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM households h
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'),
    (SELECT count(DISTINCT m.household_id) FROM memberships m
       JOIN households h ON h.id = m.household_id
       WHERE m.role = 'guest' AND h.is_demo = false AND h.name NOT ILIKE 'test%'),
    (SELECT count(*) FROM memberships m
       JOIN households h ON h.id = m.household_id
       WHERE m.role = 'guest' AND h.is_demo = false AND h.name NOT ILIKE 'test%');
$$;

-- Appareils (sessions non révoquées) par personne : proxy direct du bruit
-- fantôme et du multi-appareil réel.
CREATE OR REPLACE FUNCTION analytics_devices_per_owner()
RETURNS TABLE (bucket text, owners bigint)
LANGUAGE sql STABLE AS $$
  WITH per_owner AS (
    SELECT o.id, count(ds.id) AS n
    FROM owners o
    LEFT JOIN device_sessions ds ON ds.owner_id = o.id AND ds.is_revoked = false
    WHERE owner_is_real(o.id)
    GROUP BY o.id
  )
  SELECT CASE WHEN n = 0 THEN '0' WHEN n = 1 THEN '1' WHEN n = 2 THEN '2'
              WHEN n = 3 THEN '3' ELSE '4+' END AS bucket,
         count(*) AS owners
  FROM per_owner
  GROUP BY 1, (CASE WHEN n >= 4 THEN 4 ELSE n END)
  ORDER BY (CASE WHEN n >= 4 THEN 4 ELSE n END);
$$;

-- ============================================================
-- 6. Compte & sécurité (#14) — nouveaux
-- ============================================================
-- Le funnel de tokens vit dans stats_daily (032) car login_tokens est purgé
-- 24 h après expiration ; les jours récents encore présents dans la table
-- vivante sont fusionnés en GREATEST (mêmes règles que le rollup).

CREATE OR REPLACE FUNCTION analytics_recovery(p_days int DEFAULT 90)
RETURNS TABLE (
  owners_total         bigint,
  owners_with_email    bigint,
  owners_named         bigint,
  recovery_tokens_sent bigint,
  recovery_tokens_used bigint,
  merge_tokens_sent    bigint,
  merge_tokens_used    bigint,
  tokens_burned        bigint,
  tokens_pending       bigint
)
LANGUAGE sql STABLE AS $$
  WITH live AS (
    SELECT lt.created_at::date AS day,
      count(*) FILTER (WHERE lt.purpose = 'recovery')                          AS r_sent,
      count(*) FILTER (WHERE lt.purpose = 'recovery' AND lt.used_at IS NOT NULL) AS r_used,
      count(*) FILTER (WHERE lt.purpose = 'merge')                             AS m_sent,
      count(*) FILTER (WHERE lt.purpose = 'merge' AND lt.used_at IS NOT NULL)  AS m_used,
      count(*) FILTER (WHERE lt.used_at IS NULL AND lt.attempts >= 5)          AS burned
    FROM login_tokens lt
    GROUP BY 1
  ),
  merged AS (
    SELECT COALESCE(s.day, l.day) AS day,
      GREATEST(COALESCE(s.recovery_tokens_sent, 0), COALESCE(l.r_sent, 0)) AS r_sent,
      GREATEST(COALESCE(s.recovery_tokens_used, 0), COALESCE(l.r_used, 0)) AS r_used,
      GREATEST(COALESCE(s.merge_tokens_sent, 0),    COALESCE(l.m_sent, 0)) AS m_sent,
      GREATEST(COALESCE(s.merge_tokens_used, 0),    COALESCE(l.m_used, 0)) AS m_used,
      GREATEST(COALESCE(s.tokens_burned, 0),        COALESCE(l.burned, 0)) AS burned
    FROM stats_daily s
    FULL JOIN live l ON l.day = s.day
  )
  SELECT
    (SELECT count(*) FROM owners o WHERE owner_is_real(o.id)),
    (SELECT count(*) FROM owners o WHERE owner_is_real(o.id) AND o.recovery_email IS NOT NULL),
    (SELECT count(*) FROM owners o WHERE owner_is_real(o.id) AND o.name IS NOT NULL),
    COALESCE(sum(r_sent), 0), COALESCE(sum(r_used), 0),
    COALESCE(sum(m_sent), 0), COALESCE(sum(m_used), 0),
    COALESCE(sum(burned), 0),
    -- Tokens encore dans leur fenêtre de validité (15 min) : à soustraire des
    -- « expirés sans usage » côté client, sinon toute demande en cours s'y
    -- affiche pendant sa durée de vie.
    (SELECT count(*) FROM login_tokens lt
       WHERE lt.used_at IS NULL AND lt.expires_at > now() AND lt.attempts < 5)
  FROM merged
  WHERE day >= current_date - (p_days - 1);
$$;

-- ============================================================
-- 7. Funnel démo → carnet — nouveaux (remplacent les analytics_demo_* de la 010)
-- ============================================================

DROP FUNCTION IF EXISTS analytics_demo_new_devices(date, date);
DROP FUNCTION IF EXISTS analytics_demo_dau(date, date);

-- Essais & conversions par jour. Essais : GREATEST(agrégat 032, comptage live —
-- les sessions démo vivent 30 j avant purge) ; conversions : owners réels
-- porteurs du marqueur demo_trial_started_at, par jour de création.
CREATE OR REPLACE FUNCTION analytics_demo_funnel(p_days int DEFAULT 90)
RETURNS TABLE (day date, trials bigint, conversions bigint)
LANGUAGE sql STABLE AS $$
  SELECT g.d AS day,
    GREATEST(
      COALESCE((SELECT s.demo_trials FROM stats_daily s WHERE s.day = g.d), 0),
      (SELECT count(*) FROM device_sessions ds
         JOIN households h ON h.id = ds.household_id
         WHERE h.is_demo AND ds.created_at::date = g.d)
    )::bigint AS trials,
    (SELECT count(*) FROM owners o
       WHERE o.demo_trial_started_at IS NOT NULL AND o.created_at::date = g.d
         AND owner_is_real(o.id)) AS conversions
  FROM (
    SELECT (current_date - g)::date AS d
    FROM generate_series(0, p_days - 1) g
  ) g
  ORDER BY g.d;
$$;

-- Synthèse du funnel sur une fenêtre : essais, conversions, taux, activés ≤7 j,
-- délai médian (heures), activité en démo (recettes/appels IA/403 gelés).
CREATE OR REPLACE FUNCTION analytics_demo_summary(p_days int DEFAULT 30)
RETURNS TABLE (
  trials                  bigint,
  conversions             bigint,
  conversion_pct          numeric,
  activated_7d            bigint,
  median_hours_to_convert numeric,
  demo_recipes            bigint,
  demo_ai_calls           bigint,
  frozen_hits             bigint
)
LANGUAGE sql STABLE AS $$
  WITH f AS (
    SELECT * FROM analytics_demo_funnel(p_days)
  ),
  converted AS (
    -- Même fenêtre que la grille du funnel : p_days jours, aujourd'hui inclus
    -- (sinon « activés » pourrait dépasser « conversions » d'un jour de bord).
    SELECT o.id, o.created_at, o.demo_trial_started_at
    FROM owners o
    WHERE o.demo_trial_started_at IS NOT NULL
      AND o.created_at::date >= current_date - (p_days - 1)
      AND owner_is_real(o.id)
  ),
  demo_activity AS (
    SELECT g.d,
      GREATEST(
        COALESCE((SELECT s.demo_recipes_added FROM stats_daily s WHERE s.day = g.d), 0),
        (SELECT count(*) FROM recipes r JOIN households h ON h.id = r.household_id
           WHERE h.is_demo AND r.is_seed = false AND r.created_at::date = g.d)
      ) AS recipes_added,
      GREATEST(
        COALESCE((SELECT s.demo_ai_calls FROM stats_daily s WHERE s.day = g.d), 0),
        (SELECT count(*) FROM ai_costs c JOIN households h ON h.id = c.household_id
           WHERE h.is_demo AND c.created_at::date = g.d)
      ) AS ai_calls,
      COALESCE((SELECT s.demo_frozen_hits FROM stats_daily s WHERE s.day = g.d), 0) AS frozen
    FROM (SELECT (current_date - i)::date AS d FROM generate_series(0, p_days - 1) i) g
  )
  SELECT
    (SELECT COALESCE(sum(trials), 0) FROM f),
    (SELECT COALESCE(sum(conversions), 0) FROM f),
    round(100.0 * (SELECT COALESCE(sum(conversions), 0) FROM f)
          / nullif((SELECT sum(trials) FROM f), 0), 1),
    (SELECT count(*) FROM converted c
       WHERE EXISTS (
         SELECT 1 FROM recipes r
         JOIN device_sessions ds ON ds.id = r.created_by_device_id
         WHERE ds.owner_id = c.id AND r.is_seed = false
           AND r.created_at <= c.created_at + interval '7 days')),
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c.created_at - c.demo_trial_started_at)) / 3600.0
      ))::numeric, 1) FROM converted c),
    (SELECT COALESCE(sum(recipes_added), 0) FROM demo_activity),
    (SELECT COALESCE(sum(ai_calls), 0) FROM demo_activity),
    (SELECT COALESCE(sum(frozen), 0) FROM demo_activity);
$$;

-- Distribution du délai démo → carnet (toutes conversions marquées).
CREATE OR REPLACE FUNCTION analytics_demo_time_to_convert()
RETURNS TABLE (bin text, owners bigint)
LANGUAGE sql STABLE AS $$
  WITH delays AS (
    SELECT EXTRACT(EPOCH FROM (o.created_at - o.demo_trial_started_at)) / 3600.0 AS hours
    FROM owners o
    WHERE o.demo_trial_started_at IS NOT NULL AND owner_is_real(o.id)
  ),
  binned AS (
    SELECT
      CASE
        WHEN hours < 1   THEN '< 1 h'
        WHEN hours < 24  THEN '< 24 h'
        WHEN hours < 72  THEN '1–3 j'
        WHEN hours < 168 THEN '3–7 j'
        ELSE '> 7 j'
      END AS bin,
      CASE
        WHEN hours < 1   THEN 0
        WHEN hours < 24  THEN 1
        WHEN hours < 72  THEN 2
        WHEN hours < 168 THEN 3
        ELSE 4
      END AS ord
    FROM delays
  )
  SELECT bin, count(*) AS owners
  FROM binned
  GROUP BY bin, ord
  ORDER BY ord;
$$;

-- Coût IA consommé par la démo (exclu des analytics_ai_cost_* réels).
CREATE OR REPLACE FUNCTION analytics_ai_cost_demo_daily(p_days int DEFAULT 90)
RETURNS TABLE (day date, cost_usd numeric, calls bigint)
LANGUAGE sql STABLE AS $$
  SELECT c.created_at::date AS day, sum(c.cost_usd), count(*)
  FROM ai_costs c
  JOIN households h ON h.id = c.household_id
  WHERE h.is_demo AND c.created_at::date >= current_date - p_days
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- 8. Partage & circulation des recettes — nouveau
-- ============================================================

CREATE OR REPLACE FUNCTION analytics_sharing(p_days int DEFAULT 30)
RETURNS TABLE (links_total bigint, copies bigint, moves bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    -- Liens émis : durables, comptés en cumul (pas de fenêtre).
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
         AND r.share_token IS NOT NULL),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
         AND r.source = 'shared' AND r.created_at >= current_date - p_days),
    (SELECT count(*) FROM recipes r
       JOIN households h ON h.id = r.household_id
       WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
         AND r.last_moved_at >= current_date - p_days);
$$;

-- ============================================================
-- 9. Nettoyage : fonctions sans consommateur depuis la v2
-- ============================================================

DROP FUNCTION IF EXISTS analytics_dau(date, date, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_mau(date, date, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_active_weekly(int, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_cumulative_parc(int);
DROP FUNCTION IF EXISTS analytics_acquisition_weekly(int);
DROP FUNCTION IF EXISTS analytics_new_households_weekly(date, date);
DROP FUNCTION IF EXISTS analytics_household_size_dist();
