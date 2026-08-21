/**
 * tests/brightdata-client.test.js
 *
 * Unit-style tests for src/brightdata/client.js using mocked child_process.
 *
 * These tests verify all three wrapper functions (createCollector, runCollector,
 * healCollector) WITHOUT making any real `bdata` CLI calls — every exec is
 * injected via the `_exec` option.
 *
 * Run with: node tests/brightdata-client.test.js
 *
 * Uses Node's built-in assert module — no test framework required.
 */

'use strict';

const assert = require('assert');
const {
  createCollector,
  runCollector,
  healCollector,
} = require('../src/brightdata/client');
const {
  CliNotAuthenticatedError,
  CollectorNotFoundError,
  ScrapeReturnedEmptyError,
  UnknownCliError,
} = require('../src/brightdata/errors');

// ─── Test runner ─────────────────────────────────────────────────────────────

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

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Returns a mock _exec that always returns fixed stdout */
function mockExec(stdout, stderr = '') {
  return (_cmd, _opts) => ({ stdout, stderr });
}

/** Returns a mock _exec that always throws a CLI-style error */
function mockExecFail(stderr, exitCode = 1) {
  return (_cmd, _opts) => {
    const err = new Error(`Command failed with exit code ${exitCode}`);
    err.stderr = stderr;
    err.exitCode = exitCode;
    throw err;
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

async function runTests() {

  const sampleProduct = {
    product_name: 'Test Widget',
    price: 29.99,
    currency: 'USD',
    in_stock: true,
    product_url: 'https://example.com/widget',
    scraped_at: new Date().toISOString(),
  };

  // ── createCollector ───────────────────────────────────────────────────────
  console.log('\n── createCollector ──────────────────────────────────────────');

  await test('returns collector ID from text output', async () => {
    const id = await createCollector(
      'https://example.com', 'product name, price',
      { _exec: mockExec('Collector created: c_abc123xyz\n') }
    );
    assert.strictEqual(id, 'c_abc123xyz');
  });

  await test('returns collector ID from JSON output', async () => {
    const id = await createCollector(
      'https://example.com', 'product name, price',
      { _exec: mockExec('{"collector_id":"c_json456def"}\n') }
    );
    assert.strictEqual(id, 'c_json456def');
  });

  await test('throws CliNotAuthenticatedError when not logged in', async () => {
    let threw = false;
    try {
      await createCollector('https://example.com', 'desc', {
        _exec: mockExecFail('Error: not authenticated. Run `bdata login` first.'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CliNotAuthenticatedError,
        `Expected CliNotAuthenticatedError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws CliNotAuthenticatedError when bdata not on PATH (Windows)', async () => {
    let threw = false;
    try {
      await createCollector('https://example.com', 'desc', {
        _exec: mockExecFail("'bdata' is not recognized as an internal or external command"),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CliNotAuthenticatedError,
        `Expected CliNotAuthenticatedError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws UnknownCliError when output has no collector ID', async () => {
    let threw = false;
    try {
      await createCollector('https://example.com', 'desc', {
        _exec: mockExec('Some unexpected output without an ID\n'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof UnknownCliError,
        `Expected UnknownCliError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  // ── runCollector ──────────────────────────────────────────────────────────
  console.log('\n── runCollector ─────────────────────────────────────────────');

  await test('returns parsed array from bare JSON array output', async () => {
    const result = await runCollector('c_test', 'https://example.com', {
      _exec: mockExec(JSON.stringify([sampleProduct])),
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].product_name, 'Test Widget');
  });

  await test('returns parsed array from {results:[...]} wrapper format', async () => {
    const result = await runCollector('c_test', 'https://example.com', {
      _exec: mockExec(JSON.stringify({ results: [sampleProduct, sampleProduct] })),
    });
    assert.strictEqual(result.length, 2);
  });

  await test('throws ScrapeReturnedEmptyError on empty array', async () => {
    let threw = false;
    try {
      await runCollector('c_test', 'https://example.com', {
        _exec: mockExec(JSON.stringify([])),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof ScrapeReturnedEmptyError,
        `Expected ScrapeReturnedEmptyError, got ${err.name}`);
      assert.strictEqual(err.collectorId, 'c_test');
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws ScrapeReturnedEmptyError on empty results wrapper', async () => {
    let threw = false;
    try {
      await runCollector('c_test', 'https://example.com', {
        _exec: mockExec(JSON.stringify({ results: [] })),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof ScrapeReturnedEmptyError,
        `Expected ScrapeReturnedEmptyError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws CollectorNotFoundError when collector does not exist', async () => {
    let threw = false;
    try {
      await runCollector('c_bad', 'https://example.com', {
        _exec: mockExecFail('Error: collector c_bad not found'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CollectorNotFoundError,
        `Expected CollectorNotFoundError, got ${err.name}`);
      assert.strictEqual(err.collectorId, 'c_bad');
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws CliNotAuthenticatedError when bdata not on PATH (Windows)', async () => {
    let threw = false;
    try {
      await runCollector('c_test', 'https://example.com', {
        _exec: mockExecFail("'bdata' is not recognized as an internal or external command"),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CliNotAuthenticatedError,
        `Expected CliNotAuthenticatedError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws UnknownCliError on non-JSON output', async () => {
    let threw = false;
    try {
      await runCollector('c_test', 'https://example.com', {
        _exec: mockExec('<html>Server Error</html>'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof UnknownCliError,
        `Expected UnknownCliError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  // ── healCollector ─────────────────────────────────────────────────────────
  console.log('\n── healCollector ────────────────────────────────────────────');

  await test('resolves normally on success', async () => {
    // Should not throw
    await healCollector('c_test', 'price field missing from output', {
      _exec: mockExec('Heal triggered. Bright Data will re-analyse the collector.\n'),
    });
  });

  await test('throws CliNotAuthenticatedError when not logged in', async () => {
    let threw = false;
    try {
      await healCollector('c_test', 'broken', {
        _exec: mockExecFail('Error: please log in with `bdata login`'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CliNotAuthenticatedError,
        `Expected CliNotAuthenticatedError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await test('throws CollectorNotFoundError for unknown collector', async () => {
    let threw = false;
    try {
      await healCollector('c_gone', 'broken', {
        _exec: mockExecFail('Error: no such collector c_gone'),
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof CollectorNotFoundError,
        `Expected CollectorNotFoundError, got ${err.name}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Tests: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
