/**
 * tests/pipeline-integration.test.js
 *
 * Integration-style tests for the Undying Scraper pipeline.
 *
 * Covers:
 *   1. Diff module: new products, changed prices, stock flips, summary counts
 *   2. withRetry: success on first attempt, retry, exhaustion, onRetry callback
 *   3. checkResult mock mode: valid products, empty array, non-array, partial valid
 *   4. checkResult live mode: injectable fns, heal succeeds/fails/retry-empty
 *   5. Zero-env-var smoke test: modules load cleanly, full mock pipeline round-trip
 *
 * Run with: node tests/pipeline-integration.test.js
 * No test framework needed — uses Node's built-in assert.
 */

'use strict';

const assert = require('assert');
const { diffProducts, buildDiffSummary } = require('../src/diff');
const { withRetry } = require('../src/retry');

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── Mock data helpers ────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    product_name: 'Test Widget',
    price: 29.99,
    currency: 'USD',
    in_stock: true,
    product_url: 'https://example.com/widget',
    scraped_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Main test runner ─────────────────────────────────────────────────────────

async function runTests() {
  // ── 1. diffProducts ────────────────────────────────────────────────────────
  console.log('\n── diffProducts ─────────────────────────────────────────────');

  await test('marks products as new when no prior snapshot exists', async () => {
    const products = [makeProduct({ product_url: 'https://example.com/a' })];
    const result = diffProducts(products, new Map());
    assert.strictEqual(result[0].price_changed, false);
    assert.strictEqual(result[0].stock_changed, false);
    assert.strictEqual(result[0].previous_price, null);
  });

  await test('flags price increase above threshold', async () => {
    const priorMap = new Map([['https://example.com/a', { price: 20.0, in_stock: true }]]);
    const products = [makeProduct({ product_url: 'https://example.com/a', price: 25.0 })];
    const [r] = diffProducts(products, priorMap);
    assert.strictEqual(r.price_changed, true);
    assert.strictEqual(r.previous_price, 20.0);
  });

  await test('does not flag tiny floating-point noise below $0.01 threshold', async () => {
    const priorMap = new Map([['https://example.com/a', { price: 29.99, in_stock: true }]]);
    const products = [makeProduct({ product_url: 'https://example.com/a', price: 29.99 })];
    const [r] = diffProducts(products, priorMap);
    assert.strictEqual(r.price_changed, false);
  });

  await test('flags price decrease', async () => {
    const priorMap = new Map([['https://example.com/a', { price: 50.0, in_stock: true }]]);
    const products = [makeProduct({ product_url: 'https://example.com/a', price: 40.0 })];
    const [r] = diffProducts(products, priorMap);
    assert.strictEqual(r.price_changed, true);
  });

  await test('flags stock flip from true to false', async () => {
    const priorMap = new Map([['https://example.com/a', { price: 29.99, in_stock: true }]]);
    const products = [makeProduct({ product_url: 'https://example.com/a', in_stock: false })];
    const [r] = diffProducts(products, priorMap);
    assert.strictEqual(r.stock_changed, true);
  });

  await test('does not flag unchanged stock', async () => {
    const priorMap = new Map([['https://example.com/a', { price: 29.99, in_stock: false }]]);
    const products = [makeProduct({ product_url: 'https://example.com/a', in_stock: false })];
    const [r] = diffProducts(products, priorMap);
    assert.strictEqual(r.stock_changed, false);
  });

  // ── 2. buildDiffSummary ────────────────────────────────────────────────────
  console.log('\n── buildDiffSummary ─────────────────────────────────────────');

  await test('counts new, increases, decreases, stock flips correctly', async () => {
    const enriched = [
      {
        product_url: 'a',
        price: 25.0,
        previous_price: null,
        price_changed: false,
        stock_changed: false,
      }, // new
      {
        product_url: 'b',
        price: 30.0,
        previous_price: 20.0,
        price_changed: true,
        stock_changed: false,
      }, // increase
      {
        product_url: 'c',
        price: 10.0,
        previous_price: 20.0,
        price_changed: true,
        stock_changed: false,
      }, // decrease
      {
        product_url: 'd',
        price: 15.0,
        previous_price: 15.0,
        price_changed: false,
        stock_changed: true,
      }, // stock flip
      {
        product_url: 'e',
        price: 15.0,
        previous_price: 15.0,
        price_changed: false,
        stock_changed: false,
      }, // unchanged
    ];
    const s = buildDiffSummary(enriched);
    assert.strictEqual(s.newProducts, 1);
    assert.strictEqual(s.priceIncreases, 1);
    assert.strictEqual(s.priceDecreases, 1);
    assert.strictEqual(s.stockFlips, 1);
  });

  // ── 3. withRetry ──────────────────────────────────────────────────────────
  console.log('\n── withRetry ────────────────────────────────────────────────');

  await test('resolves on first attempt without retrying', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        return 'ok';
      },
      { noDelay: true }
    );
    assert.strictEqual(result, 'ok');
    assert.strictEqual(calls, 1);
  });

  await test('retries once on first failure, succeeds on second', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw new Error('first fail');
        return 'recovered';
      },
      { maxRetries: 2, noDelay: true }
    );
    assert.strictEqual(result, 'recovered');
    assert.strictEqual(calls, 2);
  });

  await test('exhausts all retries and rethrows last error', async () => {
    let calls = 0;
    let threw = false;
    try {
      await withRetry(
        async () => {
          calls++;
          throw new Error(`fail #${calls}`);
        },
        { maxRetries: 2, noDelay: true }
      );
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('fail #2'), `Expected 'fail #2', got '${err.message}'`);
    }
    assert.ok(threw, 'Expected withRetry to throw');
    assert.strictEqual(calls, 2);
  });

  await test('calls onRetry callback exactly once for maxRetries=2', async () => {
    let retryCalls = 0;
    try {
      await withRetry(
        async () => {
          throw new Error('always fail');
        },
        {
          maxRetries: 2,
          noDelay: true,
          onRetry: () => {
            retryCalls++;
          },
        }
      );
    } catch {
      /* expected */
    }
    assert.strictEqual(retryCalls, 1);
  });

  // ── 4. checkResult — mock mode ─────────────────────────────────────────────
  console.log('\n── checkResult (mock mode) ──────────────────────────────────');

  // Ensure mock mode
  const savedId = process.env.BRIGHTDATA_COLLECTOR_ID;
  const savedUrl = process.env.TARGET_URL;
  delete process.env.BRIGHTDATA_COLLECTOR_ID;
  delete process.env.TARGET_URL;
  const registry = require('../src/brightdata/collector-registry');
  const { checkResult } = require('../src/heal-check');
  registry.reset();

  await test('returns healthy=true for fully valid product array', async () => {
    const products = [makeProduct(), makeProduct({ product_url: 'https://example.com/b' })];
    const result = await checkResult(products);
    assert.strictEqual(result.healthy, true);
    assert.strictEqual(result.products.length, 2);
    assert.strictEqual(result.healEvents.length, 0);
  });

  await test('returns healthy=false and simulated heal event for empty array', async () => {
    const result = await checkResult([]);
    assert.strictEqual(result.healthy, false);
    assert.strictEqual(result.healEvents.length, 1);
    assert.strictEqual(result.healEvents[0].heal_method, 'simulated');
    assert.strictEqual(result.healEvents[0].error_type, 'empty_result');
    assert.strictEqual(result.healEvents[0].resolved, false);
  });

  await test('heal event has all required v0.3 fields', async () => {
    const result = await checkResult([]);
    const evt = result.healEvents[0];
    for (const field of [
      'timestamp',
      'description',
      'resolved',
      'attempt_number',
      'heal_method',
      'error_type',
      'duration_ms',
    ]) {
      assert.ok(field in evt, `heal event missing field: ${field}`);
    }
  });

  await test('non-array input triggers simulated heal event', async () => {
    const result = await checkResult('not-an-array');
    assert.strictEqual(result.healthy, false);
    assert.strictEqual(result.healEvents[0].heal_method, 'simulated');
  });

  await test('partial valid results: healthy=true, only valid products returned, error_type=type_mismatch', async () => {
    const broken = makeProduct({ price: 'not-a-number', product_url: 'https://example.com/bad' });
    const good = makeProduct({ product_url: 'https://example.com/good' });
    const result = await checkResult([broken, good]);
    assert.strictEqual(result.healthy, true);
    assert.strictEqual(result.products.length, 1);
    assert.strictEqual(result.products[0].product_url, 'https://example.com/good');
    assert.ok(['type_mismatch', 'missing_fields'].includes(result.healEvents[0].error_type));
  });

  // Restore env
  if (savedId !== undefined) process.env.BRIGHTDATA_COLLECTOR_ID = savedId;
  if (savedUrl !== undefined) process.env.TARGET_URL = savedUrl;
  registry.reset();

  // ── 5. checkResult — live mode (injectable) ────────────────────────────────
  console.log('\n── checkResult (live mode, injected) ────────────────────────');

  process.env.BRIGHTDATA_COLLECTOR_ID = 'c_testlive';
  process.env.TARGET_URL = 'https://example.com/products';
  registry.reset();

  const goodProduct = makeProduct();

  await test('live: heal succeeds + retry returns data → resolved=true', async () => {
    const result = await checkResult([], {
      _healCollector: async () => {
        /* success */
      },
      _runCollector: async () => [goodProduct],
      _noDelay: true,
    });
    assert.strictEqual(result.healEvents[0].resolved, true);
    assert.strictEqual(result.healEvents[0].heal_method, 'real');
    assert.strictEqual(result.healEvents[0].error_type, 'empty_result');
    assert.strictEqual(result.products.length, 1);
  });

  await test('live: heal fails all retries → resolved=false', async () => {
    let healCalls = 0;
    const result = await checkResult([], {
      _healCollector: async () => {
        healCalls++;
        throw new Error('network error');
      },
      _runCollector: async () => {
        throw new Error('should not run');
      },
      _noDelay: true,
    });
    assert.strictEqual(result.healEvents[0].resolved, false);
    assert.ok(healCalls <= 2, `Expected ≤2 heal calls, got ${healCalls}`);
  });

  await test('live: heal succeeds but retry run throws → resolved=false', async () => {
    const result = await checkResult([], {
      _healCollector: async () => {
        /* success */
      },
      _runCollector: async () => {
        throw new Error('still broken after heal');
      },
      _noDelay: true,
    });
    assert.strictEqual(result.healEvents[0].resolved, false);
  });

  // Restore
  delete process.env.BRIGHTDATA_COLLECTOR_ID;
  delete process.env.TARGET_URL;
  registry.reset();

  // ── 6. Zero-env-var smoke test ─────────────────────────────────────────────
  console.log('\n── zero env vars smoke test ─────────────────────────────────');

  await test('pipeline modules load cleanly with no env vars', async () => {
    const { runCollector } = require('../src/collector');
    const { checkResult: cr } = require('../src/heal-check');
    assert.strictEqual(typeof runCollector, 'function');
    assert.strictEqual(typeof cr, 'function');
  });

  await test('full mock round-trip: runCollector → checkResult → valid output', async () => {
    registry.reset();
    const { runCollector } = require('../src/collector');
    const { checkResult: cr } = require('../src/heal-check');
    const raw = await runCollector();
    assert.ok(Array.isArray(raw), 'runCollector should return an array');
    const { products, healEvents } = await cr(raw);
    assert.ok(Array.isArray(products), 'products should be an array');
    assert.ok(Array.isArray(healEvents), 'healEvents should be an array');
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Tests: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
