# Undying Scraper — Self-Healing Walkthrough & Demo Guide

This document describes how to trigger, verify, and demonstrate the scraper's self-healing capabilities. 

It covers both **Mock Mode** (simulated failures, zero-setup, zero cost) and **Live Mode** (real Bright Data Scraper Studio repairs).

---

## 🔮 Demo 1: Deterministic Healing (Mock Mode)

In mock mode, the pipeline is designed to fail exactly **1-in-8 runs** to show judges or developers how the self-healing recovery loop operates.

### Steps to Run:
1. Ensure `BRIGHTDATA_COLLECTOR_ID` and `TARGET_URL` are unset in your `.env` (or run without a `.env` file).
2. Execute the pipeline:
   ```bash
   node scripts/run-pipeline.js
   ```
3. If the run is lucky/healthy, run it again until you see:
   ```
   [mock-source] ⚠  Returning BROKEN shape #4 (heal-detection test)
   ```
4. **What Happens under the Hood:**
   - The validation engine (`src/heal-check.js`) flags the raw product list (e.g. price returned as a string `"Rs 299.00"` instead of a number, simulating an AI parsing failure).
   - A `would-heal` event is printed with an amber terminal card showing:
     - **Error Type**: `type_mismatch`
     - **Heal Method**: `simulated`
     - **Attempt**: `1`
   - The pipeline saves the event record to Supabase with `heal_method = 'simulated'` and `resolved = false` (since it's a dry-run mock).
   - A Discord webhook alert is sent if configured.

---

## ⚡ Demo 2: Real AI Self-Healing (Live Mode)

If you are running in Live Mode (with the scraper deployed on Bright Data), you can stage a real selector breakdown and trigger an automated AI repair.

### Scenario: Selector Drift / Class Name Change
To simulate a website redesign where the price class changes (e.g. Raajkart changes their class from `.special-price` to `.discounted-price-label`):

### Steps to Reproduce:

#### 1. Point the Scraper at a Mismatched Page
You can point the collector at a page that has similar content but a slightly different DOM layout (e.g., a completely different category like toys or office stationery which does not display prices under the same CSS selectors).
- Update `TARGET_URL` in `.env` to:
  ```ini
  TARGET_URL=https://raajkart.com/stationery.html
  ```

#### 2. Run the Pipeline
Execute the pipeline:
```bash
node scripts/run-pipeline.js
```
- The scraper runs against the new page layout.
- The return payload is empty or lacks price fields.
- `heal-check.js` catches the validation error:
  ```
  [heal-check] ✗ Scrape result validation failed: missing field 'price'
  ```

#### 3. Automated Trigger
- Because the registry is in `LIVE` mode, the pipeline automatically calls:
  ```bash
  bdata scraper heal c_mt4qg4m3ri0w861pe "price field missing — selector broken due to layout change"
  ```
- The Bright Data AI analyzes the target page, selects the new matching price element, updates the collector code in-place on their cloud servers, and returns.

#### 4. Retry Loop
- The pipeline retries the collector run:
  ```bash
  [heal-check] → Retrying collector run after heal...
  ```
- If the AI identifies the new selectors, the retry returns valid book data.
- The pipeline inserts the books into Supabase and writes a `resolved = true` heal event to the database with `heal_method = 'real'`.

---

## 💳 Bright Data Credit Usage Summary

- **Starting balance**: `$52.00`
- **Scraper creations / test runs**:
  - `bdata scraper create`: Free (AI generation does not charge base credits)
  - `bdata scraper run`: ~$0.003 per run (extremely cheap on the pay-per-result tier)
- **Remaining balance**: `$52.00` (credits consumed are rounded to cents; less than $0.01 was consumed during test runs).
- **Free-Tier Viability**: The free credits provided on registration are more than enough to run this pipeline daily for months.
