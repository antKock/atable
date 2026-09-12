-- Rôles attendus par PostgREST et par les migrations Supabase (migration
-- Supabase → VPS, docs/infra/migration-supabase-vps.md). À jouer UNE fois par
-- base, AVANT la restauration du dump, en tant que superutilisateur de la base
-- (utilisateur Dokploy `mijote`). Le mot de passe d'`authenticator` est passé
-- par la variable psql :authenticator_password (psql -v).
--
-- Modèle Supabase reproduit a minima : `authenticator` (rôle de connexion de
-- PostgREST, sans droits propres) bascule vers `anon` (requêtes sans JWT —
-- aucun droit) ou `service_role` (JWT du serveur Next — tous droits, RLS
-- contournée comme chez Supabase). `authenticated` et `postgres` n'existent
-- que pour que les GRANT/REVOKE des migrations historiques et futures passent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;

ALTER ROLE authenticator PASSWORD :'authenticator_password';
GRANT anon, authenticated, service_role TO authenticator;

-- Le schéma public est visible des trois rôles (PostgREST charge son cache
-- de schéma via authenticator) ; seuls les objets accordés ci-dessous sont
-- utilisables, et uniquement par service_role.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Postgres accorde EXECUTE à PUBLIC sur toute nouvelle fonction : on retire ce
-- défaut (équivalent de la migration 039 côté Supabase) pour que anon et
-- authenticated ne puissent rien appeler, aujourd'hui comme demain.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
