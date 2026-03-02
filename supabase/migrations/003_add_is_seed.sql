-- Migration: 003_add_is_seed
-- Adds is_seed flag to recipes for demo reset tracking

ALTER TABLE recipes
  ADD COLUMN is_seed BOOLEAN NOT NULL DEFAULT false;
