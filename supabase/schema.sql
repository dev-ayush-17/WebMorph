-- ─────────────────────────────────────────────────────────────────────────────
-- Undying Scraper — Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO APPLY:
--   1. Open your Supabase project dashboard
--   2. Navigate to SQL Editor (left sidebar)
--   3. Paste this entire file and click "Run"
--
-- This is idempotent — you can re-run it safely (uses IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation (already enabled on Supabase by default, but safe to include)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── products ─────────────────────────────────────────────────────────────────
-- Stores every successfully extracted product from each pipeline run.
-- `run_id` groups all products scraped in the same pipeline execution.
-- `scraped_at` mirrors the timestamp from the data contract (when the scraper
--   actually fetched the page), vs `created_at` which is when we wrote this row.

CREATE TABLE IF NOT EXISTS products (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id       TEXT        NOT NULL,           -- e.g. "run_2026-08-21T02:00:00Z"
  product_name TEXT        NOT NULL,
  price        NUMERIC(10, 2) NOT NULL,
  currency     TEXT        NOT NULL DEFAULT 'USD',
  in_stock     BOOLEAN     NOT NULL,
  product_url  TEXT        NOT NULL,
  scraped_at   TIMESTAMPTZ NOT NULL,           -- from data contract
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast time-series queries (price history per product over time)
CREATE INDEX IF NOT EXISTS idx_products_scraped_at
  ON products (scraped_at DESC);

-- Index for looking up all runs for a specific product URL
CREATE INDEX IF NOT EXISTS idx_products_url
  ON products (product_url);

-- Index for grouping by run
CREATE INDEX IF NOT EXISTS idx_products_run_id
  ON products (run_id);

-- ─── heal_events ──────────────────────────────────────────────────────────────
-- Records every "would-heal" event detected by the heal-check module.
-- `resolved` is false on creation; can be manually flipped to true once the
--   underlying issue (e.g. site redesign) has been addressed.

CREATE TABLE IF NOT EXISTS heal_events (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp   TIMESTAMPTZ NOT NULL,            -- when the broken result was detected
  description TEXT        NOT NULL,            -- human-readable description of what was wrong
  resolved    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the health timeline (most recent first)
CREATE INDEX IF NOT EXISTS idx_heal_events_timestamp
  ON heal_events (timestamp DESC);

-- Index for filtering unresolved events only
CREATE INDEX IF NOT EXISTS idx_heal_events_resolved
  ON heal_events (resolved);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Currently disabled — the pipeline uses the anon key and reads/writes freely.
-- TODO(v0.3+): enable RLS and add policies when multi-user access is needed.
-- ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE heal_events ENABLE ROW LEVEL SECURITY;

-- ─── Verification query ───────────────────────────────────────────────────────
-- Run this after applying the schema to confirm tables exist:
--
--   SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name IN ('products', 'heal_events')
--   ORDER BY table_name, ordinal_position;
