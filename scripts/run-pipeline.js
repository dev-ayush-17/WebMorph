/**
 * scripts/run-pipeline.js  (v0.3)
 *
 * Main orchestration entry point for Undying Scraper.
 *
 * v0.3 additions:
 *   - Fetches prior snapshots from Supabase before writing, for price/stock diff
 *   - Enriches products with diff metadata via src/diff.js
 *   - Writes a row to the `runs` table with a structured summary JSON
 *   - Prints a richer structured summary to console (diff breakdown, heal details)
 *   - All Supabase calls degrade gracefully to dry-run when credentials are absent
 *
 * Flow:
 *   1. Open run record in `runs` table (status: 'running')
 *   2. Run collector
 *   3. Heal-check (with retry if live)
 *   4. Fetch prior snapshots for diff
 *   5. Enrich products with diff metadata
 *   6. Write products + heal events to Supabase
 *   7. Close run record (status: 'healthy' / 'degraded' / 'failed')
 *   8. Send Discord alert if heal event fired
 *   9. Print structured console summary
 */

'use strict';

require('dotenv').config();

const { createClient }       = require('@supabase/supabase-js');
const { runCollector }       = require('../src/collector');
const { checkResult }        = require('../src/heal-check');
const { diffProducts, buildDiffSummary } = require('../src/diff');

// ─── Configuration ────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DISCORD_WEBHOOK   = process.env.DISCORD_WEBHOOK_URL;

// ─── Supabase client ──────────────────────────────────────────────────────────

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

async function sendDiscordAlert(healEvents, runId, diffSummary) {
  if (!DISCORD_WEBHOOK) {
    console.log(
      '[discord] ℹ  DISCORD_WEBHOOK_URL not set — would have sent alert for ' +
      `${healEvents.length} heal event(s). Set the variable to enable alerts.`
    );
    return;
  }

  const embeds = healEvents.map((evt, i) => ({
    title: `🚨 Heal Event #${i + 1} — ${evt.resolved ? 'RESOLVED' : 'UNRESOLVED'}`,
    description: evt.description,
    color: evt.resolved ? 0x27ae60 : 0xe74c3c, // green if resolved, red if not
    fields: [
      { name: 'Run ID',       value: runId,                    inline: true  },
      { name: 'Error Type',   value: evt.error_type,           inline: true  },
      { name: 'Method',       value: evt.heal_method,          inline: true  },
      { name: 'Attempt #',    value: String(evt.attempt_number), inline: true },
      { name: 'Duration',     value: `${evt.duration_ms ?? 0}ms`, inline: true },
      { name: 'Time',         value: evt.timestamp,            inline: false },
    ],
    footer: { text: 'Undying Scraper — self-healing pipeline' },
  }));

  const payload = {
    username:   'Undying Scraper',
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
    console.error(`[discord] ✗  Webhook error (non-fatal): ${err.message}`);
  }
}

// ─── Supabase write helpers ───────────────────────────────────────────────────

/**
 * Open a run record with status='running'.
 * Returns a close function to call when the run finishes.
 */
async function openRunRecord(supabase, runId, startedAt) {
  if (!supabase) {
    console.log(`[pipeline] [dry-run] Would open run record: ${runId}`);
    return async (summary, status) => {
      console.log(`[pipeline] [dry-run] Would close run record: status=${status}`);
      console.log(`[pipeline] [dry-run] Summary: ${JSON.stringify(summary, null, 2)}`);
    };
  }

  const { error } = await supabase.from('runs').insert({
    run_id:     runId,
    started_at: startedAt,
    status:     'running',
  });

  if (error) {
    // Non-fatal — run record is cosmetic; don't crash the pipeline
    console.warn(`[pipeline] ⚠  Could not open run record (non-fatal): ${error.message}`);
  }

  return async (summary, status) => {
    const { error: closeErr } = await supabase
      .from('runs')
      .update({ finished_at: new Date().toISOString(), status, summary_json: summary })
      .eq('run_id', runId);

    if (closeErr) {
      console.warn(`[pipeline] ⚠  Could not close run record (non-fatal): ${closeErr.message}`);
    } else {
      console.log(`[pipeline] ✓  Run record closed: status=${status}`);
    }
  };
}

/**
 * Fetch the most recent product snapshot for each URL we're about to write.
 * Returns a Map<product_url, { price, in_stock }>.
 */
async function fetchPriorSnapshots(supabase, productUrls) {
  if (!supabase || productUrls.length === 0) {
    return new Map(); // dry-run or nothing to compare
  }

  try {
    // Get the single most-recent row for each URL efficiently
    const { data, error } = await supabase
      .from('products')
      .select('product_url, price, in_stock, scraped_at')
      .in('product_url', productUrls)
      .order('scraped_at', { ascending: false });

    if (error) {
      console.warn(`[pipeline] ⚠  Could not fetch prior snapshots (non-fatal): ${error.message}`);
      return new Map();
    }

    // Keep only the most-recent row per URL
    const map = new Map();
    for (const row of (data ?? [])) {
      if (!map.has(row.product_url)) {
        map.set(row.product_url, { price: Number(row.price), in_stock: row.in_stock });
      }
    }

    console.log(`[pipeline] ✓  Fetched prior snapshots for ${map.size} URL(s)`);
    return map;
  } catch (err) {
    console.warn(`[pipeline] ⚠  Prior snapshot fetch crashed (non-fatal): ${err.message}`);
    return new Map();
  }
}

async function writeProducts(supabase, products, runId) {
  if (!supabase) {
    console.log(`[pipeline] [dry-run] Would insert ${products.length} products with run_id=${runId}`);
    // In dry-run, still show what diff data would look like
    const changed = products.filter((p) => p.price_changed || p.stock_changed);
    if (changed.length > 0) {
      console.log(`[pipeline] [dry-run]   ↳ ${changed.length} product(s) have price/stock changes`);
    }
    return;
  }

  const rows = products.map((p) => ({
    run_id:         runId,
    product_name:   p.product_name,
    price:          p.price,
    currency:       p.currency,
    in_stock:       p.in_stock,
    product_url:    p.product_url,
    scraped_at:     p.scraped_at,
    price_changed:  p.price_changed  ?? false,
    stock_changed:  p.stock_changed  ?? false,
    previous_price: p.previous_price ?? null,
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
    console.log(`[pipeline] [dry-run] Would insert ${healEvents.length} heal event(s):`);
    for (const evt of healEvents) {
      console.log(
        `[pipeline] [dry-run]   attempt=${evt.attempt_number} ` +
        `method=${evt.heal_method} type=${evt.error_type} ` +
        `resolved=${evt.resolved} duration=${evt.duration_ms ?? 0}ms`
      );
    }
    return;
  }

  const rows = healEvents.map((evt) => ({
    timestamp:      evt.timestamp,
    description:    evt.description,
    resolved:       evt.resolved,
    attempt_number: evt.attempt_number ?? 1,
    heal_method:    evt.heal_method    ?? 'simulated',
    error_type:     evt.error_type     ?? 'unknown',
    duration_ms:    evt.duration_ms    ?? null,
  }));

  const { error } = await supabase.from('heal_events').insert(rows);
  if (error) {
    console.error(`[pipeline] ✗  Failed to insert heal events: ${error.message}`);
    throw error;
  }
  console.log(`[pipeline] ✓  Inserted ${healEvents.length} heal event(s)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();
  const runId     = `run_${startedAt}`;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Undying Scraper — Pipeline Run');
  console.log(`  Run ID: ${runId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 0. Initialise Supabase (null = dry-run)
  const supabase = getSupabaseClient();

  // 1. Open run record
  const closeRun = await openRunRecord(supabase, runId, startedAt);

  let products   = [];
  let healEvents = [];
  let healthy    = false;
  let diffSummary = { priceIncreases: 0, priceDecreases: 0, stockFlips: 0, newProducts: 0 };

  try {
    // 2. Collect data
    console.log('[pipeline] → Running collector...');
    const rawResult = await runCollector();

    // 3. Heal-check (may trigger real heal + retry in live mode)
    console.log('[pipeline] → Running heal-check...');
    ({ healthy, products, healEvents } = await checkResult(rawResult));

    // 4. Fetch prior snapshots for diff (graceful no-op in dry-run)
    if (products.length > 0) {
      console.log('[pipeline] → Fetching prior snapshots for diff...');
      const productUrls    = products.map((p) => p.product_url);
      const priorSnapshots = await fetchPriorSnapshots(supabase, productUrls);

      // 5. Enrich products with diff metadata
      products = diffProducts(products, priorSnapshots);
      diffSummary = buildDiffSummary(products);

      console.log(
        `[pipeline] ✓  Diff: +${diffSummary.priceIncreases} price↑  ` +
        `-${diffSummary.priceDecreases} price↓  ` +
        `${diffSummary.stockFlips} stock flip(s)  ` +
        `${diffSummary.newProducts} new product(s)`
      );
    }

    // 6. Persist products
    if (products.length > 0) {
      console.log(`[pipeline] → Writing ${products.length} product(s) to Supabase...`);
      await writeProducts(supabase, products, runId);
    } else {
      console.log('[pipeline] ⚠  No valid products to write');
    }

    // 7. Persist heal events
    if (healEvents.length > 0) {
      console.log(`[pipeline] → Writing ${healEvents.length} heal event(s) to Supabase...`);
      await writeHealEvents(supabase, healEvents);
    }

  } catch (err) {
    console.error(`[pipeline] ✗  Pipeline error: ${err.message}`);
    healthy = false;
  }

  // 8. Determine run status
  const resolvedHeals   = healEvents.filter((e) => e.resolved).length;
  const unresolvedHeals = healEvents.filter((e) => !e.resolved).length;
  const runStatus =
    products.length === 0   ? 'failed'
    : healEvents.length > 0 ? 'degraded'
    : 'healthy';

  // 9. Build structured summary
  const finishedAt   = new Date().toISOString();
  const durationMs   = Date.now() - startMs;

  const runSummary = {
    run_id:             runId,
    started_at:         startedAt,
    finished_at:        finishedAt,
    status:             runStatus,
    products_found:     products.length,
    price_increases:    diffSummary.priceIncreases,
    price_decreases:    diffSummary.priceDecreases,
    stock_flips:        diffSummary.stockFlips,
    new_products:       diffSummary.newProducts,
    heal_events_total:  healEvents.length,
    heal_events_resolved:   resolvedHeals,
    heal_events_unresolved: unresolvedHeals,
    duration_ms:        durationMs,
  };

  // 10. Close run record with summary
  await closeRun(runSummary, runStatus);

  // 11. Discord alert
  if (healEvents.length > 0) {
    console.log('[pipeline] → Sending Discord alert...');
    await sendDiscordAlert(healEvents, runId, diffSummary);
  }

  // 12. Print structured console summary
  const elapsed = (durationMs / 1000).toFixed(2);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Run complete');
  console.log(`  Status:         ${runStatus === 'healthy' ? '✓ Healthy' : runStatus === 'degraded' ? '⚠  Degraded (healed)' : '✗ Failed'}`);
  console.log(`  Products:       ${products.length} written`);
  console.log(`  Price changes:  ↑${diffSummary.priceIncreases}  ↓${diffSummary.priceDecreases}  (${diffSummary.newProducts} new)`);
  console.log(`  Stock flips:    ${diffSummary.stockFlips}`);
  console.log(`  Heal events:    ${healEvents.length} (${resolvedHeals} resolved, ${unresolvedHeals} unresolved)`);
  console.log(`  Duration:       ${elapsed}s`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('[pipeline] ✗  Unhandled error:', err);
  process.exit(1);
});
