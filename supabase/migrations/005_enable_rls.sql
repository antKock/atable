-- Migration 005: enable RLS on all public-schema tables
--
-- All app DB access is performed server-side via SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. Enabling RLS without policies therefore denies the
-- public anon key (embedded in the browser bundle) without affecting the app.
-- Resolves Supabase Advisor `rls_disabled_in_public`.

ALTER TABLE recipes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE households      ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_tags     ENABLE ROW LEVEL SECURITY;
