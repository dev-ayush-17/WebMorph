# Undying Scraper — Pipeline Architecture (v0.3)

> **Updated for v0.3** — reflects diff detection, retry/backoff, structured run summaries,
> richer heal events, and dashboard polish. v0.1/v0.2 differences are noted inline.

---

## High-Level Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TRIGGER LAYER                                │
│                                                                      │
│   GitHub Actions cron (nightly 02:00 UTC)                           │
│            │                                                         │
│   workflow_dispatch (manual trigger for testing)                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    COLLECTOR REGISTRY (NEW IN v0.2)                  │
│                                                                      │
│   src/brightdata/collector-registry.js                               │
│                                                                      │
│   Reads env vars ONCE on first import. Determines mode:              │
│                                                                      │
│   BRIGHTDATA_COLLECTOR_ID + TARGET_URL both set?                     │
│     YES → Mode: LIVE    (real Bright Data scraping)                  │
│     NO  → Mode: MOCK    (mock-source.js, unchanged from v0.1)        │
│                                                                      │
│   ⚠ THIS IS THE ONLY FILE THAT READS THESE ENV VARS.                │
│   No other file checks whether a collector is configured.            │
│                                                                      │
│   To switch from mock to live: set two env vars. Zero code changes.  │
└────────────────┬───────────────────────────┬─────────────────────────┘
                 │ MOCK                       │ LIVE
                 ▼                            ▼
┌────────────────────────┐  ┌────────────────────────────────────────┐
│  MOCK COLLECTION       │  │  LIVE COLLECTION                       │
│                        │  │                                        │
│  src/sources/          │  │  src/brightdata/client.js              │
│    mock-source.js      │  │                                        │
│                        │  │  runCollector(collectorId, targetUrl)  │
│  generateMockProducts()│  │  → bdata scraper run <id> <url>        │
│  15–30 fake products   │  │    --pretty                            │
│  ~12.5% broken shape   │  │  → parses JSON, normalises array       │
│  (heal-detection test) │  │                                        │
└────────────┬───────────┘  └──────────────────────┬─────────────────┘
             │                                      │
             └──────────────────┬───────────────────┘
                                │ raw result (array or broken shape)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   HEAL-DETECTION LAYER (EXTENDED IN v0.2)            │
│                                                                      │
│   src/heal-check.js  —  checkResult(rawResult)                       │
│                                                                      │
│   Validates: non-array, empty array, missing fields, wrong types     │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  MOCK MODE (no real collector)                              │   │
│   │  → Same "would-heal" log as v0.1 (regression safety)       │   │
│   │  → No real bdata call made                                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  LIVE MODE (real collector configured)                      │   │
│   │  1. Call healCollector(id, description)                     │   │
│   │     → bdata scraper heal <id> "<what broke>"                │   │
│   │  2. Retry runCollector(id, url) once after healing          │   │
│   │  3. Validate retry result                                   │   │
│   │  4. resolved = true if retry produced valid products        │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Returns: { healthy, products[], healEvents[] }                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER (Supabase)                    │
│                         UNCHANGED FROM v0.1                          │
│                                                                      │
│   ┌────────────────────────┐   ┌───────────────────────────┐        │
│   │  products              │   │  heal_events              │        │
│   │  ─────────────────── │   │  ─────────────────────── │        │
│   │  id (uuid)             │   │  id (uuid)                │        │
│   │  run_id (text)         │   │  timestamp (timestamptz)  │        │
│   │  product_name (text)   │   │  description (text)       │        │
│   │  price (numeric)       │   │  resolved (boolean)       │        │
│   │  currency (text)       │   │  created_at (timestamptz) │        │
│   │  in_stock (boolean)    │   └───────────────────────────┘        │
│   │  product_url (text)    │                                        │
│   │  scraped_at (timestamptz)│                                      │
│   │  created_at (timestamptz)│                                      │
│   └────────────────────────┘                                        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────────────┐
│  DISCORD ALERT          │       │  PRESENTATION LAYER             │
│  (on heal event)        │       │  dashboard/ (Next.js 16)        │
│  UNCHANGED FROM v0.1    │       │  UNCHANGED FROM v0.1            │
│                         │       │                                 │
│  POST to webhook URL    │       │  Product price table            │
│  No-op if not set       │       │  Health timeline                │
└─────────────────────────┘       └─────────────────────────────────┘
```

---

## What Changed from v0.1

| Component | v0.1 | v0.2 | v0.3 |
|---|---|---|---|
| Mode switching | Manual code edit | Env-var registry | Unchanged |
| Collector abstraction | TODO comment | Real CLI wrapper | Unchanged |
| Heal trigger | Always "would-heal" | Real `bdata scraper heal` in live | Unchanged |
| Heal retry | Not present | 1 attempt | `withRetry()` — max 2 attempts, linear backoff |
| Heal event data | timestamp + description + resolved | +heal_method | +attempt_number, error_type, duration_ms |
| Price diffing | Not present | Not present | `src/diff.js` — price_changed, stock_changed, previous_price |
| Run records | Not present | Not present | `runs` table — structured summary JSON per run |
| Pipeline output | Simple summary box | Async heal-check | Richer summary: diff breakdown, heal resolution |
| Tests | None | 20 unit tests | +21 integration tests (41 total) |
| Setup tooling | None | setup-collector.js | Unchanged |
| Target site config | Nothing | example.json + walkthrough | Unchanged |

---

## What Is Live-Ready vs Pending

| Component | Status | Notes |
|---|---|---|
| Bright Data CLI wrapper | ✅ Live-ready | Fully implemented, 15 unit tests |
| Collector registry | ✅ Live-ready | Single source of truth for mode |
| collector.js swap point | ✅ Live-ready | Routes automatically |
| heal-check + real heal + retry | ✅ Live-ready | withRetry, max 2 attempts, richer events |
| Price/stock diff detection | ✅ Live-ready | Works identically in mock and live |
| Runs table + structured summary | ✅ Live-ready | Every pipeline execution logged |
| Supabase schema | ✅ Live-ready | v0.3 extended, backwards-compatible upgrade path |
| GitHub Actions workflow | ✅ Live-ready | Needs BRIGHTDATA_COLLECTOR_ID + TARGET_URL secrets |
| Dashboard (all three sections) | ✅ Live-ready | Price deltas, heal chips, run history all render from real data |
| Integration test suite | ✅ Live-ready | 41 tests, zero real credentials needed |
| **Actual Bright Data collector** | ⏳ **PENDING** | Needs target site selection → `bdata scraper create` |
| Target URL | ⏳ **PENDING** | One env var to set once site is chosen |

**The single remaining task before live scraping:** Choose a target site, run `scripts/setup-collector.js`, and add two GitHub Actions secrets.

---

## Collector Registry Decision Tree

```
On pipeline startup:
│
├── Is BRIGHTDATA_COLLECTOR_ID set?
│   └── Is TARGET_URL also set?
│       ├── YES → Mode: LIVE
│       │         runCollector() calls real bdata CLI
│       │         checkResult() triggers real heal if broken
│       │
│       └── NO  → Mode: MOCK
│                 runCollector() calls mock-source.js
│                 checkResult() logs "would-heal", no real call
│
└── NO  → Mode: MOCK (regardless of TARGET_URL)
```

---

## Error Classification (New in v0.2)

When in live mode, the Bright Data CLI wrapper classifies errors before passing
them to heal-check:

| Error Class | When thrown | Heal strategy |
|---|---|---|
| `CliNotAuthenticatedError` | `bdata` not installed or `bdata login` not run | Cannot auto-heal — human must run `bdata login` |
| `CollectorNotFoundError` | Collector ID deleted or wrong | Re-create with `bdata scraper create` |
| `ScrapeReturnedEmptyError` | Run succeeded, zero results | Call `bdata scraper heal` → retry |
| `UnknownCliError` | Anything else (network, etc.) | Log and flag for manual review |

---

## Data Contract (Unchanged)

```json
{
  "product_name": "string",
  "price": 12.99,
  "currency": "USD",
  "in_stock": true,
  "product_url": "https://example.com/product/123",
  "scraped_at": "2026-08-21T02:00:00.000Z"
}
```

---

## File Map (v0.2)

```
src/
├── brightdata/
│   ├── client.js              CLI wrapper: createCollector, runCollector, healCollector
│   ├── collector-registry.js  Mode detection (LIVE vs MOCK) — single source of truth
│   └── errors.js              Typed error classes for each CLI failure mode
├── collector.js               Swap point: routes to real or mock via registry
├── diff.js                    [NEW v0.3] Price/stock change detection
├── heal-check.js              Validation + real heal trigger + retry (v0.3)
├── retry.js                   [NEW v0.3] withRetry() wrapper with linear backoff
└── sources/
    └── mock-source.js         Unchanged — fake data for development/demo

config/
└── target-site.example.json   Template for target site configuration

docs/
├── architecture.md            This file (v0.3)
├── how-to-add-target-site.md  Step-by-step guide for switching to live mode
└── v0.3-changelog.md          What changed in v0.3 and why

scripts/
├── run-pipeline.js            Main orchestration (v0.3: diff, runs table, rich summary)
└── setup-collector.js         One-time: create collector + write .env

tests/
├── brightdata-client.test.js  15 unit tests for CLI wrapper
├── collector-registry.test.js  5 unit tests for registry
└── pipeline-integration.test.js  [NEW v0.3] 21 integration tests

supabase/
└── schema.sql                 v0.3: products diff cols, richer heal_events, runs table

dashboard/app/components/
├── ProductTable.tsx           [v0.3] Price delta ▲/▼ indicators, change badges
├── HealthTimeline.tsx         [v0.3] Heal chips (type/method/attempt/duration)
└── RunHistory.tsx             [NEW v0.3] Run history table from runs table
```
