-- Migration 006: grant anon write access to the recipe-photos bucket
--
-- The browser uploads photos with the public anon key (see
-- src/hooks/usePhotoUpload.ts → createBrowserClient). With RLS enabled on
-- storage.objects and no permissive policy for the anon role, prod returns
-- 403 "new row violates row-level security policy" — surfaced to users as the
-- toast "La photo n'a pas pu être ajoutée".
--
-- This migration codifies the policy expected by the app so it can never
-- silently drift again. Scoped to the one bucket the browser writes to.
-- Bucket-level guardrails (10 MB cap + MIME allow-list) still apply.

DROP POLICY IF EXISTS "anon_insert_recipe_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_recipe_photos" ON storage.objects;

CREATE POLICY "anon_insert_recipe_photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'recipe-photos');

CREATE POLICY "anon_update_recipe_photos" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'recipe-photos')
  WITH CHECK (bucket_id = 'recipe-photos');
