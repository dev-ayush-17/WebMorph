# Undying Scraper

> A self-healing price and stock tracker built for the **Bright Data Scraper Studio × WeMakeDevs "Into the Scrape-Verse"** hackathon.

**Current status (v0.1):** Infrastructure and orchestration skeleton complete. Mock data source active. Real target website and Bright Data collector pending — that comes in a future session.

---

## What this is

Undying Scraper runs on a nightly cron, pulls product price/stock data via Bright Data's Scraper Studio, detects when extraction breaks (schema drift, empty results), logs heal events, and alerts on Discord. A Next.js dashboard shows a live price history table and a health timeline.

The pipeline is designed so that swapping the mock data source for a real Bright Data collector is **a one-function change** in `src/collector.js` — nothing downstream needs to change.

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
├── .github/workflows/   GitHub Actions cron pipeline
│   └── pipeline.yml
├── docs/
│   └── architecture.md  Full pipeline diagram + swap point docs
├── scripts/
│   └── run-pipeline.js  Main orchestration entry point
├── src/
│   ├── collector.js     Swappable collector abstraction (mock today)
│   ├── heal-check.js    Broken-result detection logic
│   └── sources/
│       └── mock-source.js  Fake product data with occasional broken shapes
├── supabase/
│   └── schema.sql       SQL to paste into Supabase SQL editor
├── dashboard/           Next.js 16 app (product table + health timeline)
│   ├── app/
│   │   ├── components/
│   │   │   ├── ProductTable.tsx
│   │   │   └── HealthTimeline.tsx
│   │   ├── globals.css  Terminal Amber design system
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── supabase.ts  Null-safe Supabase client
│       └── data.ts      Server-side data fetchers (with mock fallback)
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
| `BRIGHTDATA_COLLECTOR_ID` | Future (v0.2) |

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

## What's next (v0.2+)

- [ ] Choose target website
- [ ] Create Bright Data Scraper Studio collector for that site
- [ ] Replace mock in `src/collector.js` with real `bdata scraper run` call
- [ ] Wire `BRIGHTDATA_COLLECTOR_ID` in GitHub secrets
- [ ] Enable actual `bdata scraper heal` call in `src/heal-check.js`
- [ ] Deploy dashboard to Vercel
- [ ] Add price history charts

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
