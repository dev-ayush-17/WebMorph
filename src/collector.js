/**
 * src/collector.js  (v0.2 — refactored swap point)
 *
 * Swappable collector abstraction.
 *
 * This file is the ONLY entry point for data collection across the entire
 * pipeline. It delegates to one of two sources based on the collector registry:
 *
 *   LIVE mode  (BRIGHTDATA_COLLECTOR_ID + TARGET_URL both set in env)
 *     → calls src/brightdata/client.js::runCollector() — real Bright Data CLI
 *
 *   MOCK mode  (either env var missing)
 *     → calls src/sources/mock-source.js::generateMockProducts() — unchanged from v0.1
 *
 * To switch from mock to live: set two env vars. Zero code changes required.
 *
 * DEPENDENCY NOTE:
 *   This file requires src/brightdata/collector-registry.js and
 *   src/brightdata/client.js, which are added in the feat/collector-lifecycle-management
 *   and feat/brightdata-cli-wrapper PRs respectively. This branch should be
 *   merged AFTER those two PRs are merged into main.
 */

'use strict';

const registry = require('./brightdata/collector-registry');
const { generateMockProducts } = require('./sources/mock-source');

// Import the real Bright Data wrapper lazily — only actually called in live mode,
// but we require() it here at module load to catch missing-file errors early.
const bdataClient = require('./brightdata/client');

/**
 * runCollector()
 *
 * Runs the configured data source and returns an array of product objects
 * matching the data contract:
 *   { product_name, price, currency, in_stock, product_url, scraped_at }
 *
 * The caller never needs to know whether the data came from mock or real.
 *
 * @returns {Promise<Array<Object>>}
 * @throws {import('./brightdata/errors').BrightDataError} — in live mode only
 */
async function runCollector() {
  if (registry.isLive()) {
    // ── LIVE PATH ─────────────────────────────────────────────────────────────
    // Uses the real Bright Data CLI wrapper.
    // collectorId and targetUrl are guaranteed non-null when isLive() is true.
    const collectorId = registry.getCollectorId();
    const targetUrl = registry.getTargetUrl();

    console.log(`[collector] Mode: LIVE — running Bright Data collector ${collectorId}`);

    // bdataClient.runCollector() throws typed BrightDataErrors on failure;
    // heal-check.js catches these and routes to the appropriate heal strategy.
    return bdataClient.runCollector(collectorId, targetUrl);
  }

  // ── MOCK PATH ───────────────────────────────────────────────────────────────
  // Registry already logged which env vars are missing when it initialised.
  console.log('[collector] Mode: MOCK — using mock data source');
  return generateMockProducts();
}

module.exports = { runCollector };
