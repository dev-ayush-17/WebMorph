/**
 * src/brightdata/client.js
 *
 * Bright Data CLI wrapper — clean async functions over the `bdata` CLI.
 *
 * IMPORTANT: None of these functions make real calls unless `bdata` is
 * installed and authenticated. In unit-test / dry-run environments, pass
 * a `_exec` override (see the `options` parameter on each function) to
 * inject a mock child_process implementation without touching the real CLI.
 *
 * Functions:
 *   createCollector(url, description, options?)  -> collectorId string
 *   runCollector(collectorId, url, options?)     -> Array<DataContractObject>
 *   healCollector(collectorId, whatBroke, options?) -> void
 *
 * Error types thrown (from ./errors.js):
 *   CliNotAuthenticatedError   — bdata not installed or not logged in
 *   CollectorNotFoundError     — collectorId does not exist
 *   ScrapeReturnedEmptyError   — run succeeded but zero results returned
 *   UnknownCliError            — anything else
 */

'use strict';

const { execSync } = require('child_process');
const {
  CliNotAuthenticatedError,
  CollectorNotFoundError,
  ScrapeReturnedEmptyError,
  UnknownCliError,
} = require('./errors');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Patterns in stderr that indicate auth / install problems */
const AUTH_PATTERNS = [
  /not authenticated/i,
  /please log in/i,
  /bdata login/i,
  /command not found/i,
  /is not recognized/i,          // Windows "X is not recognized as..."
  /cannot find the path/i,
];

/** Patterns in stderr/stdout that indicate the collector ID is wrong */
const NOT_FOUND_PATTERNS = [
  /collector.*not found/i,
  /no such collector/i,
  /invalid collector/i,
  /does not exist/i,
];

/**
 * Pattern used to extract a Collector ID from `bdata scraper create` output.
 * Bright Data's CLI may print any of:
 *   Collector created: c_abc123xyz
 *   collector_id: c_abc123xyz
 *   {"collector_id":"c_abc123xyz"}
 * We handle all three with a single broad pattern that looks for the
 * c_<alphanumeric> token wherever it appears after a word boundary.
 */
const COLLECTOR_ID_PATTERN = /\b(c_[a-z0-9_]{4,})\b/i;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Default exec implementation — thin wrapper around execSync that captures
 * both stdout and stderr and throws a structured error on non-zero exit.
 *
 * @param {string} cmd
 * @param {{ timeout?: number }} [opts]
 * @returns {{ stdout: string, stderr: string }}
 */
function defaultExec(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      timeout: opts.timeout ?? 120_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout.toString(), stderr: '' };
  } catch (err) {
    // execSync throws on non-zero exit; err.stdout / err.stderr are buffers
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : '';
    const exitCode = err.status ?? 1;
    throw Object.assign(new Error(err.message), { stdout, stderr, exitCode });
  }
}

/**
 * Classify a raw CLI error into one of our typed error classes.
 *
 * @param {Error & { stderr?: string, exitCode?: number }} rawErr
 * @param {string} [collectorId]
 * @returns {import('./errors').BrightDataError}
 */
function classifyError(rawErr, collectorId) {
  const stderr = rawErr.stderr ?? '';
  const combined = (rawErr.message + '\n' + stderr).toLowerCase();

  if (AUTH_PATTERNS.some((p) => p.test(combined))) {
    return new CliNotAuthenticatedError(stderr);
  }

  if (collectorId && NOT_FOUND_PATTERNS.some((p) => p.test(combined))) {
    return new CollectorNotFoundError(collectorId, stderr);
  }

  return new UnknownCliError(
    `bdata CLI exited with code ${rawErr.exitCode ?? '?'}: ${rawErr.message}`,
    rawErr.exitCode ?? 1,
    stderr
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * createCollector(url, description, options?)
 *
 * Runs `bdata scraper create <url> "<description>"` and returns the
 * newly created Collector ID.
 *
 * NOTE: This is intentionally NOT called anywhere automatically. It is a
 * one-time setup command that YOU run (or trigger via setup script) once
 * you have chosen a target site. The resulting Collector ID then goes into
 * BRIGHTDATA_COLLECTOR_ID in your .env.
 *
 * @param {string} url          - Target URL for the new collector
 * @param {string} description  - Plain-English field description
 *   e.g. "product name, price as number, currency, in_stock as boolean, product URL"
 * @param {{ _exec?: Function, timeout?: number }} [options]
 *   - _exec: optional mock for child_process (used in tests/dry-run)
 * @returns {Promise<string>}   The new Collector ID (e.g. "c_abc123xyz")
 * @throws {CliNotAuthenticatedError|UnknownCliError}
 */
async function createCollector(url, description, options = {}) {
  const exec = options._exec ?? defaultExec;

  // Sanitize description to avoid shell injection — wrap in single quotes
  // and escape any single quotes within the description itself
  const safeDesc = description.replace(/'/g, "'\\''");
  const cmd = `bdata scraper create "${url}" '${safeDesc}'`;

  console.log(`[brightdata] Running: ${cmd}`);

  let result;
  try {
    result = exec(cmd, { timeout: options.timeout ?? 60_000 });
  } catch (rawErr) {
    throw classifyError(rawErr);
  }

  const { stdout } = result;

  // Try to extract the collector ID from the output
  const match = stdout.match(COLLECTOR_ID_PATTERN);
  if (!match) {
    throw new UnknownCliError(
      `Could not parse Collector ID from bdata output. Raw output:\n${stdout}`,
      0,
      ''
    );
  }

  const collectorId = match[1];
  console.log(`[brightdata] ✓ Collector created: ${collectorId}`);
  return collectorId;
}

/**
 * runCollector(collectorId, url, options?)
 *
 * Runs `bdata scraper run <collectorId> <url> --pretty` and returns
 * the parsed JSON result as an array of data-contract objects.
 *
 * @param {string} collectorId
 * @param {string} url             - Target URL for this run
 * @param {{ _exec?: Function, timeout?: number }} [options]
 * @returns {Promise<Array<Object>>}
 * @throws {CliNotAuthenticatedError|CollectorNotFoundError|ScrapeReturnedEmptyError|UnknownCliError}
 */
async function runCollector(collectorId, url, options = {}) {
  const exec = options._exec ?? defaultExec;
  const cmd = `bdata scraper run ${collectorId} "${url}" --pretty`;

  console.log(`[brightdata] Running: ${cmd}`);

  let result;
  try {
    result = exec(cmd, { timeout: options.timeout ?? 120_000 });
  } catch (rawErr) {
    throw classifyError(rawErr, collectorId);
  }

  const { stdout } = result;

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new UnknownCliError(
      `bdata scraper run returned non-JSON output. Raw:\n${stdout.slice(0, 500)}`,
      0,
      ''
    );
  }

  // Normalise: the CLI may return { results: [...] } or a bare array
  const items = Array.isArray(parsed) ? parsed : (parsed.results ?? []);

  if (items.length === 0) {
    throw new ScrapeReturnedEmptyError(collectorId);
  }

  console.log(`[brightdata] ✓ Collector returned ${items.length} items`);
  return items;
}

/**
 * healCollector(collectorId, whatBroke, options?)
 *
 * Runs `bdata scraper heal <collectorId> "<whatBroke>"` to trigger
 * Bright Data's automatic re-analysis and re-extraction for a collector
 * whose output has broken.
 *
 * @param {string} collectorId
 * @param {string} whatBroke   - Human-readable description of the failure
 *   e.g. "price field missing — site may have changed price element selector"
 * @param {{ _exec?: Function, timeout?: number }} [options]
 * @returns {Promise<void>}
 * @throws {CliNotAuthenticatedError|CollectorNotFoundError|UnknownCliError}
 */
async function healCollector(collectorId, whatBroke, options = {}) {
  const exec = options._exec ?? defaultExec;
  const safeDesc = whatBroke.replace(/'/g, "'\\''");
  const cmd = `bdata scraper heal ${collectorId} '${safeDesc}'`;

  console.log(`[brightdata] Running: ${cmd}`);

  try {
    const result = exec(cmd, { timeout: options.timeout ?? 60_000 });
    console.log(`[brightdata] ✓ Heal triggered successfully`);
    if (result.stdout) {
      console.log(`[brightdata]   stdout: ${result.stdout.trim()}`);
    }
  } catch (rawErr) {
    throw classifyError(rawErr, collectorId);
  }
}

module.exports = { createCollector, runCollector, healCollector };
