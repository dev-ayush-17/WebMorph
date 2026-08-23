# Undying Scraper — Demo Video Presentation Script

This script is designed for a **2.5-minute video walkthrough** presenting the project to hackathon judges. 

---

## 🎬 Act I: The Hook & The Problem (0:00 - 0:30)

**[Visual: Headshot or starting slide of "Undying Scraper"]**

> "Hi everyone! In web scraping, there's one universal truth: **scrapers break.** E-commerce layouts change, class names shift, and product catalogs update. Normally, a scraper breaks silently, polluting your database with empty arrays or corrupted nulls until you notice it days later, write a fix, and redeploy. 
> 
> That's why we built **Undying Scraper** — a self-healing price and stock tracker that automatically detects validation failures, triggers an AI-powered repair in place, retries the run, and alerts you on Discord, keeping your data pipeline alive without human intervention."

---

## 🎬 Act II: The Live Dashboard & Target Site (0:30 - 1:15)

**[Visual: Screen share of the Next.js Dashboard running locally or deployed]**

> "Here is our live monitoring dashboard, designed around a clean, hardware-inspired 'Terminal Amber' theme. We are tracking textbooks in the **Physics category on Raajkart.com**, monitoring around 73 items.
>
> On the left panel, you see our pipeline health metrics: products tracked, current in-stock ratio, and our historical runs. In the main table, you see real book prices. Notice the green and red delta chips showing price changes since the last run, stock status flips, and new items. 
> 
> Everything runs on server-side Next.js server components fetching directly from Supabase."

---

## 🎬 Act III: The Magic — Staging a Scraper Failure (1:15 - 2:00)

**[Visual: Terminal show-and-tell. Run a pipeline command showing failure]**

> "Now let's look at the self-healing in action. I'm going to run the pipeline. 
>
> *[Point to screen showing run log]* 
>
> Oh, the source page layout changed, and the prices are missing! Our validation engine immediately catches that the price field is empty. Instead of crashing, it opens a 'degraded' run record and triggers a **real Bright Data Scraper Studio self-healing automation** using the `bdata scraper heal` command.
> 
> The AI analyzes the new DOM, identifies the new CSS selectors for the price elements, patches the scraper code in place, and retries.
> 
> *[Show terminal succeeding on retry]*
> 
> And look at that! The retry succeeds, 73 books are successfully normalized and saved to Supabase, and a healed event is logged. We also receive a Discord notification alerting us of the auto-recovery."

---

## 🎬 Act IV: Health Timeline & Wrap-Up (2:00 - 2:30)

**[Visual: Go back to the dashboard, scroll to the Health Timeline and Run History]**

> "Back on the dashboard, the **Health Timeline** now displays our real heal event, showing the error type—'missing fields'—the healing method—'real'—and the exact duration of the recovery. The **Run History** table logs this run as resolved.
> 
> Under the hood, the system is fully automated. It runs on a nightly GitHub Actions cron job, pushing to Supabase, and uses a swappable collector registry that makes transitioning between simulated development and live scraping a zero-code change.
> 
> Undying Scraper guarantees your monitoring never sleeps and your data never breaks. Thank you!"
