-- Migration 034: adoption par cohorte exposée (dashboard v2, lot « époques »).
--
-- Les jauges d'adoption (email de récupération, profil nommé, rôle invité,
-- multi-carnet) étaient calculées sur le PARC ENTIER, alors que ces features
-- n'existent en prod que depuis les Lots 1-4 (2026-07-11) : les personnes
-- arrivées avant diluent le taux et masquent la vraie santé de la feature
-- (constaté : 22 % d'adoption email globale vs 43 % sur la cohorte récente).
-- Cette fonction fournit les mêmes compteurs restreints aux personnes /
-- carnets créés depuis une date — la date d'époque vit côté app
-- (src/lib/admin/epochs.ts), la SQL reste générique.
--
-- Purement ADDITIVE (aucun DROP, aucune modification d'objet existant) :
-- sûre à appliquer avant le déploiement du code, sans fenêtre de casse.

CREATE OR REPLACE FUNCTION analytics_adoption_since(
  p_owners_since  date,
  p_carnets_since date
)
RETURNS TABLE (
  owners_since             bigint,
  with_email_since         bigint,
  named_since              bigint,
  multi_carnet_since       bigint,
  carnets_since            bigint,
  carnets_with_guest_since bigint
)
LANGUAGE sql STABLE AS $$
  WITH recent_owners AS (
    SELECT o.id, o.recovery_email, o.name
    FROM owners o
    WHERE owner_is_real(o.id) AND o.created_at::date >= p_owners_since
  ),
  recent_carnets AS (
    SELECT h.id
    FROM households h
    WHERE h.is_demo = false AND h.name NOT ILIKE 'test%'
      AND h.created_at::date >= p_carnets_since
  )
  SELECT
    (SELECT count(*) FROM recent_owners),
    (SELECT count(*) FROM recent_owners WHERE recovery_email IS NOT NULL),
    (SELECT count(*) FROM recent_owners WHERE name IS NOT NULL),
    (SELECT count(*) FROM recent_owners ro
       WHERE (SELECT count(*) FROM memberships m
                JOIN households h ON h.id = m.household_id
                WHERE m.owner_id = ro.id
                  AND h.is_demo = false AND h.name NOT ILIKE 'test%') >= 2),
    (SELECT count(*) FROM recent_carnets),
    (SELECT count(*) FROM recent_carnets rc
       WHERE EXISTS (SELECT 1 FROM memberships m
                     WHERE m.household_id = rc.id AND m.role = 'guest'));
$$;
