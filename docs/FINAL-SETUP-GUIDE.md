# Final Setup Guide

This document lists the exact remaining manual steps required to take "WebMorph" from its current codebase to a fully live, deployed state for the hackathon submission.

Please execute these steps in exactly this order.

## 1. Supabase Database Configuration
Currently, `run-pipeline.js` falls back to "dry-run" mode because Supabase credentials are missing.
*   **Action**: Copy `.env.example` to `.env`.
*   **Action**: Fill in your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
*   **Action**: Execute `supabase/schema.sql` in your Supabase SQL Editor to create the necessary tables.

## 2. Bright Data Collector Activation
The pipeline successfully attempts to run in **LIVE** mode using collector `c_mt4qg4m3ri0w861pe`. However, it currently fails with a `403 Access Denied` (Collector disabled) error.
*   **Action**: Log into Bright Data.
*   **Action**: Ensure the collector is enabled and your API token has the correct zone permissions.

## 3. Discord Webhook Setup (Optional but recommended)
*   **Action**: Add a `DISCORD_WEBHOOK_URL` to your `.env` file to receive live alerts when the scraper heals or encounters errors.

## 4. Vercel Deployment
The dashboard builds successfully locally but is not yet hosted.
*   **Action**: Import the project into Vercel.
*   **Action**: Set the Root Directory to `dashboard/`.
*   **Action**: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel's environment variables.
*   **Action**: Deploy.

## 5. GitHub Actions Secrets
For the cron jobs (defined in `.github/workflows/pipeline.yml`) to run automatically, GitHub needs access to your credentials.
*   **Action**: Go to your GitHub repository Settings > Secrets and variables > Actions.
*   **Action**: Add the following Repository Secrets:
    *   `SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `BRIGHTDATA_API_TOKEN`
    *   `DISCORD_WEBHOOK_URL` (if using)
    *   `TARGET_URL`

## 6. Live Cron Test
*   **Action**: Go to GitHub Actions, select the "Scraper Pipeline" workflow, and click "Run workflow" to manually trigger and verify the end-to-end cloud execution.

## 7. Demo Recording
*   **Action**: Follow the script in `docs/demo-script.md` and `docs/heal-demo.md` to record your final submission video.
