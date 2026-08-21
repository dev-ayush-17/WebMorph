# Undying Scraper — Pipeline Architecture (v0.2)

> **Updated for v0.2** — reflects the real Bright Data CLI integration, the
> collector registry mode-switching, and the real heal-trigger loop.
> v0.1 differences are noted inline.

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

| Component | v0.1 | v0.2 |
|---|---|---|
| Mode switching | Manual code edit in `collector.js` | Automatic via `collector-registry.js` reading env vars |
| Collector abstraction | `collector.js` had a TODO comment | `collector.js` now routes to real or mock based on registry |
| Heal trigger | Always "would-heal" log, no real call | Real `bdata scraper heal` in live mode; "would-heal" in mock mode |
| Heal retry | Not present | After healing, retries the run once; sets `resolved=true` if retry produces valid data |
| Setup tooling | None | `scripts/setup-collector.js` creates collector + writes .env |
| Target site config | Nothing | `config/target-site.example.json` + `docs/how-to-add-target-site.md` |
| Tests | None | 20 unit tests for CLI wrapper and registry (all mock, no real CLI calls) |

---

## What Is Live-Ready vs Pending

| Component | Status | Notes |
|---|---|---|
| Bright Data CLI wrapper | ✅ Live-ready | Fully implemented, 15 unit tests |
| Collector registry | ✅ Live-ready | Single source of truth for mode |
| collector.js swap point | ✅ Live-ready | Routes automatically |
| heal-check + real heal | ✅ Live-ready | Fires in live mode, simulates in mock |
| Supabase schema + client | ✅ Live-ready | Unchanged from v0.1 |
| GitHub Actions workflow | ✅ Live-ready | Needs BRIGHTDATA_COLLECTOR_ID + TARGET_URL secrets added |
| Dashboard | ✅ Live-ready | Unchanged from v0.1; renders whatever Supabase has |
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
├── heal-check.js              Validation + real heal trigger in live mode
└── sources/
    └── mock-source.js         Unchanged — fake data for development/demo

config/
└── target-site.example.json   Template for target site configuration

docs/
├── architecture.md            This file
└── how-to-add-target-site.md  Step-by-step guide for switching to live mode

scripts/
├── run-pipeline.js            Main orchestration (unchanged logic, async heal-check)
└── setup-collector.js         One-time: create collector + write .env

tests/
├── brightdata-client.test.js  15 unit tests for CLI wrapper (all mocked)
└── collector-registry.test.js  5 unit tests for registry
```
