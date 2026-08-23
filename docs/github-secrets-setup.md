# Undying Scraper — GitHub Secrets Configuration Guide

To enable the automated nightly cron job (`.github/workflows/pipeline.yml`) to run successfully and securely, you need to add your API credentials as repository secrets in GitHub.

---

## Required Secrets Checklist

Go to your repository on GitHub: **Settings > Secrets and variables > Actions > New repository secret**, and add the following:

| Secret Name | Value Example | Required? | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | `https://your-proj.supabase.co` | **Yes** | Connects pipeline to Supabase database |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | **Yes** | Authentication token for Supabase inserts |
| `BRIGHTDATA_COLLECTOR_ID` | `c_mt4qg4m3ri0w861pe` | **Yes (Live Mode)** | Target collector ID in Bright Data |
| `TARGET_URL` | `https://raajkart.com/...` | **Yes (Live Mode)** | Scraper target URL for the runs |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/...` | Optional | Webhook to receive instant heal notifications |

> [!NOTE]
> If `BRIGHTDATA_COLLECTOR_ID` or `TARGET_URL` are not added or left empty, the pipeline will automatically fall back to running in **Mock Mode**, using simulated data. This is useful to test and demo the pipeline without consuming Bright Data scraping credits.

---

## Verifying the Setup

After adding the secrets, you can run a manual test run of the pipeline:
1. Go to your repository on GitHub.
2. Click the **Actions** tab.
3. Select the **Undying Scraper Pipeline** workflow on the left sidebar.
4. Click **Run workflow** (on the `feat/v1.0-submission-polish` branch or `main` after merging).
5. Refresh the actions list and inspect the log output to verify everything ran successfully.
