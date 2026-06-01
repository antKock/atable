-- Migration 013: recipe sharing via capability link
--
-- A recipe becomes shareable when the owner mints a `share_token`: a short,
-- high-entropy, unguessable string. The public route /r/<token> resolves a
-- recipe by this token WITHOUT household scoping (capability-URL model — like a
-- "anyone with the link" share). A NULL token means the recipe is private and
-- the public route returns 404. The token can be set back to NULL later to
-- revoke a link without any schema change.
--
-- All DB access remains server-side via the service role (bypasses RLS),
-- consistent with migration 005.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS share_token TEXT;

-- Partial unique index: enforce uniqueness only for minted tokens, so the many
-- private recipes (NULL) are never indexed and never collide.
CREATE UNIQUE INDEX IF NOT EXISTS recipes_share_token_key
  ON recipes (share_token)
  WHERE share_token IS NOT NULL;
