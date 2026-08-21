/**
 * tests/collector-registry.test.js
 *
 * Tests for src/brightdata/collector-registry.js
 *
 * Run with: node tests/collector-registry.test.js
 */

'use strict';

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function withEnv(vars, fn) {
  // Save originals
  const originals = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    fn();
  } finally {
    // Restore originals
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

const registry = require('../src/brightdata/collector-registry');

console.log('\n── collector-registry ───────────────────────────────────────');

test('is mock mode when both env vars missing', () => {
  withEnv({ BRIGHTDATA_COLLECTOR_ID: undefined, TARGET_URL: undefined }, () => {
    registry.reset();
    assert.strictEqual(registry.isLive(), false);
    assert.strictEqual(registry.getCollectorMode(), 'mock');
    assert.strictEqual(registry.getCollectorId(), null);
    assert.strictEqual(registry.getTargetUrl(), null);
  });
});

test('is mock mode when only BRIGHTDATA_COLLECTOR_ID is set', () => {
  withEnv({ BRIGHTDATA_COLLECTOR_ID: 'c_test123', TARGET_URL: undefined }, () => {
    registry.reset();
    assert.strictEqual(registry.isLive(), false);
    assert.strictEqual(registry.getCollectorMode(), 'mock');
  });
});

test('is mock mode when only TARGET_URL is set', () => {
  withEnv({ BRIGHTDATA_COLLECTOR_ID: undefined, TARGET_URL: 'https://example.com' }, () => {
    registry.reset();
    assert.strictEqual(registry.isLive(), false);
    assert.strictEqual(registry.getCollectorMode(), 'mock');
  });
});

test('is live mode when both env vars are set', () => {
  withEnv({ BRIGHTDATA_COLLECTOR_ID: 'c_live123', TARGET_URL: 'https://example.com' }, () => {
    registry.reset();
    assert.strictEqual(registry.isLive(), true);
    assert.strictEqual(registry.getCollectorMode(), 'live');
    assert.strictEqual(registry.getCollectorId(), 'c_live123');
    assert.strictEqual(registry.getTargetUrl(), 'https://example.com');
  });
});

test('caches mode after first init (reset not called)', () => {
  withEnv({ BRIGHTDATA_COLLECTOR_ID: 'c_first', TARGET_URL: 'https://a.com' }, () => {
    registry.reset();
    const mode1 = registry.getCollectorMode(); // initialises to live
    // Change env vars without reset — should NOT re-read
    process.env.BRIGHTDATA_COLLECTOR_ID = 'c_second';
    const mode2 = registry.getCollectorMode(); // should still be live with c_first
    assert.strictEqual(mode1, 'live');
    assert.strictEqual(mode2, 'live');
    assert.strictEqual(registry.getCollectorId(), 'c_first'); // still first value
  });
});

console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log(`  Tests: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('─────────────────────────────────────────────────────────────');
console.log('');

if (failed > 0) process.exit(1);
