-- Migration 004: AI Enrichment — v3 data model
-- Adds tags table, recipe_tags junction, and v3 metadata columns to recipes

-- 1. Tags table
CREATE TABLE tags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  category      TEXT,
  is_predefined BOOLEAN     NOT NULL DEFAULT false,
  household_id  UUID        REFERENCES households(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, household_id)
);

CREATE INDEX idx_tags_household_id  ON tags(household_id);
CREATE INDEX idx_tags_is_predefined ON tags(is_predefined);

-- 2. Recipe ↔ Tag junction
CREATE TABLE recipe_tags (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

-- 3. New columns on recipes
ALTER TABLE recipes
  ADD COLUMN prep_time          TEXT,
  ADD COLUMN cook_time          TEXT,
  ADD COLUMN cost               TEXT,
  ADD COLUMN complexity         TEXT,
  ADD COLUMN seasons            TEXT[]     DEFAULT '{}',
  ADD COLUMN image_prompt       TEXT,
  ADD COLUMN generated_image_url TEXT,
  ADD COLUMN enrichment_status  TEXT       NOT NULL DEFAULT 'none',
  ADD COLUMN image_status       TEXT       NOT NULL DEFAULT 'none',
  ADD COLUMN last_viewed_at     TIMESTAMPTZ,
  ADD COLUMN view_count         INTEGER    NOT NULL DEFAULT 0;

-- 4. Seed predefined tags (~50+ across 6 categories)
INSERT INTO tags (name, category, is_predefined) VALUES
  -- Type de plat
  ('Entrée',             'Type de plat', true),
  ('Plat principal',     'Type de plat', true),
  ('Accompagnement',     'Type de plat', true),
  ('Dessert',            'Type de plat', true),
  ('Soupe',              'Type de plat', true),
  ('Salade',             'Type de plat', true),
  ('Apéro',              'Type de plat', true),
  ('Petit-déjeuner',     'Type de plat', true),
  ('Goûter',             'Type de plat', true),
  ('Boisson',            'Type de plat', true),
  ('Sauce / Condiment',  'Type de plat', true),
  ('Pain / Pâtisserie',  'Type de plat', true),
  -- Régime alimentaire
  ('Végétarien',         'Régime alimentaire', true),
  ('Végan',              'Régime alimentaire', true),
  ('Sans gluten',        'Régime alimentaire', true),
  ('Sans lactose',       'Régime alimentaire', true),
  ('Léger',              'Régime alimentaire', true),
  ('Comfort food',       'Régime alimentaire', true),
  -- Protéine principale
  ('Poulet',             'Protéine principale', true),
  ('Bœuf',               'Protéine principale', true),
  ('Porc',               'Protéine principale', true),
  ('Agneau',             'Protéine principale', true),
  ('Poisson',            'Protéine principale', true),
  ('Fruits de mer',      'Protéine principale', true),
  ('Œufs',               'Protéine principale', true),
  ('Tofu / Protéines végétales', 'Protéine principale', true),
  ('Légumineuses',       'Protéine principale', true),
  -- Cuisine
  ('Française',          'Cuisine', true),
  ('Italienne',          'Cuisine', true),
  ('Indienne',           'Cuisine', true),
  ('Libanaise / Orientale', 'Cuisine', true),
  ('Mexicaine',          'Cuisine', true),
  ('Asiatique',          'Cuisine', true),
  ('Africaine',          'Cuisine', true),
  ('Américaine',         'Cuisine', true),
  ('Méditerranéenne',    'Cuisine', true),
  ('Nordique',           'Cuisine', true),
  -- Occasion
  ('Rapide',             'Occasion', true),
  ('En batch',           'Occasion', true),
  ('Repas de fête',      'Occasion', true),
  ('Pique-nique',        'Occasion', true),
  ('Lunchbox',           'Occasion', true),
  -- Caractéristiques
  ('Pas cher',           'Caractéristiques', true),
  ('Facile',             'Caractéristiques', true),
  ('One-pot',            'Caractéristiques', true),
  ('Sans cuisson',       'Caractéristiques', true),
  ('Pour les enfants',   'Caractéristiques', true),
  ('À congeler',         'Caractéristiques', true);
