/**
 * src/diff.js
 *
 * Price and stock change detection.
 *
 * Before writing new product data to Supabase, compare each product against
 * the most recent prior snapshot for the same product_url. Flag:
 *   - price_changed  : boolean — price differs from last recorded value
 *   - stock_changed  : boolean — in_stock status differs from last recorded value
 *   - previous_price : number | null — the previous price (null if first seen)
 *
 * This module is pure — it takes products and a prior-snapshot map, and returns
 * enriched product objects. It does not call Supabase itself; the pipeline
 * script handles all I/O.
 *
 * PRICE_CHANGE_THRESHOLD: we consider a price "changed" if it differs by more
 * than 1 cent (avoids floating-point noise in mock data).
 */

'use strict';

const PRICE_CHANGE_THRESHOLD = 0.01; // $0.01

/**
 * @typedef {Object} ProductSnapshot
 * @property {string}  product_url
 * @property {number}  price
 * @property {boolean} in_stock
 */

/**
 * @typedef {Object} EnrichedProduct
 * @property {string}       product_name
 * @property {number}       price
 * @property {string}       currency
 * @property {boolean}      in_stock
 * @property {string}       product_url
 * @property {string}       scraped_at
 * @property {boolean}      price_changed
 * @property {boolean}      stock_changed
 * @property {number|null}  previous_price
 */

/**
 * diffProducts(newProducts, priorSnapshots)
 *
 * Enrich an array of new products with diff metadata by comparing them against
 * the most recent prior snapshots.
 *
 * @param {Array<Object>}   newProducts    - Fresh products from the collector
 * @param {Map<string, ProductSnapshot>} priorSnapshots
 *   Map keyed by product_url → most recent DB row for that URL.
 *   Build this map from a Supabase query; pass an empty Map for first run.
 *
 * @returns {EnrichedProduct[]}
 */
function diffProducts(newProducts, priorSnapshots) {
  return newProducts.map((product) => {
    const prior = priorSnapshots.get(product.product_url);

    if (!prior) {
      // First time we've seen this product — no comparison possible
      return {
        ...product,
        price_changed: false,
        stock_changed: false,
        previous_price: null,
      };
    }

    const priceDiff = Math.abs(product.price - prior.price);
    const priceChanged = priceDiff > PRICE_CHANGE_THRESHOLD;
    const stockChanged = product.in_stock !== prior.in_stock;

    return {
      ...product,
      price_changed: priceChanged,
      stock_changed: stockChanged,
      previous_price: prior.price,
    };
  });
}

/**
 * buildDiffSummary(enrichedProducts)
 *
 * From a list of enriched products, compute a summary of what changed.
 *
 * @param {EnrichedProduct[]} enrichedProducts
 * @returns {{ priceIncreases: number, priceDecreases: number, stockFlips: number, newProducts: number }}
 */
function buildDiffSummary(enrichedProducts) {
  let priceIncreases = 0;
  let priceDecreases = 0;
  let stockFlips = 0;
  let newProducts = 0;

  for (const p of enrichedProducts) {
    if (p.previous_price === null) {
      newProducts++;
      continue;
    }
    if (p.price_changed) {
      if (p.price > p.previous_price) priceIncreases++;
      else priceDecreases++;
    }
    if (p.stock_changed) stockFlips++;
  }

  return { priceIncreases, priceDecreases, stockFlips, newProducts };
}

module.exports = { diffProducts, buildDiffSummary };
