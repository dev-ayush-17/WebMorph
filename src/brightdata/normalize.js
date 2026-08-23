/**
 * src/brightdata/normalize.js
 *
 * Normalization layer: converts raw Bright Data collector output into
 * objects that match our data contract exactly.
 *
 * DATA CONTRACT (expected output per product):
 *   product_name : string
 *   price        : number  (no currency symbol, no commas)
 *   currency     : string  ("INR")
 *   in_stock     : boolean
 *   product_url  : string
 *   scraped_at   : ISO timestamp string
 *
 * The Bright Data AI may return field names in different casings or with
 * extra decorators (e.g. "Rs 299.00", "₹299", "299.00 INR"). This module
 * normalizes everything downstream so nothing in the pipeline or schema
 * needs to change.
 *
 * INVARIANTS:
 *   - If normalization produces a null/undefined price, the item is
 *     kept as-is (with price=null) and heal-check will flag it.
 *   - scraped_at is always overwritten with the current ISO timestamp
 *     (the AI's timestamp may be unreliable or missing).
 *   - currency is always forced to "INR" for this collector.
 */

'use strict';

// ─── Price normalization ───────────────────────────────────────────────────────

/**
 * Parse a price value into a plain number.
 *
 * Handles:
 *   "Rs 299.00"  →  299
 *   "₹299.00"    →  299
 *   "299.00 INR" →  299
 *   "299,00"     →  299  (comma-as-decimal, rare)
 *   299           →  299 (already a number)
 *   "299"         →  299
 *   null/undefined → null
 *
 * @param {*} raw
 * @returns {number|null}
 */
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;

  const str = String(raw)
    .replace(/rs\.?\s*/i, '') // "Rs " / "Rs."
    .replace(/₹/g, '') // rupee symbol
    .replace(/inr/gi, '') // "INR" suffix
    .replace(/,(?=\d{3})/g, '') // thousands separator: "1,299" → "1299"
    .replace(/[^\d.]/g, '') // strip any remaining non-numeric chars
    .trim();

  if (str === '') return null;
  const num = parseFloat(str);
  return isFinite(num) ? num : null;
}

// ─── In-stock normalization ────────────────────────────────────────────────────

/**
 * Parse an in_stock value into a plain boolean.
 *
 * Handles:
 *   true / false                → as-is
 *   "true" / "false"            → coerced
 *   "in stock" / "out of stock" → semantic
 *   "available" / "unavailable" → semantic
 *   1 / 0                       → coerced
 *   null / undefined            → defaults to true (assume in stock if unknown)
 *
 * @param {*} raw
 * @returns {boolean}
 */
function parseInStock(raw) {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;

  const s = String(raw).toLowerCase().trim();
  if (s === 'true' || s === 'yes' || s === '1') return true;
  if (s === 'false' || s === 'no' || s === '0') return false;
  if (s.includes('out of stock') || s.includes('unavailable') || s.includes('sold out'))
    return false;
  if (s.includes('in stock') || s.includes('available')) return true;
  // "in stock" = no label → true; "out of stock" label present → false
  // If we got a non-empty string that doesn't match, lean toward true
  return true;
}

// ─── URL normalization ────────────────────────────────────────────────────────

const BASE_URL = 'https://raajkart.com';

/**
 * Ensure the product URL is absolute.
 * Bright Data may return relative paths like "/books/some-book-p12345.html"
 *
 * @param {*} raw
 * @returns {string}
 */
function parseUrl(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return BASE_URL + s;
  return BASE_URL + '/' + s;
}

// ─── Product name normalization ────────────────────────────────────────────────

/**
 * Try known alternative field names that Bright Data might use.
 * Returns the best candidate string, or null if nothing found.
 *
 * @param {Object} item
 * @returns {string|null}
 */
function parseName(item) {
  const candidates = [
    item.product_name,
    item.productName,
    item.name,
    item.title,
    item.book_title,
    item.bookTitle,
    item.item_name,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize a single raw item from the Bright Data collector into a data
 * contract object.
 *
 * @param {Object} item   Raw item from bdata scraper run output
 * @param {string} now    ISO timestamp for scraped_at override
 * @returns {Object}      Data-contract-shaped object (may have null price if unparseable)
 */
function normalizeItem(item, now) {
  // Price: try canonical field, then common alternatives
  const rawPrice =
    item.price ??
    item.special_price ??
    item.specialPrice ??
    item.sale_price ??
    item.salePrice ??
    item.discounted_price ??
    null;

  // URL: canonical or alternative
  const rawUrl = item.product_url ?? item.productUrl ?? item.url ?? item.link ?? item.href ?? null;

  // In-stock: canonical or alternative
  const rawInStock =
    'in_stock' in item
      ? item.in_stock
      : 'inStock' in item
        ? item.inStock
        : 'available' in item
          ? item.available
          : 'stock' in item
            ? item.stock
            : 'availability' in item
              ? item.availability
              : null;

  return {
    product_name:
      parseName(item) ?? (typeof item.product_name === 'string' ? item.product_name : ''),
    price: parsePrice(rawPrice),
    currency: 'INR', // always forced for this collector
    in_stock: parseInStock(rawInStock),
    product_url: parseUrl(rawUrl),
    scraped_at: now, // override AI's timestamp with our own
  };
}

/**
 * Normalize an array of raw Bright Data collector items.
 *
 * @param {Array<Object>} items   Raw array from bdata scraper run
 * @returns {Array<Object>}       Normalized data-contract objects
 */
function normalizeItems(items) {
  const now = new Date().toISOString();

  if (!Array.isArray(items)) return [];

  return items.map((item, i) => {
    try {
      return normalizeItem(item, now);
    } catch (err) {
      // A broken item becomes a minimal object that heal-check will flag
      console.warn(`[normalize] ⚠  Item[${i}] normalization failed: ${err.message}`);
      return {
        product_name: `[parse error — item ${i}]`,
        price: null,
        currency: 'INR',
        in_stock: true,
        product_url: '',
        scraped_at: now,
      };
    }
  });
}

module.exports = { normalizeItems, normalizeItem, parsePrice, parseInStock, parseUrl };
