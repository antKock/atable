-- 045 — Ménage : suppression des fonctions analytics v2 (dashboard remplacé par
-- la v3 le 2026-09-12, migrations 043/044). Revue d'architecture du
-- 2026-09-12, lot 4 : 30 fonctions `analytics_*` orphelines (vérifié en base
-- staging et prod, signatures identiques), la surcharge mono-foyer de
-- `demo_stats_rollup(uuid, int)` (038, remplacée par la variante uuid[]) et
-- les deux helpers que seules ces fonctions appelaient (`owner_in_carnets`,
-- `carnet_activity`, 033). `owner_is_real` reste : utilisé par la v3.
--
-- Migration APRÈS le code (règle : suppression = après) : plus aucun appel
-- côté app (src/lib/admin/v3/data.ts n'appelle que analytics_v3_*), ni dans
-- scripts/. Signatures explicites : DROP FUNCTION sans arguments échoue sur
-- une surcharge, et la révision 039 avait redéfini certaines avec des
-- paramètres supplémentaires.

DROP FUNCTION IF EXISTS analytics_acquisition_daily(integer);
DROP FUNCTION IF EXISTS analytics_activation(date, date);
DROP FUNCTION IF EXISTS analytics_active_daily(integer, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_active_daily_cohorts(integer, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_adoption_since(date, date);
DROP FUNCTION IF EXISTS analytics_ai_cost_daily(integer);
DROP FUNCTION IF EXISTS analytics_ai_cost_demo_daily(integer);
DROP FUNCTION IF EXISTS analytics_ai_cost_summary(integer);
DROP FUNCTION IF EXISTS analytics_carnet_people_dist();
DROP FUNCTION IF EXISTS analytics_carnets_per_owner();
DROP FUNCTION IF EXISTS analytics_cumulative_parc_daily(integer);
DROP FUNCTION IF EXISTS analytics_demo_funnel(integer);
DROP FUNCTION IF EXISTS analytics_demo_summary(integer);
DROP FUNCTION IF EXISTS analytics_demo_time_to_convert();
DROP FUNCTION IF EXISTS analytics_depth(integer, uuid[]);
DROP FUNCTION IF EXISTS analytics_devices_per_owner();
DROP FUNCTION IF EXISTS analytics_enrichment(uuid[]);
DROP FUNCTION IF EXISTS analytics_guest_adoption();
DROP FUNCTION IF EXISTS analytics_kpis(uuid[]);
DROP FUNCTION IF EXISTS analytics_login_frequency(integer, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_owner_days(integer, text, uuid[]);
DROP FUNCTION IF EXISTS analytics_recipes_by_platform(date, date, uuid[]);
DROP FUNCTION IF EXISTS analytics_recipes_created_daily(date, date, uuid[], text, text);
DROP FUNCTION IF EXISTS analytics_recipes_per_household_dist(uuid[]);
DROP FUNCTION IF EXISTS analytics_recovery(integer);
DROP FUNCTION IF EXISTS analytics_retention_cohorts(integer, integer);
DROP FUNCTION IF EXISTS analytics_sharing(integer);
DROP FUNCTION IF EXISTS analytics_source_mix(date, date, uuid[], text);
DROP FUNCTION IF EXISTS analytics_source_mix_monthly(integer, uuid[]);
DROP FUNCTION IF EXISTS analytics_top_households(integer);

-- Surcharge mono-foyer (038), remplacée par demo_stats_rollup(uuid[], int).
DROP FUNCTION IF EXISTS demo_stats_rollup(uuid, integer);

-- Helpers 033 sans appelant restant (owner_is_real conservé : v3).
DROP FUNCTION IF EXISTS owner_in_carnets(uuid, uuid[]);
DROP FUNCTION IF EXISTS carnet_activity();
