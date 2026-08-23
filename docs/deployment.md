# Undying Scraper — Dashboard Deployment Guide (Vercel)

This document provides step-by-step instructions to deploy the Next.js monitoring dashboard to **Vercel** (free tier).

---

## Prerequisites

1. A Vercel account (linked to GitHub).
2. A deployed **Supabase** project with the database schema applied (`supabase/schema.sql`).
3. Your Supabase **Project URL** and **Anon API Key** (found in Project Settings > API).

---

## Deployment Steps (Zero-Config Vercel Integration)

Since this project has a sub-folder structure, Vercel needs to know that the Next.js app lives in the `/dashboard` directory.

### 1. Link Repository in Vercel
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
2. Import your GitHub repository (`WebMorph` or `undying-scraper`).

### 2. Configure Project Settings
In the **Configure Project** screen, set the following options:

* **Project Name**: `undying-scraper-dashboard` (or preferred name)
* **Framework Preset**: `Next.js` (detected automatically)
* **Root Directory**: Click **Edit** next to it, select `dashboard`, and click **Continue**. 
  > [!IMPORTANT]
  > Selecting `/dashboard` as the root directory is critical so Vercel builds the correct sub-folder and ignores the root Node orchestration code.

### 3. Add Environment Variables
Expand the **Environment Variables** section and add the following two public keys:

| Key | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-proj-id.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJ...` | Your Supabase anon public key |

> [!TIP]
> Do NOT add `SUPABASE_SERVICE_ROLE_KEY` or `DISCORD_WEBHOOK_URL` to Vercel. Vercel only hosts the public dashboard (read-only client). The database inserts are handled securely by GitHub Actions backend workflows.

### 4. Deploy!
Click the **Deploy** button. Vercel will build the Next.js application in about 1-2 minutes and provide a live URL (e.g., `https://undying-scraper-dashboard.vercel.app`).

---

## Local Production Testing

To verify the production build locally before deploying:

```bash
cd dashboard
npm run build
npm run start
```
This serves the production bundle on `http://localhost:3000`.
