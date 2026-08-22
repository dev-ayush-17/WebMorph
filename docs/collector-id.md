# Undying Scraper — Collector Reference

## Live Collector (v0.4)

| Field | Value |
|---|---|
| **Collector ID** | `c_mt4qg4m3ri0w861pe` |
| **Collector Name** | `undying-scraper-raajkart-physics` |
| **Target URL** | https://raajkart.com/books/college-books.html?c2c_college_books=7003 |
| **Category** | Raajkart College Books — Physics |
| **Expected items** | ~73 books |
| **Created** | 2026-08-22 |
| **Mode** | Live (set `BRIGHTDATA_COLLECTOR_ID=c_mt4qg4m3ri0w861pe` and `TARGET_URL=...`) |

## Exact `bdata scraper create` Command Used

```bash
bdata scraper create \
  "https://raajkart.com/books/college-books.html?c2c_college_books=7003" \
  "For each book listing on the page, extract: product_name (book title as string), price (special/discounted price as a number, no currency symbol), currency (always 'INR' as string), in_stock (boolean, true if no Out of stock label is visible), product_url (the full URL of the book's detail page as string), scraped_at (current ISO timestamp as string)." \
  --name undying-scraper-raajkart-physics
```

## Description Rationale

The description was crafted to:
1. Explicitly request `price` as a **number** (no symbol) — avoiding "Rs 299.00" being returned as a string
2. Hardcode `currency` as `"INR"` (string) — the site always shows INR and we don't want a symbol extracted
3. Define `in_stock` as a **boolean** derived from the absence/presence of "Out of stock" text
4. Include `scraped_at` as ISO timestamp — satisfying our data contract without requiring post-processing

## Switching Between Mock and Live

The collector registry (`src/brightdata/collector-registry.js`) automatically selects the mode:

```
# Live mode (requires both vars set):
BRIGHTDATA_COLLECTOR_ID=c_mt4qg4m3ri0w861pe
TARGET_URL=https://raajkart.com/books/college-books.html?c2c_college_books=7003

# Mock mode (either var unset):
# (just don't set either — the registry falls back automatically)
```

**Zero code changes needed** — this is the exact swap point designed in v0.1.

## Running the Collector Manually

```bash
# One-off test run (outputs JSON):
bdata scraper run c_mt4qg4m3ri0w861pe "https://raajkart.com/books/college-books.html?c2c_college_books=7003"

# Full pipeline (reads from .env automatically):
node scripts/run-pipeline.js

# Mock mode (override live vars):
BRIGHTDATA_COLLECTOR_ID= TARGET_URL= node scripts/run-pipeline.js
```

## Notes on Site Structure

- Prices are shown as "Special Price Rs X.XX" alongside struck-through original prices
- "Out of stock" appears as plain text below items that are unavailable
- The Physics category page (`c2c_college_books=7003`) contains ~73 items — a deliberate subset of the full 4,564-item catalog to keep runs fast and results readable
- The site is publicly accessible — no login required for this category page
