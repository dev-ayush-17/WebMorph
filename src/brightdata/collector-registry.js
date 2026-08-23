/**
 * src/brightdata/collector-registry.js
 *
 * Collector Registry — single source of truth for "are we live or in mock mode?"
 *
 * DESIGN INTENT:
 *   This is the ONLY file that reads BRIGHTDATA_COLLECTOR_ID from the environment.
 *   No other file should independently check whether a collector is configured.
 *   All mode-switching logic flows through getCollectorMode() and getCollectorId().
 *
 * MODES:
 *   'live'  — BRIGHTDATA_COLLECTOR_ID and TARGET_URL are both set; real scraping active
 *   'mock'  — one or both are missing; falls back to mock-source.js automatically
 *
 * USAGE:
 *   const registry = require('./collector-registry');
 *
 *   if (registry.isLive()) {
 *     // use real Bright Data wrapper
 *     const id = registry.getCollectorId();
 *     const url = registry.getTargetUrl();
 *   } else {
 *     // use mock data source
 *   }
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODE = Object.freeze({ LIVE: 'live', MOCK: 'mock' });

// ─── Internal state (read once on first import, cached) ───────────────────────

let _mode = null;
let _collectorId = null;
let _targetUrl = null;

/**
 * Initialise the registry from environment variables.
 * Called lazily on first access — safe to call multiple times.
 */
function _init() {
  if (_mode !== null) return; // already initialised

  _collectorId = process.env.BRIGHTDATA_COLLECTOR_ID ?? null;
  _targetUrl = process.env.TARGET_URL ?? null;

  const bothSet = Boolean(_collectorId && _targetUrl);

  if (bothSet) {
    _mode = MODE.LIVE;
    console.log(`[collector-registry] Mode: LIVE`);
    console.log(`[collector-registry]   Collector ID : ${_collectorId}`);
    console.log(`[collector-registry]   Target URL   : ${_targetUrl}`);
  } else {
    _mode = MODE.MOCK;

    // Log exactly which variables are missing so the operator knows what to add
    const missing = [];
    if (!_collectorId) missing.push('BRIGHTDATA_COLLECTOR_ID');
    if (!_targetUrl) missing.push('TARGET_URL');

    console.log('[collector-registry] Mode: MOCK (falling back to mock data source)');
    console.log(`[collector-registry]   Missing env vars: ${missing.join(', ')}`);
    console.log(
      '[collector-registry]   Set both to switch to live scraping — no code change needed.'
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getCollectorMode()
 * Returns 'live' or 'mock'.
 * @returns {'live'|'mock'}
 */
function getCollectorMode() {
  _init();
  return _mode;
}

/**
 * isLive()
 * Returns true when both BRIGHTDATA_COLLECTOR_ID and TARGET_URL are set.
 * Use this as the primary conditional everywhere in the pipeline.
 * @returns {boolean}
 */
function isLive() {
  return getCollectorMode() === MODE.LIVE;
}

/**
 * getCollectorId()
 * Returns the Bright Data Collector ID, or null in mock mode.
 * Callers in live mode should always guard with isLive() first.
 * @returns {string|null}
 */
function getCollectorId() {
  _init();
  return _collectorId;
}

/**
 * getTargetUrl()
 * Returns the TARGET_URL for the scraper run, or null in mock mode.
 * @returns {string|null}
 */
function getTargetUrl() {
  _init();
  return _targetUrl;
}

/**
 * reset()
 * Clears cached state — used in tests that need to re-initialise
 * the registry with different env var values.
 * NOT for production use.
 */
function reset() {
  _mode = null;
  _collectorId = null;
  _targetUrl = null;
}

module.exports = {
  MODE,
  getCollectorMode,
  isLive,
  getCollectorId,
  getTargetUrl,
  reset,
};
