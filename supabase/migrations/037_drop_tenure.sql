-- Migration 037: suppression d'analytics_active_daily_tenure (035), remplacée
-- par analytics_active_daily_cohorts (036 — strates par génération).
--
-- ⚠ À appliquer APRÈS le déploiement du code qui ne l'appelle plus (leçon du
-- 2026-08-14 : un DROP appliqué avant le deploy casse la version encore
-- servie pendant la fenêtre migration → deploy). Les ajouts partent avant le
-- code, les suppressions après.

DROP FUNCTION IF EXISTS analytics_active_daily_tenure(int, text, uuid[]);
