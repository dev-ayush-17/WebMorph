-- ─────────────────────────────────────────────────────────────────────────────
-- Undying Scraper — Supabase Schema (v0.3)
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO APPLY:
--   If starting fresh: paste this entire file into the SQL Editor and click Run.
--   If upgrading from v0.1/v0.2: paste only the ALTER TABLE and CREATE TABLE
--   blocks that are new — they are marked with [NEW IN v0.3].
--
-- This file is idempotent — IF NOT EXISTS / IF NOT EXISTS checks make it safe
-- to re-run in full from scratch.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation (already on by Supabase default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── products (extended in v0.3) ──────────────────────────────────────────────
-- v0.3 adds: price_changed, stock_changed, previous_price for diff-tracking.

CREATE TABLE IF NOT EXISTS products (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          TEXT           NOT NULL,
  product_name    TEXT           NOT NULL,
  price           NUMERIC(10, 2) NOT NULL,
  currency        TEXT           NOT NULL DEFAULT 'USD',
  in_stock        BOOLEAN        NOT NULL,
  product_url     TEXT           NOT NULL,
  scraped_at      TIMESTAMPTZ    NOT NULL,
  -- [NEW IN v0.3] diff columns ───────────────────────────────────────────────
  price_changed   BOOLEAN        NOT NULL DEFAULT FALSE,
  stock_changed   BOOLEAN        NOT NULL DEFAULT FALSE,
  previous_price  NUMERIC(10, 2),            -- NULL if this is the first seen snapshot
  -- ──────────────────────────────────────────────────────────────────────────
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Upgrade path for existing tables: add v0.3 columns if they don't already exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_changed  BOOLEAN        NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_changed  BOOLEAN        NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_price NUMERIC(10, 2);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_scraped_at ON products (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_url        ON products (product_url);
CREATE INDEX IF NOT EXISTS idx_products_run_id     ON products (run_id);
-- [NEW IN v0.3] For dashboard filter: "show only changed items"
CREATE INDEX IF NOT EXISTS idx_products_changed    ON products (price_changed, stock_changed);


-- ─── heal_events (extended in v0.3) ───────────────────────────────────────────
-- v0.3 adds: attempt_number, heal_method, error_type, duration_ms.

CREATE TABLE IF NOT EXISTS heal_events (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp      TIMESTAMPTZ NOT NULL,
  description    TEXT        NOT NULL,
  resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- [NEW IN v0.3] richer event fields ───────────────────────────────────────
  attempt_number INTEGER     NOT NULL DEFAULT 1,   -- 1 = first heal attempt, 2 = retry, etc.
  heal_method    TEXT        NOT NULL DEFAULT 'simulated',
  --   'simulated' = mock mode (no real bdata call)
  --   'real'      = live mode, bdata scraper heal was called
  error_type     TEXT        NOT NULL DEFAULT 'unknown',
  --   'empty_result'    — collector returned empty array
  --   'missing_fields'  — one or more required fields absent
  --   'type_mismatch'   — field present but wrong type
  --   'cli_auth'        — CliNotAuthenticatedError from Bright Data wrapper
  --   'collector_gone'  — CollectorNotFoundError
  --   'unknown'         — anything else
  duration_ms    INTEGER,                           -- how long this heal attempt took (ms)
  -- ──────────────────────────────────────────────────────────────────────────
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade path for existing tables
ALTER TABLE heal_events ADD COLUMN IF NOT EXISTS attempt_number INTEGER     NOT NULL DEFAULT 1;
ALTER TABLE heal_events ADD COLUMN IF NOT EXISTS heal_method    TEXT        NOT NULL DEFAULT 'simulated';
ALTER TABLE heal_events ADD COLUMN IF NOT EXISTS error_type     TEXT        NOT NULL DEFAULT 'unknown';
ALTER TABLE heal_events ADD COLUMN IF NOT EXISTS duration_ms    INTEGER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_heal_events_timestamp ON heal_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_heal_events_resolved  ON heal_events (resolved);
-- [NEW IN v0.3] For health timeline filtering by type / method
CREATE INDEX IF NOT EXISTS idx_heal_events_method    ON heal_events (heal_method);
CREATE INDEX IF NOT EXISTS idx_heal_events_error_type ON heal_events (error_type);


-- ─── runs (NEW IN v0.3) ───────────────────────────────────────────────────────
-- Lightweight run history: one row per pipeline execution.
-- summary_json holds the structured run summary for the dashboard.

CREATE TABLE IF NOT EXISTS runs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id       TEXT        NOT NULL UNIQUE,
  started_at   TIMESTAMPTZ NOT NULL,
  finished_at  TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'running',
  --   'running'   — still in progress
  --   'healthy'   — completed, all products valid
  --   'degraded'  — completed, heal events fired but some products recovered
  --   'failed'    — completed, zero valid products
  summary_json JSONB,      -- see scripts/run-pipeline.js for the shape
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status     ON runs (status);


-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Still disabled — using anon key for both read and write.
-- Enable when multi-user access is needed (post-hackathon).

-- ─── Verification query ───────────────────────────────────────────────────────
--   SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name IN ('products', 'heal_events', 'runs')
--   ORDER BY table_name, ordinal_position;
