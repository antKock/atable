-- Migration: 002_household_auth
-- Creates households and device_sessions tables, extends recipes with household_id

-- Create households table
CREATE TABLE households (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  join_code  TEXT NOT NULL UNIQUE,
  is_demo    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create device_sessions table
CREATE TABLE device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  device_name  TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_revoked   BOOLEAN NOT NULL DEFAULT false
);

-- Index for fast lookup of sessions by household
CREATE INDEX ON device_sessions(household_id);

-- Add household_id to recipes (nullable — existing recipes have no household)
ALTER TABLE recipes
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

-- Index for filtering recipes by household
CREATE INDEX ON recipes(household_id);
