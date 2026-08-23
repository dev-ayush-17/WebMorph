# 🌀 WebMorph — Autonomous Self-Healing Price & Stock Tracker

A resilient, production-ready web scraping pipeline that heals itself when websites change. Built for the **Bright Data Scraper Studio × WeMakeDevs "Into the Scrape-Verse"** Hackathon.

> **Live Demo Dashboard:** https://web-morph-ruby.vercel.app/ 

---

## 💡 The Pitch: Why This Matters

Most price and stock trackers fail silently when target websites undergo structural changes or redesigns. A broken CSS selector results in empty datasets or corrupted null entries, remaining broken until a developer manually patches and redeploys the code. 

**WebMorph** eliminates this single point of failure. It acts as an autonomous data pipeline that monitors textbook listings on **Raajkart.com**. If a markup change breaks the extraction schema, WebMorph:
1. **Detects** the validation failure instantly.
2. **Triggers** Bright Data's AI-powered self-healing engine to analyze the page and fix selectors in place.
3. **Retries** the execution to save healthy data to a Supabase database.
4. **Notifies** you on Discord with detailed diagnostics.

---

## 🏗 Pipeline Architecture

```
                                ┌────────────────────────┐
                                │   Raajkart.com Book    │
                                │  Physics Listing Page  │
                                └───────────┬────────────┘
                                            │ (Scraped via Web Unlocker)
                                            ▼
                                ┌────────────────────────┐
                                │   Bright Data Scraper  │
                                │   Studio Collector     │
                                └───────────┬────────────┘
                                            │
                                            ▼
 ┌──────────────────┐           ┌────────────────────────┐
 │  GitHub Actions  ├──────────►│  run-pipeline.js Orche  │
 │   Nightly Cron   │           │  strator (Node.js)     │
 └──────────────────┘           └───────────┬────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼ (On Validation Failure)    ▼ (If Success)               ▼ (Diagnostic Alert)
      ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
      │ bdata scraper    │        │ Diff Engine &    │        │ Discord Webhook  │
      │ heal API         │        │ Supabase Writer  │        │ Notification     │
      └────────┬─────────┘        └────────┬─────────┘        └──────────────────┘
               │                           │
               ▼ (AI code update)          ▼
      ┌──────────────────┐        ┌──────────────────┐
      │ Scraper code     │        │ Supabase DB      │
      │ updated in-cloud │        │ (products,       │
      └──────────────────┘        │  runs, events)   │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ Next.js Dashboard│
                                  │ (Terminal Amber) │
                                  └──────────────────┘
```

---

## ⚡ The Key Differentiator: Real Self-Healing

Unlike simple monitoring scripts, WebMorph implements a **real, functional self-healing feedback loop**. By leveraging the `@brightdata/cli` wrapper, our Node orchestration client programmatically interacts with Bright Data's Scraper Studio API. When a structural page break is detected, the pipeline automatically submits the broken DOM to the AI compiler to re-target the elements, updating the scraper configuration in real time without human intervention.

---

## 🛠 Tech Stack

- **Core Extraction**: [Bright Data Scraper Studio](https://brightdata.com/products/web-scraper) (with Web Unlocker bypassing Cloudflare bot-walls).
- **Data Orchestration**: Node.js client with linear backoff retries.
- **Database Layer**: [Supabase](https://supabase.com) (PostgreSQL tables for Products, Runs, and Heal Events).
- **Automation Pipeline**: GitHub Actions (nightly cron workflows + manual triggers).
- **Frontend Dashboard**: Next.js Server Components styled with a premium custom **Terminal Amber** vanilla CSS design system.
- **Diagnostics**: Discord API (embedded webhook alerts).

---

## 🔄 How the Self-Healing Loop Works

```
 ┌──────────┐     ┌────────────┐     ┌──────────┐     ┌──────────┐
 │  SCRAPE  │───► │  VALIDATE  │───► │   HEAL   │───► │  RETRY   │
 └──────────┘     └────────────┘     └──────────┘     └──────────┘
```

1. **Scrape**: The orchestrator triggers the collector to scrape the target URL.
2. **Validate**: `heal-check.js` scans the payload against our strict data contract (requiring product name, numeric price, INR currency, stock boolean, absolute URL, and timestamp).
3. **Heal**: If a validation failure occurs (e.g. price class renamed), the script fires a `bdata scraper heal` event.
4. **Verify**: The script performs a linear-backoff retry of the collector. If it succeeds, the healed run is completed, and the dashboard logs the event as resolved.

---

## 💻 Local Setup & Installation

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/dev-ayush-17/WebMorph.git
cd WebMorph
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials. To run in **Mock Mode** (simulating runs and self-healing deterministically), leave the `BRIGHTDATA_COLLECTOR_ID` and `TARGET_URL` values blank.

### 3. Setup Supabase Database Schema
In your Supabase project dashboard, open the **SQL Editor**, paste the contents of `supabase/schema.sql`, and click **Run**. This configures the tables for products, heal events, and pipeline runs.

### 4. Run the Pipeline
```bash
# Triggers the Node.js scraper workflow
node scripts/run-pipeline.js
```

### 5. Launch the Dashboard
```bash
cd dashboard
cp .env.local.example .env.local
# (Optional) Add your Supabase credentials to dashboard/.env.local
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the monitoring interface. If Supabase is unconfigured, the dashboard automatically loads simulated textbook price deltas and historical timeline events.

---

## 📖 Additional Walkthroughs & Documentation

* **Self-Healing Demo Walkthrough**: Check out [`docs/heal-demo.md`](docs/heal-demo.md) to learn how to trigger simulated or real selector failures.
* **Architecture Deep-Dive**: See [`docs/architecture.md`](docs/architecture.md) for full database schemas and swappable mode details.
* **Vercel Deployment Guide**: Detailed in [`docs/deployment.md`](docs/deployment.md).
* **GitHub Actions Secret Settings**: Detailed in [`docs/github-secrets-setup.md`](docs/github-secrets-setup.md).

---

## 🏆 Hackathon Submission Info
- **Project**: WebMorph
- **Submission Date**: August 2026
- **Event**: Bright Data Scraper Studio × WeMakeDevs "Into the Scrape-Verse" Hackathon
