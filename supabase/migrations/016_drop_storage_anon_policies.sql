-- Migration 016: drop the anon Storage policies on recipe-photos
--
-- Photos are now uploaded through /api/recipes/[id]/photo (service role),
-- which verifies household ownership and derives the storage path
-- server-side. The browser no longer talks to Supabase Storage at all, so
-- the anon write/read/delete policies from migrations 006/007 are pure
-- attack surface: anyone holding the public anon key could overwrite or
-- delete any photo in the bucket.
--
-- Public READ of the bucket itself is unaffected (the bucket is public and
-- photo URLs are served directly); only the anon *API* policies go away.

DROP POLICY IF EXISTS "anon_insert_recipe_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_recipe_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_select_recipe_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_recipe_photos" ON storage.objects;
