# Undying Scraper

> A self-healing price and stock tracker built for the **Bright Data Scraper Studio × WeMakeDevs "Into the Scrape-Verse"** hackathon.

**Current status (v0.1):** Infrastructure and orchestration skeleton complete. Mock data source active. Target website and real Bright Data collector pending — that comes in a future session.

---

## What this is

Undying Scraper runs on a nightly cron, pulls product price/stock data via Bright Data's Scraper Studio, detects when extraction breaks (schema drift, empty results), logs heal events, and alerts on Discord. A Next.js dashboard shows a live price history table and a health timeline.

The pipeline is designed so that swapping the mock data source for a real Bright Data collector is **a one-function change** in `src/collector.js` — nothing downstream needs to change.

---

## Repo structure

```
.
├── .github/workflows/   GitHub Actions cron pipeline
├── docs/                Architecture diagram, design notes
├── scripts/             Runnable Node scripts
│   └── run-pipeline.js  Main orchestration entry point
├── src/
│   ├── collector.js     Swappable collector abstraction (mock today)
│   ├── heal-check.js    Broken-result detection logic
│   └── sources/
│       └── mock-source.js  Fake product data generator
├── supabase/
│   └── schema.sql       SQL to paste into Supabase SQL editor
├── dashboard/           Next.js app (product table + health timeline)
├── .env.example         Template for all required env vars
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
| `BRIGHTDATA_COLLECTOR_ID` | Bright Data → Scraper Studio → your collector (leave empty for now) |

### 3. Apply the Supabase schema

In the Supabase dashboard, open **SQL Editor** and paste the contents of `supabase/schema.sql`. Run it.

---

## Running locally

### Run the pipeline (mock data → Supabase)

```bash
node scripts/run-pipeline.js
```

This will:
1. Generate mock product data (15–30 products)
2. Run heal-check (occasionally simulates a broken result)
3. Write healthy rows to `products` table in Supabase
4. Write any heal events to `heal_events` table
5. Send a Discord alert if a heal event fired (no-op if webhook not set)

### Run the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## GitHub Actions (automated nightly run)

The workflow at `.github/workflows/pipeline.yml` runs nightly at 02:00 UTC and can also be triggered manually via `workflow_dispatch`.

Before it works, add these secrets in your GitHub repo (Settings → Secrets and Variables → Actions):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DISCORD_WEBHOOK_URL` (optional)

---

## What's next (v0.2+)

- [ ] Choose target website
- [ ] Create Bright Data Scraper Studio collector for that site
- [ ] Replace mock in `src/collector.js` with real `bdata scraper run` call
- [ ] Wire `BRIGHTDATA_COLLECTOR_ID` in GitHub secrets
- [ ] Enable actual `bdata scraper heal` call in `src/heal-check.js`
- [ ] Deploy dashboard to Vercel

---

## Free-tier notes

Everything here runs on free tiers:
- **Supabase free tier**: 500 MB DB, 50k monthly active users — plenty for this
- **GitHub Actions free**: 2,000 minutes/month for public repos, 500 for private — nightly run costs ~1 min/day
- **Vercel free tier**: sufficient for the dashboard
- 💡 *Paid upgrade worth considering later*: Bright Data's Scraper Studio has a pay-per-result model; free trial credits get you started, but real production use will incur costs.

---

*Built for [WeMakeDevs × Bright Data "Into the Scrape-Verse" hackathon](https://brightdata.com)*
