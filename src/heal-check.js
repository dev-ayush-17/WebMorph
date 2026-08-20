/**
 * src/heal-check.js
 *
 * Heal-detection logic for Undying Scraper.
 *
 * Given a raw collector result, determines whether it is healthy or broken.
 * On broken results, logs a "would-heal" event and returns structured event
 * objects that the pipeline script persists to Supabase.
 *
 * Currently only LOGS heal events — no real `bdata scraper heal` call is made
 * because there is no real collector yet.
 *
 * TODO(v0.2+): add actual `bdata scraper heal <COLLECTOR_ID>` call at the
 * marked location below once a real Bright Data collector exists.
 */

'use strict';

// ─── Data contract definition ─────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  { name: 'product_name', type: 'string'  },
  { name: 'price',        type: 'number'  },
  { name: 'currency',     type: 'string'  },
  { name: 'in_stock',     type: 'boolean' },
  { name: 'product_url',  type: 'string'  },
  { name: 'scraped_at',   type: 'string'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Trigger a would-heal event: log it and prepare the structured object.
 * TODO(v0.2+): call `bdata scraper heal <COLLECTOR_ID>` here once a real
 * collector exists — replace the console.warn block below with the real call.
 */
function triggerWouldHeal(description) {
  const timestamp = new Date().toISOString();

  console.warn('');
  console.warn('┌─────────────────────────────────────────────────────────┐');
  console.warn('│  🚨 WOULD-HEAL EVENT DETECTED                          │');
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn(`│  Time:  ${timestamp.padEnd(48)} │`);
  console.warn(`│  Issue: ${description.substring(0, 48).padEnd(48)} │`);
  if (description.length > 48) {
    console.warn(`│         ${description.substring(48, 96).padEnd(48)} │`);
  }
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn('│  [No real heal call — BRIGHTDATA_COLLECTOR_ID not set]  │');
  console.warn('│  TODO(v0.2+): call bdata scraper heal <COLLECTOR_ID>    │');
  console.warn('└─────────────────────────────────────────────────────────┘');
  console.warn('');

  return {
    timestamp,
    description,
    resolved: false,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * checkResult(collectorResult)
 *
 * Validates a raw collector result against the data contract.
 *
 * @param {any} collectorResult  - Raw output from runCollector()
 * @returns {{ healthy: boolean, products: Array, healEvents: Array }}
 *   - healthy:    true if all products passed validation
 *   - products:   array of valid products (empty if result was broken)
 *   - healEvents: array of { timestamp, description, resolved } objects
 *                 to be persisted to the heal_events table
 */
function checkResult(collectorResult) {
  // ── Check 1: must be an array ────────────────────────────────────────────
  if (!Array.isArray(collectorResult)) {
    const event = triggerWouldHeal(
      `Collector returned non-array (got ${typeof collectorResult})`
    );
    return { healthy: false, products: [], healEvents: [event] };
  }

  // ── Check 2: must not be empty ───────────────────────────────────────────
  if (collectorResult.length === 0) {
    const event = triggerWouldHeal(
      'Collector returned empty array — possible scraper extraction failure'
    );
    return { healthy: false, products: [], healEvents: [event] };
  }

  // ── Check 3: validate each product against the data contract ─────────────
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

    const event = triggerWouldHeal(summary);

    // If SOME items are valid, we still pass them through (partial recovery).
    // If ALL items are invalid, healthy = false.
    const healthy = validProducts.length > 0;
    if (healthy) {
      console.log(
        `[heal-check] ⚠  Partial result: ${validProducts.length}/${collectorResult.length} products are valid — passing through valid items`
      );
    }
    return { healthy, products: validProducts, healEvents: [event] };
  }

  // ── All good ─────────────────────────────────────────────────────────────
  console.log(`[heal-check] ✓  All ${collectorResult.length} products passed validation`);
  return { healthy: true, products: collectorResult, healEvents: [] };
}

module.exports = { checkResult };
