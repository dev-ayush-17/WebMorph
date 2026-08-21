/**
 * src/brightdata/errors.js
 *
 * Typed error classes for the Bright Data CLI wrapper.
 *
 * Having distinct error types lets heal-check.js branch on the exact failure
 * mode rather than parsing error messages — important for choosing the right
 * heal strategy.
 */

'use strict';

/**
 * Base class for all Bright Data CLI errors.
 * Carries the raw stderr output for debugging.
 */
class BrightDataError extends Error {
  /**
   * @param {string} message     - Human-readable description
   * @param {string} [stderr=''] - Raw stderr from the bdata CLI process
   */
  constructor(message, stderr = '') {
    super(message);
    this.name = 'BrightDataError';
    this.stderr = stderr;
  }
}

/**
 * The `bdata` CLI is not installed, not on PATH, or the user is not
 * authenticated (`bdata login` has not been run).
 *
 * Heal strategy: cannot auto-heal — requires human intervention.
 */
class CliNotAuthenticatedError extends BrightDataError {
  constructor(stderr = '') {
    super(
      'Bright Data CLI is not authenticated or not installed. ' +
      'Run `bdata login` and ensure the `bdata` binary is on PATH.',
      stderr
    );
    this.name = 'CliNotAuthenticatedError';
  }
}

/**
 * The provided Collector ID does not exist in the Bright Data account,
 * or the account does not have access to it.
 *
 * Heal strategy: re-create the collector with `bdata scraper create`.
 */
class CollectorNotFoundError extends BrightDataError {
  /**
   * @param {string} collectorId - The ID that was not found
   * @param {string} [stderr='']
   */
  constructor(collectorId, stderr = '') {
    super(
      `Collector '${collectorId}' was not found. It may have been deleted or ` +
      'the Collector ID is incorrect. Re-create it with `bdata scraper create`.',
      stderr
    );
    this.name = 'CollectorNotFoundError';
    this.collectorId = collectorId;
  }
}

/**
 * The collector ran successfully but returned zero results.
 * This usually means the target site's HTML structure changed and the
 * extraction rules no longer match any elements.
 *
 * Heal strategy: call `bdata scraper heal` to let Bright Data re-analyse
 * the page structure.
 */
class ScrapeReturnedEmptyError extends BrightDataError {
  /**
   * @param {string} collectorId - The ID of the collector that ran
   * @param {string} [stderr='']
   */
  constructor(collectorId, stderr = '') {
    super(
      `Collector '${collectorId}' ran but returned zero results. ` +
      'The target site structure may have changed. Call `bdata scraper heal`.',
      stderr
    );
    this.name = 'ScrapeReturnedEmptyError';
    this.collectorId = collectorId;
  }
}

/**
 * An unexpected error from the CLI that doesn't match any known pattern.
 * Carries the exit code for debugging.
 */
class UnknownCliError extends BrightDataError {
  /**
   * @param {string} message
   * @param {number} [exitCode=1]
   * @param {string} [stderr='']
   */
  constructor(message, exitCode = 1, stderr = '') {
    super(message, stderr);
    this.name = 'UnknownCliError';
    this.exitCode = exitCode;
  }
}

module.exports = {
  BrightDataError,
  CliNotAuthenticatedError,
  CollectorNotFoundError,
  ScrapeReturnedEmptyError,
  UnknownCliError,
};
