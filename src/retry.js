/**
 * src/retry.js
 *
 * Retry + exponential backoff for heal attempts.
 *
 * Used by heal-check.js to safely retry Bright Data heal calls without
 * hammering the API or spinning forever on a persistently broken source.
 *
 * DESIGN:
 *   - MAX_RETRIES: total heal attempts per pipeline run (default 2)
 *   - Delay between attempts: BASE_DELAY_MS * attempt (linear back-off —
 *     keeps it simple for hackathon scope while still spreading load)
 *   - Works identically whether the underlying fn is a real bdata call or
 *     a simulated one — it only wraps an async function
 *
 * EXPORTS:
 *   withRetry(fn, options?) -> result
 *   sleep(ms) -> Promise (exported for testing convenience)
 */

'use strict';

const MAX_RETRIES   = 2;    // maximum total attempts (1 original + 1 retry)
const BASE_DELAY_MS = 2000; // 2s between attempts in live mode

/**
 * sleep(ms)
 * Simple promise-based delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * withRetry(fn, options?)
 *
 * Run `fn` and, if it throws, retry up to `maxRetries - 1` additional times
 * with a delay between each attempt. Returns the result of the first successful
 * call, or rethrows the last error if all attempts fail.
 *
 * @param {() => Promise<any>} fn          - Async function to retry
 * @param {{ maxRetries?: number, baseDelayMs?: number, onRetry?: (attempt, err) => void, noDelay?: boolean }} [options]
 *   - maxRetries:   max total attempts (default: MAX_RETRIES = 2)
 *   - baseDelayMs:  ms × attempt before each retry (default: BASE_DELAY_MS = 2000)
 *   - onRetry:      callback fired before each retry (useful for logging)
 *   - noDelay:      skip delay entirely (used in unit tests for speed)
 * @returns {Promise<any>}
 * @throws The last error if all attempts are exhausted
 */
async function withRetry(fn, options = {}) {
  const maxRetries   = options.maxRetries   ?? MAX_RETRIES;
  const baseDelayMs  = options.baseDelayMs  ?? BASE_DELAY_MS;
  const onRetry      = options.onRetry      ?? null;
  const noDelay      = options.noDelay      ?? false;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries) {
        const delayMs = noDelay ? 0 : baseDelayMs * attempt;

        if (onRetry) {
          onRetry(attempt, err);
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }
  }

  throw lastError;
}

module.exports = { withRetry, sleep, MAX_RETRIES, BASE_DELAY_MS };
