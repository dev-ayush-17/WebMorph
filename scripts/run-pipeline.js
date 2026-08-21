/**
 * scripts/run-pipeline.js
 *
 * Main orchestration entry point for Undying Scraper.
 *
 * Flow:
 *   1. Generate a unique run_id for this execution
 *   2. Call runCollector() to get raw product data
 *   3. Run heal-check on the result
 *   4. Write healthy products to Supabase `products` table
 *   5. Write any heal events to Supabase `heal_events` table
 *   6. Send a Discord webhook alert if a heal event was logged
 *
 * Run locally: node scripts/run-pipeline.js
 * Requires: .env file with SUPABASE_URL and SUPABASE_ANON_KEY
 *   (or those vars set in the process environment by GitHub Actions)
 */

'use strict';

// Load .env file for local development (GitHub Actions sets env vars directly)
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { runCollector }  = require('../src/collector');
const { checkResult }   = require('../src/heal-check');

// ─── Configuration ────────────────────────────────────────────────────────────

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

// ─── Supabase client ──────────────────────────────────────────────────────────

/**
 * Initialise the Supabase client.
 * Returns null (with a warning) if credentials are missing — this allows the
 * pipeline to run in "dry-run" mode locally without a Supabase project yet.
 */
function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      '[pipeline] ⚠  SUPABASE_URL or SUPABASE_ANON_KEY not set — ' +
      'Supabase writes will be skipped (dry-run mode). ' +
      'Copy .env.example to .env and fill in your credentials.'
    );
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ─── Discord alert ────────────────────────────────────────────────────────────

/**
 * Send a Discord webhook message when a heal event is detected.
 * No-ops gracefully if DISCORD_WEBHOOK_URL is not set.
 *
 * @param {Array} healEvents  - Array of heal event objects from checkResult()
 * @param {string} runId      - The current run ID for context
 */
async function sendDiscordAlert(healEvents, runId) {
  if (!DISCORD_WEBHOOK) {
    console.log(
      '[discord] ℹ  DISCORD_WEBHOOK_URL not set — would have sent alert for ' +
      `${healEvents.length} heal event(s). Set the variable to enable alerts.`
    );
    return;
  }

  const embeds = healEvents.map((evt, i) => ({
    title: `🚨 Heal Event #${i + 1} Detected`,
    description: evt.description,
    color: 0xe74c3c, // red
    fields: [
      { name: 'Run ID',    value: runId,          inline: true },
      { name: 'Time',      value: evt.timestamp,  inline: true },
      { name: 'Resolved',  value: String(evt.resolved), inline: true },
    ],
    footer: { text: 'Undying Scraper — self-healing pipeline' },
  }));

  const payload = {
    username: 'Undying Scraper',
    avatar_url: 'https://em-content.zobj.net/source/twitter/376/spider_1f577-fe0f.png',
    embeds,
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[discord] ✗  Webhook POST failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[discord] ✓  Alert sent for ${healEvents.length} heal event(s)`);
    }
  } catch (err) {
    // Never let a Discord failure crash the pipeline
    console.error(`[discord] ✗  Webhook error (non-fatal): ${err.message}`);
  }
}

// ─── Supabase write helpers ───────────────────────────────────────────────────

async function writeProducts(supabase, products, runId) {
  if (!supabase) {
    console.log(`[pipeline] [dry-run] Would insert ${products.length} products with run_id=${runId}`);
    return;
  }

  const rows = products.map((p) => ({
    run_id:       runId,
    product_name: p.product_name,
    price:        p.price,
    currency:     p.currency,
    in_stock:     p.in_stock,
    product_url:  p.product_url,
    scraped_at:   p.scraped_at,
  }));

  const { error } = await supabase.from('products').insert(rows);
  if (error) {
    console.error(`[pipeline] ✗  Failed to insert products: ${error.message}`);
    throw error;
  }
  console.log(`[pipeline] ✓  Inserted ${rows.length} products (run_id=${runId})`);
}

async function writeHealEvents(supabase, healEvents) {
  if (!supabase) {
    console.log(`[pipeline] [dry-run] Would insert ${healEvents.length} heal event(s)`);
    return;
  }

  const { error } = await supabase.from('heal_events').insert(healEvents);
  if (error) {
    console.error(`[pipeline] ✗  Failed to insert heal events: ${error.message}`);
    throw error;
  }
  console.log(`[pipeline] ✓  Inserted ${healEvents.length} heal event(s)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runId = `run_${new Date().toISOString()}`;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Undying Scraper — Pipeline Run');
  console.log(`  Run ID: ${runId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 1. Initialise Supabase client (may be null in dry-run)
  const supabase = getSupabaseClient();

  // 2. Collect data
  console.log('[pipeline] → Running collector...');
  const rawResult = await runCollector();

  // 3. Heal-check
  console.log('[pipeline] → Running heal-check...');
  const { healthy, products, healEvents } = await checkResult(rawResult);

  // 4. Persist products (only if there are valid ones)
  if (products.length > 0) {
    console.log(`[pipeline] → Writing ${products.length} product(s) to Supabase...`);
    await writeProducts(supabase, products, runId);
  } else {
    console.log('[pipeline] ⚠  No valid products to write — skipping product insert');
  }

  // 5. Persist heal events
  if (healEvents.length > 0) {
    console.log(`[pipeline] → Writing ${healEvents.length} heal event(s) to Supabase...`);
    await writeHealEvents(supabase, healEvents);
  }

  // 6. Discord alert on heal event
  if (healEvents.length > 0) {
    console.log('[pipeline] → Sending Discord alert...');
    await sendDiscordAlert(healEvents, runId);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Run complete');
  console.log(`  Status:       ${healthy ? '✓ Healthy' : '⚠  Broken (heal event logged)'}`);
  console.log(`  Products:     ${products.length} written`);
  console.log(`  Heal events:  ${healEvents.length}`);
  console.log(`  Duration:     ${elapsed}s`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('[pipeline] ✗  Unhandled error:', err);
  process.exit(1);
});
