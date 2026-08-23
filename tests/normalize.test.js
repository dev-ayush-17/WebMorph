/**
 * tests/normalize.test.js
 *
 * Unit tests for src/brightdata/normalize.js
 *
 * Tests all real-world Raajkart/Bright Data output variants:
 *   - Price: "Rs 299.00", "₹299", number, string, null
 *   - in_stock: boolean, "true"/"false", "Out of stock", number
 *   - product_url: relative, absolute, missing
 *   - product_name: canonical, alternatives (name, title, bookTitle)
 *   - Full normalizeItems() round-trip with mixed inputs
 *
 * Run with: node tests/normalize.test.js
 */

'use strict';

const assert = require('assert');
const {
  parsePrice,
  parseInStock,
  parseUrl,
  normalizeItem,
  normalizeItems,
} = require('../src/brightdata/normalize');

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

async function run() {
  // ── parsePrice ─────────────────────────────────────────────────────────────
  console.log('\n── parsePrice ───────────────────────────────────────────────');

  await test('already a number', async () => {
    assert.strictEqual(parsePrice(299), 299);
    assert.strictEqual(parsePrice(299.99), 299.99);
  });

  await test('"Rs 299.00" → 299', async () => {
    assert.strictEqual(parsePrice('Rs 299.00'), 299);
  });

  await test('"Rs. 299.00" (with dot) → 299', async () => {
    assert.strictEqual(parsePrice('Rs. 299.00'), 299);
  });

  await test('"₹299.00" (rupee symbol) → 299', async () => {
    assert.strictEqual(parsePrice('₹299.00'), 299);
  });

  await test('"299.00 INR" (suffix) → 299', async () => {
    assert.strictEqual(parsePrice('299.00 INR'), 299);
  });

  await test('"1,299.00" (thousands separator) → 1299', async () => {
    assert.strictEqual(parsePrice('1,299.00'), 1299);
  });

  await test('numeric string "299" → 299', async () => {
    assert.strictEqual(parsePrice('299'), 299);
  });

  await test('null → null', async () => {
    assert.strictEqual(parsePrice(null), null);
  });

  await test('undefined → null', async () => {
    assert.strictEqual(parsePrice(undefined), null);
  });

  await test('empty string → null', async () => {
    assert.strictEqual(parsePrice(''), null);
  });

  await test('"N/A" → null', async () => {
    assert.strictEqual(parsePrice('N/A'), null);
  });

  // ── parseInStock ──────────────────────────────────────────────────────────
  console.log('\n── parseInStock ─────────────────────────────────────────────');

  await test('true → true', async () => {
    assert.strictEqual(parseInStock(true), true);
  });

  await test('false → false', async () => {
    assert.strictEqual(parseInStock(false), false);
  });

  await test('"true" → true', async () => {
    assert.strictEqual(parseInStock('true'), true);
  });

  await test('"false" → false', async () => {
    assert.strictEqual(parseInStock('false'), false);
  });

  await test('"Out of stock" → false', async () => {
    assert.strictEqual(parseInStock('Out of stock'), false);
  });

  await test('"out of stock" (lowercase) → false', async () => {
    assert.strictEqual(parseInStock('out of stock'), false);
  });

  await test('"In stock" → true', async () => {
    assert.strictEqual(parseInStock('In stock'), true);
  });

  await test('null → true (default to in stock)', async () => {
    assert.strictEqual(parseInStock(null), true);
  });

  await test('1 → true, 0 → false', async () => {
    assert.strictEqual(parseInStock(1), true);
    assert.strictEqual(parseInStock(0), false);
  });

  // ── parseUrl ──────────────────────────────────────────────────────────────
  console.log('\n── parseUrl ─────────────────────────────────────────────────');

  await test('absolute URL returned as-is', async () => {
    const u = 'https://raajkart.com/books/some-book.html';
    assert.strictEqual(parseUrl(u), u);
  });

  await test('relative path "/books/..." prefixed with base URL', async () => {
    assert.strictEqual(
      parseUrl('/books/some-book.html'),
      'https://raajkart.com/books/some-book.html'
    );
  });

  await test('null/empty → empty string', async () => {
    assert.strictEqual(parseUrl(null), '');
    assert.strictEqual(parseUrl(''), '');
  });

  // ── normalizeItem ─────────────────────────────────────────────────────────
  console.log('\n── normalizeItem ────────────────────────────────────────────');

  const NOW = new Date().toISOString();

  await test('canonical data contract fields pass through correctly', async () => {
    const item = {
      product_name: 'Concepts of Physics Vol 1',
      price: 499,
      currency: 'INR',
      in_stock: true,
      product_url: 'https://raajkart.com/books/concepts-of-physics.html',
      scraped_at: '2020-01-01T00:00:00Z', // should be overridden
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.product_name, 'Concepts of Physics Vol 1');
    assert.strictEqual(result.price, 499);
    assert.strictEqual(result.currency, 'INR');
    assert.strictEqual(result.in_stock, true);
    assert.ok(result.product_url.startsWith('https://raajkart.com'));
    assert.strictEqual(result.scraped_at, NOW); // overridden
  });

  await test('price as "Rs 299.00" string → number 299', async () => {
    const item = {
      product_name: 'Book',
      price: 'Rs 299.00',
      currency: 'INR',
      in_stock: true,
      product_url: 'https://raajkart.com/b',
      scraped_at: NOW,
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.price, 299);
  });

  await test('alternative field name: name → product_name', async () => {
    const item = {
      name: 'University Physics',
      price: 350,
      in_stock: true,
      url: 'https://raajkart.com/u',
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.product_name, 'University Physics');
  });

  await test('alternative field name: title → product_name', async () => {
    const item = {
      title: 'Optics by Ajoy Ghatak',
      price: 425,
      in_stock: true,
      product_url: 'https://raajkart.com/optics',
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.product_name, 'Optics by Ajoy Ghatak');
  });

  await test('alternative field name: inStock → in_stock', async () => {
    const item = { product_name: 'X', price: 100, inStock: false, product_url: 'https://r.com/x' };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.in_stock, false);
  });

  await test('alternative field name: special_price → price', async () => {
    const item = {
      product_name: 'Y',
      special_price: 'Rs 199.00',
      in_stock: true,
      product_url: 'https://r.com/y',
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.price, 199);
  });

  await test('currency is always forced to INR', async () => {
    const item = {
      product_name: 'Z',
      price: 100,
      currency: 'Rs',
      in_stock: true,
      product_url: 'https://r.com/z',
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.currency, 'INR');
  });

  await test('"Out of stock" string in_stock → false', async () => {
    const item = {
      product_name: 'OOS Book',
      price: 300,
      in_stock: 'Out of stock',
      product_url: 'https://r.com/oos',
    };
    const result = normalizeItem(item, NOW);
    assert.strictEqual(result.in_stock, false);
  });

  // ── normalizeItems ────────────────────────────────────────────────────────
  console.log('\n── normalizeItems ───────────────────────────────────────────');

  await test('normalizes an array of mixed-quality items', async () => {
    const raw = [
      { product_name: 'Book A', price: 'Rs 100.00', in_stock: true, product_url: '/books/a' },
      { name: 'Book B', price: 200, in_stock: false, url: 'https://raajkart.com/books/b' },
      { title: 'Book C', special_price: '₹300', in_stock: 'Out of stock', product_url: '/books/c' },
    ];
    const results = normalizeItems(raw);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].price, 100);
    assert.strictEqual(results[0].product_url, 'https://raajkart.com/books/a');
    assert.strictEqual(results[1].product_name, 'Book B');
    assert.strictEqual(results[1].price, 200);
    assert.strictEqual(results[2].product_name, 'Book C');
    assert.strictEqual(results[2].price, 300);
    assert.strictEqual(results[2].in_stock, false);
  });

  await test('returns empty array for non-array input', async () => {
    assert.deepStrictEqual(normalizeItems(null), []);
    assert.deepStrictEqual(normalizeItems('not an array'), []);
  });

  await test('all items have currency=INR regardless of raw input', async () => {
    const raw = [
      {
        product_name: 'X',
        price: 100,
        currency: 'Rs',
        in_stock: true,
        product_url: 'https://r.com',
      },
      {
        product_name: 'Y',
        price: 200,
        currency: '₹',
        in_stock: true,
        product_url: 'https://r.com',
      },
    ];
    const results = normalizeItems(raw);
    assert.ok(results.every((r) => r.currency === 'INR'));
  });

  await test('all items have scraped_at as recent ISO string', async () => {
    const raw = [{ product_name: 'Z', price: 100, in_stock: true, product_url: 'https://r.com' }];
    const before = Date.now();
    const results = normalizeItems(raw);
    const after = Date.now();
    const ts = new Date(results[0].scraped_at).getTime();
    assert.ok(ts >= before && ts <= after, 'scraped_at should be close to now');
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Tests: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
