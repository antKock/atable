CREATE TABLE recipes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,                          -- nullable V1, required V2
  title       TEXT        NOT NULL,
  ingredients TEXT,                          -- free text, newline-separated
  steps       TEXT,                          -- free text, newline-separated
  tags        TEXT[]      DEFAULT '{}',      -- PostgreSQL array
  photo_url   TEXT,                          -- Supabase public storage URL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
