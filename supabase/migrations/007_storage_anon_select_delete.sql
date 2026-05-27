-- Migration 007: add SELECT + DELETE policies for anon on recipe-photos
--
-- Follow-up to 006: empirical testing showed INSERT works with 006 alone, but
-- UPDATE via upsert still returns 403. Supabase Storage's upsert path needs
-- to SELECT the existing row before deciding INSERT vs UPDATE — without an
-- anon SELECT policy, the lookup fails and the operation gets reported as an
-- RLS violation on the "new row".
--
-- DELETE is included for symmetry, even though the server route uses the
-- service role.

DROP POLICY IF EXISTS "anon_select_recipe_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_recipe_photos" ON storage.objects;

CREATE POLICY "anon_select_recipe_photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'recipe-photos');

CREATE POLICY "anon_delete_recipe_photos" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'recipe-photos');
