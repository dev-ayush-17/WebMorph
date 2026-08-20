# Undying Scraper — Pipeline Architecture

## Overview

Undying Scraper is a self-healing price and stock tracker. The pipeline runs on a nightly GitHub Actions cron, collects product data via Bright Data's Scraper Studio, validates it, persists it to Supabase, and surfaces it on a Next.js dashboard with a health timeline.

---

## Full Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIGGER LAYER                                │
│                                                                     │
│   GitHub Actions cron (nightly 02:00 UTC)                          │
│            │                                                        │
│   workflow_dispatch (manual trigger for testing)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       COLLECTION LAYER                              │
│                                                                     │
│   src/collector.js  ──  runCollector()                             │
│                                                                     │
│   TODAY (v0.1):  calls src/sources/mock-source.js                  │
│   ─ generates 15–30 fake products matching the data contract        │
│   ─ occasionally returns a deliberately broken shape                │
│                                                                     │
│   FUTURE (v0.2+):  calls Bright Data Scraper Studio                │
│   ─ bdata scraper run <COLLECTOR_ID> <TARGET_URL> --pretty          │
│   ─ parses stdout JSON into the same data contract shape            │
│                                                                     │
│   ⬆ THIS IS THE MOCK-TO-REAL SWAP POINT ⬆                          │
│   One function body changes. Everything downstream stays identical. │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     HEAL-DETECTION LAYER                            │
│                                                                     │
│   src/heal-check.js  ──  checkResult(collectorResult)              │
│                                                                     │
│   Checks for:                                                       │
│   ✗ Empty array (no products returned)                             │
│   ✗ Missing required fields (product_name, price, currency,        │
│       in_stock, product_url, scraped_at)                            │
│   ✗ Wrong field types (price not a number, in_stock not boolean)   │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  HEALTHY result                                          │     │
│   │  → passes through to persistence layer                  │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  BROKEN result                                           │     │
│   │  → logs "would-heal" event with timestamp + description  │     │
│   │  → TODAY: console.log only (no real collector exists)   │     │
│   │  → FUTURE: call bdata scraper heal <COLLECTOR_ID>        │     │
│   │  → writes heal_event row to Supabase                     │     │
│   │  → triggers Discord webhook alert branch ──────────┐     │     │
│   └──────────────────────────────────────────────────────┤     │     │
└──────────────────────────────┬─────────────────────────────┘     │
                               │                                    │
                               ▼                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                     PERSISTENCE LAYER  (Supabase)                  │
│                                                                     │
│   ┌─────────────────────────┐   ┌──────────────────────────┐      │
│   │  products table          │   │  heal_events table        │      │
│   │  ─────────────────────  │   │  ──────────────────────  │      │
│   │  id (uuid, PK)           │   │  id (uuid, PK)            │      │
│   │  run_id (text)           │   │  timestamp (timestamptz)  │      │
│   │  product_name (text)     │   │  description (text)       │      │
│   │  price (numeric)         │   │  resolved (boolean)       │      │
│   │  currency (text)         │   │  created_at (timestamptz) │      │
│   │  in_stock (boolean)      │   └──────────────────────────┘      │
│   │  product_url (text)      │                                     │
│   │  scraped_at (timestamptz)│                                     │
│   │  created_at (timestamptz)│                                     │
│   └─────────────────────────┘                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ALERT BRANCH                                   │
│   (triggered when heal_event is logged)                             │
│                                                                     │
│   scripts/run-pipeline.js reads DISCORD_WEBHOOK_URL from env       │
│   If set:   POST JSON message to Discord channel webhook            │
│   If unset: console.log("[DISCORD no-op] would have alerted")      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                             │
│                                                                     │
│   dashboard/  (Next.js 14, App Router)                             │
│                                                                     │
│   Page layout:                                                      │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  [Run controls / last-run metadata]                     │      │
│   │─────────────────────────────────────────────────────────│      │
│   │  Product Price Table                                    │      │
│   │  (name | price | currency | in_stock | url | scraped)  │      │
│   │─────────────────────────────────────────────────────────│      │
│   │  Health Timeline                                        │      │
│   │  (heal_events, most recent first, with resolved status) │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
│   Data fetching: server components calling Supabase directly       │
│   Deployable to Vercel (not yet deployed in v0.1)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Mock-to-Real Swap Point

**File:** `src/collector.js`  
**Function:** `runCollector()`

```js
// TODAY (v0.1) — mock
async function runCollector() {
  return generateMockProducts();   // ← THIS LINE IS THE SWAP POINT
}

// FUTURE (v0.2) — real Bright Data call (replace the body above with):
// const { execSync } = require('child_process');
// const raw = execSync(
//   `bdata scraper run ${process.env.BRIGHTDATA_COLLECTOR_ID} ${TARGET_URL} --pretty`
// );
// return JSON.parse(raw);
```

**Everything else** — heal-check, Supabase writes, Discord alerts, the dashboard — is completely unaware of whether the data came from mock or real. The data contract shape is identical either way.

---

## Data Contract

Every run produces an array of objects with exactly this shape:

```json
{
  "product_name": "string",
  "price": 12.99,
  "currency": "USD",
  "in_stock": true,
  "product_url": "https://example.com/product/123",
  "scraped_at": "2026-08-21T01:00:00.000Z"
}
```

No extra fields. No optional fields. If a result deviates from this shape, heal-check flags it.

---

## Free-Tier Constraints

| Layer | Service | Constraint |
|---|---|---|
| Orchestration | GitHub Actions | 2,000 min/month free (public repo); nightly run ~1 min |
| Storage | Supabase | 500 MB DB, 50k MAU — plenty for this use case |
| Presentation | Vercel | 100 GB bandwidth, unlimited deployments |
| Collection | Bright Data | Free trial credits; pay-per-result after |

---

## Future Enhancements (out of scope for v0.1)

- Price history charts (Recharts/Chart.js on dashboard)
- Multiple target sites (multiple collectors, multi-row runs)
- Email alerts in addition to Discord
- Supabase Row Level Security for multi-user access
- Actual `bdata scraper heal` integration
