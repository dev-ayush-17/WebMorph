# Undying Scraper

> A self-healing price and stock tracker built for the **Bright Data Scraper Studio × WeMakeDevs "Into the Scrape-Verse"** hackathon.

**Current status (v0.3):** Infrastructure and orchestration complete. Mock-mode pipeline is **demo-ready** — runs end-to-end showing price/stock diff, structured run summaries, and a polished dashboard with run history. Real Bright Data integration wired (v0.2). Target website and Collector ID still pending — add two env vars and it goes live instantly.

---

## What this is

Undying Scraper runs on a nightly cron, pulls product price/stock data via Bright Data's Scraper Studio, detects when extraction breaks (schema drift, empty results), logs heal events, and alerts on Discord. A Next.js dashboard shows a live price history table and a health timeline.

The pipeline is designed so that swapping the mock data source for a real Bright Data collector requires **zero code changes** — set `BRIGHTDATA_COLLECTOR_ID` + `TARGET_URL` environment variables and the collector registry switches automatically. The dashboard, diffing, heal-check, and run history all work identically in both modes.

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full pipeline diagram and the mock-to-real swap point explanation.

```
Target site → Bright Data Scraper Studio → GitHub Actions cron
  → heal-detection → Supabase → Next.js dashboard
                  ↘ Discord alert (on heal event)
```

---

## Repo structure

```
.
├── .github/workflows/       GitHub Actions cron pipeline
│   └── pipeline.yml
├── config/
│   └── target-site.example.json  Template for target site config
├── docs/
│   ├── architecture.md          Full pipeline diagram (v0.3)
│   ├── how-to-add-target-site.md  Step-by-step guide for going live
│   └── v0.3-changelog.md        What changed in v0.3 and why
├── scripts/
│   ├── run-pipeline.js          Main orchestration (v0.3: diff, runs table, rich summary)
│   └── setup-collector.js       One-time helper: bdata scraper create + .env write
├── src/
│   ├── brightdata/
│   │   ├── client.js            Bright Data CLI wrapper (v0.2)
│   │   ├── collector-registry.js  Mode switching: LIVE vs MOCK (v0.2)
│   │   └── errors.js            Typed error classes (v0.2)
│   ├── collector.js             Swap point — routes to real or mock via registry
│   ├── diff.js                  Price/stock change detection (v0.3)
│   ├── heal-check.js            Validation + real heal/retry (v0.3: richer events, retry)
│   ├── retry.js                 Retry/backoff wrapper (v0.3)
│   └── sources/
│       └── mock-source.js       Fake data with occasional broken shapes
├── supabase/
│   └── schema.sql               SQL schema (v0.3: products diff cols, richer heal_events, runs table)
├── tests/
│   ├── brightdata-client.test.js   15 CLI wrapper tests
│   ├── collector-registry.test.js   5 registry tests
│   └── pipeline-integration.test.js  21 integration tests (v0.3)
├── dashboard/                   Next.js 16 app
│   ├── app/
│   │   ├── components/
│   │   │   ├── ProductTable.tsx   Price delta indicators (v0.3)
│   │   │   ├── HealthTimeline.tsx  Richer heal event cards (v0.3)
│   │   │   └── RunHistory.tsx     Run history table (v0.3 new)
│   │   ├── globals.css            Terminal Amber design system
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── supabase.ts            Null-safe Supabase client
│       └── data.ts                Data fetchers + extended types (v0.3)
├── .env.example                 Template for all required env vars
└── README.md
```

---

## Prerequisites

- Node.js 18+
- A Supabase project (free tier) — see "Setup" below
- (Optional) A Discord webhook URL for heal alerts
- (Later) A Bright Data account with a Scraper Studio collector

---

## Setup

### 1. Clone and install root dependencies

```bash
git clone <your-fork>
cd undying-scraper
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon public key |
| `DISCORD_WEBHOOK_URL` | Discord server → Integrations → Webhooks (optional) |
| `BRIGHTDATA_COLLECTOR_ID` | Bright Data → Scraper Studio → your collector (**leave empty for now**) |

### 3. Apply the Supabase schema

In the Supabase dashboard, open **SQL Editor** and paste the contents of `supabase/schema.sql`. Run it.

---

## Running locally

### Run the pipeline (mock data → Supabase)

```bash
node scripts/run-pipeline.js
```

This will:
1. Generate mock product data (15–30 products, occasionally broken)
2. Run heal-check validation
3. Write healthy rows to `products` table in Supabase
4. Write any heal events to `heal_events` table
5. Send a Discord alert if a heal event fired (no-op if webhook not set)

**No Supabase credentials?** It runs in dry-run mode and logs what it *would* write — safe to run immediately.

### Run the dashboard

```bash
cd dashboard
cp .env.local.example .env.local
# edit .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**No Supabase credentials?** The dashboard renders with mock data automatically.

---

## Dashboard design

The dashboard uses a **Terminal Amber** theme — a dark background with amber/gold data accents and Space Grotesk + Space Mono typefaces. Layout is a sidebar-main split (not hero+cards) with a data table and vertical health timeline. Design follows [Hallmark](https://github.com/Nutlope/hallmark) principles: named theme, structural variety, no Inter+purple-gradient defaults.

> **Note:** The `hallmark` npm package/skill should be properly installed in a future session for automated design system enforcement.

---

## GitHub Actions (automated nightly run)

The workflow at `.github/workflows/pipeline.yml` runs nightly at **02:00 UTC** and supports `workflow_dispatch` for manual triggers.

Before it works, add these **Secrets** in your GitHub repo (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Required? |
|---|---|
| `SUPABASE_URL` | ✅ Yes |
| `SUPABASE_ANON_KEY` | ✅ Yes |
| `DISCORD_WEBHOOK_URL` | Optional |
| `BRIGHTDATA_COLLECTOR_ID` | When target site chosen |
| `TARGET_URL` | When target site chosen |

---

## What you need to create/configure before going live

1. **Supabase project** (free tier at [supabase.com](https://supabase.com))
   - Run `supabase/schema.sql` in the SQL editor
   - Copy Project URL + anon key into `.env` and `dashboard/.env.local`

2. **Discord webhook** (optional) — for heal alerts
   - Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL
   - Add to `.env` as `DISCORD_WEBHOOK_URL`

3. **GitHub repository secrets** — for automated runs
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optionally `DISCORD_WEBHOOK_URL`

4. **Vercel** (for dashboard deployment — future)
   - `cd dashboard && vercel` — will prompt for project setup
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in Vercel dashboard

5. **Bright Data collector** (v0.2)
   - Create a Scraper Studio collector for the target site
   - Paste its ID into `BRIGHTDATA_COLLECTOR_ID`
   - Replace the mock in `src/collector.js` with the real `bdata scraper run` call

---

## What's done / what's next

### ✅ Complete (v0.1–v0.3)
- [x] Data contract + mock data source
- [x] Heal-detection pipeline with Discord alerts
- [x] Supabase schema (products, heal_events, runs)
- [x] GitHub Actions nightly cron
- [x] Next.js dashboard — Terminal Amber design
- [x] Bright Data CLI wrapper with typed errors (v0.2)
- [x] Collector registry — zero-code env-var switch (v0.2)
- [x] Real heal-trigger + retry in live mode (v0.2/v0.3)
- [x] Price/stock diff detection (v0.3)
- [x] Structured run summaries + runs table (v0.3)
- [x] Integration test suite — 41 tests total (v0.3)
- [x] Dashboard: price delta indicators, heal chips, run history (v0.3)

### ⏳ Pending (requires target site decision)
- [ ] Choose target website
- [ ] Run `node scripts/setup-collector.js --url <url> --description <fields>`
- [ ] Add `BRIGHTDATA_COLLECTOR_ID` + `TARGET_URL` to GitHub Actions secrets
- [ ] Deploy dashboard to Vercel
- [ ] Add price history charts (Recharts)

---

## Free-tier notes

Everything here runs on free tiers:

| Service | Limit | Notes |
|---|---|---|
| **Supabase** | 500 MB DB | Plenty for this use case |
| **GitHub Actions** | 2,000 min/month (public) | Nightly run ~1 min/day |
| **Vercel** | 100 GB bandwidth | Sufficient for the dashboard |
| **Bright Data** | Free trial credits | 💡 *Pay-per-result after trial — plan for costs in production* |

---

*Built for [WeMakeDevs × Bright Data "Into the Scrape-Verse" hackathon](https://brightdata.com)*
