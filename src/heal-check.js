/**
 * src/heal-check.js  (v0.3 — richer heal events, retry/backoff, typed errors)
 *
 * WHAT CHANGED FROM v0.2:
 *   - heal events now carry: attempt_number, heal_method, error_type, duration_ms
 *   - live-mode heal uses withRetry() — up to MAX_RETRIES attempts with backoff
 *   - error_type is derived from the BrightDataError class hierarchy
 *   - validateProduct() and all mock-mode "would-heal" paths are UNCHANGED
 *
 * EXPORTS:
 *   checkResult(collectorResult, options?) -> Promise<{ healthy, products, healEvents }>
 *     options._runCollector  — injectable for testing
 *     options._healCollector — injectable for testing
 *     options._noDelay       — skip retry delays in tests
 */

'use strict';

const registry = require('./brightdata/collector-registry');
const bdataClient = require('./brightdata/client');
const {
  BrightDataError,
  CliNotAuthenticatedError,
  CollectorNotFoundError,
  ScrapeReturnedEmptyError,
} = require('./brightdata/errors');
const { withRetry, MAX_RETRIES } = require('./retry');

// ─── Data contract definition (unchanged) ─────────────────────────────────────

const REQUIRED_FIELDS = [
  { name: 'product_name', type: 'string'  },
  { name: 'price',        type: 'number'  },
  { name: 'currency',     type: 'string'  },
  { name: 'in_stock',     type: 'boolean' },
  { name: 'product_url',  type: 'string'  },
  { name: 'scraped_at',   type: 'string'  },
];

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Derive the error_type string from a BrightDataError (or any error).
 * Matches the values documented in supabase/schema.sql.
 */
function classifyErrorType(description) {
  const d = description.toLowerCase();
  if (d.includes('empty array'))      return 'empty_result';
  if (d.includes('missing field'))    return 'missing_fields';
  if (d.includes('validation error')) return 'missing_fields';
  if (d.includes('expected') && d.includes('got')) return 'type_mismatch';
  return 'unknown';
}

function classifyErrorTypeFromException(err) {
  if (err instanceof ScrapeReturnedEmptyError)  return 'empty_result';
  if (err instanceof CliNotAuthenticatedError)  return 'cli_auth';
  if (err instanceof CollectorNotFoundError)    return 'collector_gone';
  if (err instanceof BrightDataError)           return 'unknown';
  return 'unknown';
}

// ─── Validation helper (unchanged) ───────────────────────────────────────────

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

// ─── Mock-mode "would-heal" (v0.1/v0.2 compatible) ───────────────────────────

/**
 * Build a rich heal event for mock mode.
 * Renders the same ASCII box as before, and now returns the extended object.
 */
function triggerWouldHeal(description, attemptNumber = 1) {
  const timestamp = new Date().toISOString();
  const errorType = classifyErrorType(description);

  console.warn('');
  console.warn('┌─────────────────────────────────────────────────────────┐');
  console.warn('│  🚨 WOULD-HEAL EVENT DETECTED (mock mode)              │');
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn(`│  Time:    ${timestamp.padEnd(46)} │`);
  console.warn(`│  Attempt: ${String(attemptNumber).padEnd(46)} │`);
  console.warn(`│  Type:    ${errorType.padEnd(46)} │`);
  console.warn(`│  Issue:   ${description.substring(0, 46).padEnd(46)} │`);
  if (description.length > 46) {
    console.warn(`│           ${description.substring(46, 92).padEnd(46)} │`);
  }
  console.warn('├─────────────────────────────────────────────────────────┤');
  console.warn('│  [No real heal call — running in mock mode]             │');
  console.warn('│  Set BRIGHTDATA_COLLECTOR_ID + TARGET_URL for live mode │');
  console.warn('└─────────────────────────────────────────────────────────┘');
  console.warn('');

  return {
    timestamp,
    description,
    resolved:       false,
    attempt_number: attemptNumber,
    heal_method:    'simulated',
    error_type:     errorType,
    duration_ms:    0,
  };
}

// ─── Live-mode real heal trigger (with retry) ─────────────────────────────────

/**
 * triggerRealHeal(description, errorType, options)
 *
 * Calls healCollector() with retry/backoff. On each attempt, records timing.
 * Returns the final heal event object (resolved or not) plus any retried products.
 */
async function triggerRealHeal(description, errorType, options = {}) {
  const collectorId = registry.getCollectorId();
  const targetUrl   = registry.getTargetUrl();
  const healFn = options._healCollector ?? bdataClient.healCollector;
  const runFn  = options._runCollector  ?? bdataClient.runCollector;
  const noDelay = options._noDelay ?? false;

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  🔧 HEAL EVENT — TRIGGERING REAL BRIGHT DATA HEAL      │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│  Collector : ${collectorId.padEnd(44)} │`);
  console.log(`│  Error     : ${errorType.padEnd(44)} │`);
  console.log(`│  Max tries : ${String(MAX_RETRIES).padEnd(44)} │`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  const runStartMs = Date.now();
  let lastAttemptNumber = 1;
  let lastError = null;
  let healSucceeded = false;

  try {
    await withRetry(
      async (attempt) => {
        lastAttemptNumber = attempt;
        const attemptStartMs = Date.now();
        console.log(`[heal-check] → Heal attempt ${attempt}/${MAX_RETRIES}...`);
        try {
          await healFn(collectorId, description);
          const ms = Date.now() - attemptStartMs;
          console.log(`[heal-check] ✓  Heal attempt ${attempt} succeeded (${ms}ms)`);
        } catch (err) {
          const ms = Date.now() - attemptStartMs;
          console.error(`[heal-check] ✗  Heal attempt ${attempt} failed (${ms}ms): ${err.message}`);
          throw err;
        }
      },
      {
        maxRetries: MAX_RETRIES,
        noDelay,
        onRetry: (attempt, err) => {
          console.log(`[heal-check]    Retrying heal (attempt ${attempt + 1} of ${MAX_RETRIES})...`);
        },
      }
    );
    healSucceeded = true;
  } catch (err) {
    lastError = err;
    const derivedType = classifyErrorTypeFromException(err);
    console.error(`[heal-check] ✗  All ${MAX_RETRIES} heal attempt(s) exhausted. Last error: ${err.message}`);
    // If it's a CLI auth error, no point retrying — log clearly
    if (err instanceof CliNotAuthenticatedError) {
      console.error('[heal-check]    Authentication failure — human intervention required (bdata login)');
    }
  }

  // Retry the scrape run after successful heal
  let retryProducts = [];
  if (healSucceeded) {
    console.log('[heal-check] → Retrying collector run after heal...');
    try {
      const retryResult = await runFn(collectorId, targetUrl);
      for (let i = 0; i < retryResult.length; i++) {
        if (validateProduct(retryResult[i], i).length === 0) {
          retryProducts.push(retryResult[i]);
        }
      }
      console.log(`[heal-check] ✓  Retry returned ${retryProducts.length} valid products`);
    } catch (retryErr) {
      console.error(`[heal-check] ✗  Retry run after heal also failed: ${retryErr.message}`);
    }
  }

  const totalDurationMs = Date.now() - runStartMs;

  const healEvent = {
    timestamp:      new Date().toISOString(),
    description:    lastError
      ? `${description} | All heal attempts failed: ${lastError.message}`
      : description,
    resolved:       retryProducts.length > 0,
    attempt_number: lastAttemptNumber,
    heal_method:    'real',
    error_type:     lastError ? classifyErrorTypeFromException(lastError) : errorType,
    duration_ms:    totalDurationMs,
  };

  return { healEvent, retryProducts };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * checkResult(collectorResult, options?)
 *
 * Validates a raw collector result. Routes to mock or real heal path.
 *
 * @param {any} collectorResult
 * @param {{ _runCollector?, _healCollector?, _noDelay? }} [options]
 * @returns {Promise<{ healthy: boolean, products: Array, healEvents: Array }>}
 */
async function checkResult(collectorResult, options = {}) {
  const live = registry.isLive();

  // ── Non-array ─────────────────────────────────────────────────────────────
  if (!Array.isArray(collectorResult)) {
    const description = `Collector returned non-array (got ${typeof collectorResult})`;
    if (!live) {
      return { healthy: false, products: [], healEvents: [triggerWouldHeal(description)] };
    }
    const { healEvent, retryProducts } = await triggerRealHeal(description, 'unknown', options);
    return { healthy: retryProducts.length > 0, products: retryProducts, healEvents: [healEvent] };
  }

  // ── Empty array ───────────────────────────────────────────────────────────
  if (collectorResult.length === 0) {
    const description = 'Collector returned empty array — possible scraper extraction failure';
    if (!live) {
      return { healthy: false, products: [], healEvents: [triggerWouldHeal(description)] };
    }
    const { healEvent, retryProducts } = await triggerRealHeal(description, 'empty_result', options);
    return { healthy: retryProducts.length > 0, products: retryProducts, healEvents: [healEvent] };
  }

  // ── Field validation ──────────────────────────────────────────────────────
  const allIssues   = [];
  const validProducts = [];

  for (let i = 0; i < collectorResult.length; i++) {
    const issues = validateProduct(collectorResult[i], i);
    if (issues.length > 0) allIssues.push(...issues);
    else validProducts.push(collectorResult[i]);
  }

  if (allIssues.length > 0) {
    const summary =
      `${allIssues.length} validation error(s) across ${collectorResult.length} items: ` +
      allIssues.slice(0, 3).join('; ') +
      (allIssues.length > 3 ? ` ... and ${allIssues.length - 3} more` : '');

    const errorType = summary.toLowerCase().includes('missing field') ? 'missing_fields' : 'type_mismatch';

    if (!live) {
      const event = triggerWouldHeal(summary);
      const healthy = validProducts.length > 0;
      if (healthy) {
        console.log(
          `[heal-check] ⚠  Partial result: ${validProducts.length}/${collectorResult.length} ` +
          `products valid — passing through valid items`
        );
      }
      return { healthy, products: validProducts, healEvents: [event] };
    }

    const { healEvent, retryProducts } = await triggerRealHeal(summary, errorType, options);
    const allValid = [...new Map(
      [...validProducts, ...retryProducts].map((p) => [p.product_url, p])
    ).values()];

    console.log(
      `[heal-check] ⚠  Partial: ${validProducts.length} from original + ` +
      `${retryProducts.length} from retry = ${allValid.length} total`
    );

    return { healthy: allValid.length > 0, products: allValid, healEvents: [healEvent] };
  }

  // ── All good ──────────────────────────────────────────────────────────────
  console.log(`[heal-check] ✓  All ${collectorResult.length} products passed validation`);
  return { healthy: true, products: collectorResult, healEvents: [] };
}

module.exports = { checkResult };
