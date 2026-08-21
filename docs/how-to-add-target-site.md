# How to Add a Real Target Site to Undying Scraper

> **Who this is for:** Future-you, after you've chosen a target website and are ready to switch from mock data to real scraped data.
>
> **Prerequisite:** The `bdata` CLI must be installed and you must be logged in (`bdata login`).

---

## Overview

Switching from mock to live takes **4 steps**:

1. Understand the target site's data shape
2. Create a Bright Data collector for it
3. Set two environment variables
4. Verify one real run

That's it. **No code changes required** — the architecture is already wired for this.

---

## Step 1 — Understand the target site's data shape

Before creating the collector, look at the target site manually and answer:

| Question | Why it matters |
|---|---|
| What is the exact URL of the listing/category page? | This is `TARGET_URL` |
| How is the price formatted? (`$29.99`? `29.99`? `2999` cents?) | Determines if the collector parses a float or you need post-processing |
| Is stock shown as `Add to Cart` / `Out of Stock` text, or a boolean? | Determines the field description for `in_stock` |
| How many products appear per page? | Sets expectations for run results |
| Does the site require login to see prices? | If yes, you need Bright Data's authenticated scraping — add a note here |

Fill in your answers in `config/target-site.example.json` (copy it to `config/target-site.json` first — that file is gitignored).

---

## Step 2 — Write the field description for Bright Data

The field description is a plain-English prompt you give to `bdata scraper create`.
It tells Bright Data's AI which fields to extract from each product.

**Format:** A comma-separated list of `field_name as type` statements.

**Example (fill yours in):**
```
product name as string, price as number without currency symbol, currency code as 3-letter uppercase string, in_stock as boolean (true if Add to Cart is visible), product URL as string
```

**Rules:**
- Match the field names **exactly** to our data contract:
  `product_name`, `price`, `currency`, `in_stock`, `product_url`, `scraped_at`
  (`scraped_at` is added by the collector automatically — don't include it)
- `price` must be a number (no `$` sign) — if the site shows `$29.99`, describe it as `price as float, strip currency symbol`
- `in_stock` must be a boolean — describe the condition clearly

---

## Step 3 — Create the Bright Data collector

Run this command, replacing the placeholders with your real values:

```bash
bdata scraper create "https://your-target-site.com/products" \
  "product name as string, price as float without currency symbol, currency as 3-letter code, in_stock as boolean, product URL as string"
```

**Expected output:**
```
Collector created: c_xxxxxxxxxxxxxxxxxx
```

> 💡 If the output format is different, the collector ID is still extractable — look for `c_` followed by alphanumerics. The `createCollector()` function in `src/brightdata/client.js` handles this automatically if you use the script below.

**Alternative — use the provided setup helper:**
```bash
node scripts/setup-collector.js \
  --url "https://your-target-site.com/products" \
  --description "product name as string, price as float, ..."
```
*(This script does the same thing and also writes the ID to your .env automatically — see `scripts/setup-collector.js`.)*

---

## Step 4 — Set the two environment variables

Open your `.env` file (copy from `.env.example` if you haven't already) and set:

```dotenv
BRIGHTDATA_COLLECTOR_ID=c_xxxxxxxxxxxxxxxxxx   # from Step 3
TARGET_URL=https://your-target-site.com/products  # same URL as Step 3
```

For GitHub Actions, add these as **repository secrets** (Settings → Secrets → Actions):
- `BRIGHTDATA_COLLECTOR_ID`
- `TARGET_URL`

---

## Step 5 — Verify one real run

Run the pipeline locally:

```bash
node scripts/run-pipeline.js
```

Expected output (with real credentials set):

```
[collector-registry] Mode: LIVE
[collector-registry]   Collector ID : c_xxxxxxxxxxxxxxxxxx
[collector-registry]   Target URL   : https://your-target-site.com/products
[collector] Mode: LIVE — running Bright Data collector c_xxxxxxxxxxxxxxxxxx
[brightdata] Running: bdata scraper run c_xxxxxxxxxxxxxxxxxx "https://..." --pretty
[brightdata] ✓ Collector returned 28 items
[heal-check] ✓  All 28 products passed validation
[pipeline] ✓  Inserted 28 products (run_id=run_2026-xx-xxTxx:xx:xx.xxxZ)
```

If heal-check fails on the first run, it will automatically call `bdata scraper heal` and retry. Check the output and the `heal_events` table in Supabase.

---

## Step 6 — (Optional) Disable mock fallback after confirming live works

The mock fallback is automatic and harmless in production (it only activates when env vars are missing). But once you're confident live mode works, you can:

1. **Remove the mock from CI** — simply ensure `BRIGHTDATA_COLLECTOR_ID` and `TARGET_URL` are always set in GitHub Actions secrets. The registry will never fall to mock.
2. **Keep mock for local dev** — in `.env` you might keep the vars empty, so local `npm run pipeline` runs use mock data without burning Bright Data credits.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `CliNotAuthenticatedError` | `bdata` not installed or not logged in | Run `bdata login` |
| `CollectorNotFoundError` | Wrong `BRIGHTDATA_COLLECTOR_ID` | Check the ID in Bright Data dashboard |
| `ScrapeReturnedEmptyError` on first run | Target site structure not recognised | Re-run `bdata scraper create` with a better field description |
| `heal_events` table has `resolved: false` | Heal was triggered but retry also failed | Check Bright Data dashboard for collector status; may need to re-create |
| All validation errors on `price` field | Site shows price with `$` prefix | Update your field description to `strip currency symbol` |

---

## Data contract reminder

Every product the pipeline persists must match exactly:

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

If Bright Data's collector returns extra fields, they're silently ignored by heal-check.
If it returns fewer fields, heal-check will flag it and trigger a heal.

---

*Last updated: v0.2 — architecture docs*
