/**
 * src/heal-check.js  (v0.2 — real heal-trigger integration)
 *
 * Heal-detection and heal-trigger logic for Undying Scraper.
 *
 * WHAT CHANGED FROM v0.1:
 *   Previously: only logged a "would-heal" event in all cases.
 *   Now:
 *     - MOCK mode  → preserves the old "would-heal" simulation exactly (v0.1 regression safety)
 *     - LIVE mode  → actually calls healCollector() from the Bright Data wrapper,
 *                    then retries the run once after healing
 *
 * EXPORTS:
 *   checkResult(collectorResult, options?) -> { healthy, products, healEvents }
 *     options._runCollector  — injectable for testing (avoids real re-run)
 *     options._healCollector — injectable for testing (avoids real heal call)
 *
 * DEPENDENCIES:
 *   src/brightdata/collector-registry.js (feat/collector-lifecycle-management PR)
 *   src/brightdata/client.js             (feat/brightdata-cli-wrapper PR)
 */

'use strict';

const registry = require('./brightdata/collector-registry');
const bdataClient = require('./brightdata/client');
const {
  BrightDataError,
  ScrapeReturnedEmptyError,
} = require('./brightdata/errors');

// ─── Data contract definition (unchanged from v0.1) ───────────────────────────

const REQUIRED_FIELDS = [
  { name: 'product_name', type: 'string'  },
  { name: 'price',        type: 'number'  },
  { name: 'currency',     type: 'string'  },
  { name: 'in_stock',     type: 'boolean' },
  { name: 'product_url',  type: 'string'  },
  { name: 'scraped_at',   type: 'string'  },
];

// ─── Helpers (unchanged from v0.1) ────────────────────────────────────────────

/**
 * Validate a single product object against the data contract.
 * Returns an array of human-readable issue strings (empty = valid).
 */
function validateProduct(product, index) {
  const issues = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field.name in product)) {
      issues.push(`item[${index}]: missing field '${field.name}'`);
    } else if (typeof product[field.name] !== field.type) {
      issues.push(
        `item[${index}]: field '${field.name}' expected ${field.type}, ` +
        `got ${typeof product[field.name]} (value: ${JSON.stringify(product[field.name])})`
      );
    }
  }
  return issues;
}

// ─── Mock-mode "would-heal" (unchanged from v0.1) ────────────────────────────

/**
 * Trigger a would-heal event in mock mode.
 * This is IDENTICAL to v0.1 — preserved for regression safety.
 * Does NOT make any real bdata call.
 */
function triggerWouldHeal(description) {
  const timestamp = new Date().toISOString();

  console.warn('');
  console.warn('┌─────────────────────────────────────────────────────────┐');
  console.warn('│  🚨 WOULD-HEAL EVENT DETECTED (mock mode)              │');
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn(`│  Time:  ${timestamp.padEnd(48)} │`);
  console.warn(`│  Issue: ${description.substring(0, 48).padEnd(48)} │`);
  if (description.length > 48) {
    console.warn(`│         ${description.substring(48, 96).padEnd(48)} │`);
  }
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn('│  [No real heal call — running in mock mode]             │');
  console.warn('│  Set BRIGHTDATA_COLLECTOR_ID + TARGET_URL for live mode │');
  console.warn('└─────────────────────────────────────────────────────────┘');
  console.warn('');

  return { timestamp, description, resolved: false };
}

// ─── Live-mode real heal trigger ──────────────────────────────────────────────

/**
 * Trigger a real heal via the Bright Data CLI in live mode.
 *
 * Flow:
 *   1. Call healCollector(id, whatBroke)
 *   2. Wait for it to complete (or fail gracefully)
 *   3. Retry runCollector() once after healing
 *   4. Validate the retry result
 *
 * @param {string} description        - Human-readable description of what broke
 * @param {{ _runCollector?: Function, _healCollector?: Function }} [overrides]
 *   Injectable overrides for testing — avoids real CLI calls in unit tests.
 * @returns {Promise<{ healEvent: object, retryProducts: Array }>}
 */
async function triggerRealHeal(description, overrides = {}) {
  const timestamp = new Date().toISOString();
  const collectorId = registry.getCollectorId();
  const targetUrl   = registry.getTargetUrl();

  // Resolve the functions — use injected overrides in tests, real ones in prod
  const healFn = overrides._healCollector ?? bdataClient.healCollector;
  const runFn  = overrides._runCollector  ?? bdataClient.runCollector;

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  🔧 HEAL EVENT — TRIGGERING REAL BRIGHT DATA HEAL      │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│  Collector : ${collectorId.padEnd(44)} │`);
  console.log(`│  Time      : ${timestamp.padEnd(44)} │`);
  console.log(`│  Issue     : ${description.substring(0, 44).padEnd(44)} │`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // ── Step 1: Trigger the heal ────────────────────────────────────────────────
  let healSucceeded = false;
  let healError = null;

  try {
    await healFn(collectorId, description);
    healSucceeded = true;
    console.log('[heal-check] ✓  Heal triggered successfully');
  } catch (err) {
    healError = err;
    const errType = err instanceof BrightDataError ? err.name : 'Error';
    console.error(`[heal-check] ✗  Heal call failed (${errType}): ${err.message}`);
  }

  // ── Step 2: Retry the run (only if heal succeeded) ──────────────────────────
  let retryProducts = [];

  if (healSucceeded) {
    console.log('[heal-check] → Retrying collector run after heal...');
    try {
      const retryResult = await runFn(collectorId, targetUrl);
      // Validate the retry result using the same validation logic
      const validItems = [];
      for (let i = 0; i < retryResult.length; i++) {
        if (validateProduct(retryResult[i], i).length === 0) {
          validItems.push(retryResult[i]);
        }
      }
      retryProducts = validItems;
      console.log(`[heal-check] ✓  Retry returned ${retryProducts.length} valid products`);
    } catch (retryErr) {
      // ScrapeReturnedEmptyError and others — log but don't crash
      const errType = retryErr instanceof BrightDataError ? retryErr.name : 'Error';
      console.error(`[heal-check] ✗  Retry after heal also failed (${errType}): ${retryErr.message}`);
    }
  }

  // ── Step 3: Build the heal event object for Supabase ────────────────────────
  const healEvent = {
    timestamp,
    description: healError
      ? `${description} | Heal failed: ${healError.message}`
      : description,
    resolved: retryProducts.length > 0,  // resolved only if retry produced valid data
  };

  return { healEvent, retryProducts };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * checkResult(collectorResult, options?)
 *
 * Validates a raw collector result against the data contract.
 * In live mode, triggers a real Bright Data heal and one retry on failure.
 * In mock mode, preserves v0.1 "would-heal" simulation exactly.
 *
 * @param {any}    collectorResult - Raw output from runCollector()
 * @param {{ _runCollector?: Function, _healCollector?: Function }} [options]
 *   Injected overrides for unit tests (avoids real CLI calls).
 * @returns {Promise<{ healthy: boolean, products: Array, healEvents: Array }>}
 *   - healthy:    true if all (or retried) products passed validation
 *   - products:   array of valid products
 *   - healEvents: array of { timestamp, description, resolved } for Supabase
 */
async function checkResult(collectorResult, options = {}) {
  const live = registry.isLive();

  // ── Check 1: must be an array ─────────────────────────────────────────────
  if (!Array.isArray(collectorResult)) {
    const description = `Collector returned non-array (got ${typeof collectorResult})`;
    if (!live) {
      const event = triggerWouldHeal(description);
      return { healthy: false, products: [], healEvents: [event] };
    }
    const { healEvent, retryProducts } = await triggerRealHeal(description, options);
    return {
      healthy: retryProducts.length > 0,
      products: retryProducts,
      healEvents: [healEvent],
    };
  }

  // ── Check 2: must not be empty ────────────────────────────────────────────
  if (collectorResult.length === 0) {
    const description = 'Collector returned empty array — possible scraper extraction failure';
    if (!live) {
      const event = triggerWouldHeal(description);
      return { healthy: false, products: [], healEvents: [event] };
    }
    const { healEvent, retryProducts } = await triggerRealHeal(description, options);
    return {
      healthy: retryProducts.length > 0,
      products: retryProducts,
      healEvents: [healEvent],
    };
  }

  // ── Check 3: validate each product against the data contract ──────────────
  const allIssues = [];
  const validProducts = [];

  for (let i = 0; i < collectorResult.length; i++) {
    const issues = validateProduct(collectorResult[i], i);
    if (issues.length > 0) {
      allIssues.push(...issues);
    } else {
      validProducts.push(collectorResult[i]);
    }
  }

  if (allIssues.length > 0) {
    const summary =
      `${allIssues.length} validation error(s) across ${collectorResult.length} items: ` +
      allIssues.slice(0, 3).join('; ') +
      (allIssues.length > 3 ? ` ... and ${allIssues.length - 3} more` : '');

    if (!live) {
      // Mock mode: v0.1 behavior exactly — pass through valid items, log would-heal
      const event = triggerWouldHeal(summary);
      const healthy = validProducts.length > 0;
      if (healthy) {
        console.log(
          `[heal-check] ⚠  Partial result: ${validProducts.length}/${collectorResult.length} products are valid — passing through valid items`
        );
      }
      return { healthy, products: validProducts, healEvents: [event] };
    }

    // Live mode: heal + retry
    const { healEvent, retryProducts } = await triggerRealHeal(summary, options);

    // Merge: valid items from original run + any valid items from retry
    const allValid = [...new Map(
      [...validProducts, ...retryProducts].map((p) => [p.product_url, p])
    ).values()];

    console.log(
      `[heal-check] ⚠  Partial result: ${validProducts.length} valid from original + ` +
      `${retryProducts.length} from retry = ${allValid.length} total`
    );

    return {
      healthy: allValid.length > 0,
      products: allValid,
      healEvents: [healEvent],
    };
  }

  // ── All good ──────────────────────────────────────────────────────────────
  console.log(`[heal-check] ✓  All ${collectorResult.length} products passed validation`);
  return { healthy: true, products: collectorResult, healEvents: [] };
}

module.exports = { checkResult };
