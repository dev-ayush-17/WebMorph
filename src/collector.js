/**
 * src/collector.js
 *
 * Swappable collector abstraction.
 *
 * Exports a single async function `runCollector()` that returns an array of
 * product objects matching the data contract:
 *   { product_name, price, currency, in_stock, product_url, scraped_at }
 *
 * TODAY (v0.1): delegates to the mock data source.
 *
 * TO UPGRADE (v0.2+): replace the body of runCollector() — and ONLY that body —
 * with a real Bright Data Scraper Studio call. Nothing that calls runCollector()
 * needs to change.
 */

'use strict';

const { generateMockProducts } = require('./sources/mock-source');

/**
 * runCollector()
 *
 * Runs the configured data source and returns an array of product objects.
 * Callers should not depend on where the data comes from — only on its shape.
 *
 * @returns {Promise<Array<Object>>}
 */
async function runCollector() {
  // ─────────────────────────────────────────────────────────────────────────
  // TODO(v0.2+): replace this mock with a real Bright Data Scraper Studio call.
  //
  // Example replacement (requires `bdata` CLI installed in the runner env):
  //
  //   const { execSync } = require('child_process');
  //   const collectorId = process.env.BRIGHTDATA_COLLECTOR_ID;
  //   const targetUrl   = process.env.TARGET_URL; // add to .env.example too
  //   if (!collectorId) throw new Error('BRIGHTDATA_COLLECTOR_ID not set');
  //
  //   const raw = execSync(
  //     `bdata scraper run ${collectorId} "${targetUrl}" --pretty`,
  //     { timeout: 120_000 }
  //   ).toString();
  //
  //   return JSON.parse(raw);
  //
  // The returned array must match the data contract exactly.
  // ─────────────────────────────────────────────────────────────────────────

  return generateMockProducts();
}

module.exports = { runCollector };
