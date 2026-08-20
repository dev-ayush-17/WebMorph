/**
 * src/sources/mock-source.js
 *
 * Generates fake product data matching the pipeline data contract exactly:
 *   { product_name, price, currency, in_stock, product_url, scraped_at }
 *
 * Features:
 *  - Returns 15–30 products per call
 *  - Randomises prices slightly each call (±5–15%) to produce believable price history
 *  - 1-in-8 calls returns a DELIBERATELY BROKEN shape to exercise heal-detection:
 *      broken shapes include: empty array, missing fields, wrong types
 *
 * This module is called by src/collector.js and is the ONLY mock-specific file.
 */

'use strict';

// ─── Seed product catalogue ───────────────────────────────────────────────────
// Base products. Each call applies a small random price drift.
const BASE_PRODUCTS = [
  { name: 'Ergonomic Mesh Office Chair',        basePrice: 289.99, category: 'furniture' },
  { name: 'Wireless Noise-Cancelling Headphones', basePrice: 179.00, category: 'electronics' },
  { name: 'Stainless Steel Water Bottle 32oz',  basePrice: 34.95,  category: 'outdoors' },
  { name: 'USB-C Hub 7-in-1',                   basePrice: 49.99,  category: 'electronics' },
  { name: 'Mechanical Keyboard (TKL, Blue)',     basePrice: 119.00, category: 'electronics' },
  { name: 'Portable SSD 1TB',                   basePrice: 89.99,  category: 'electronics' },
  { name: 'Yoga Mat Non-slip 6mm',              basePrice: 28.00,  category: 'fitness' },
  { name: 'Cast Iron Skillet 12"',              basePrice: 39.95,  category: 'kitchen' },
  { name: 'Smart LED Desk Lamp',               basePrice: 54.99,  category: 'furniture' },
  { name: 'French Press Coffee Maker 1L',       basePrice: 24.50,  category: 'kitchen' },
  { name: 'Resistance Bands Set (5-pack)',       basePrice: 19.99,  category: 'fitness' },
  { name: 'Webcam 1080p 60fps',                 basePrice: 74.99,  category: 'electronics' },
  { name: 'Bamboo Cutting Board Large',         basePrice: 22.00,  category: 'kitchen' },
  { name: 'Electric Standing Desk 60"',         basePrice: 499.00, category: 'furniture' },
  { name: 'LED Strip Lights 10m RGB',           basePrice: 16.99,  category: 'furniture' },
  { name: 'Protein Powder Whey 5lb',            basePrice: 59.99,  category: 'fitness' },
  { name: 'Mechanical Pencil Set 0.5mm',        basePrice: 12.50,  category: 'stationery' },
  { name: 'Noise Machine White/Brown',          basePrice: 44.99,  category: 'wellness' },
  { name: 'Wireless Charging Pad 15W',          basePrice: 29.99,  category: 'electronics' },
  { name: 'Minimalist Leather Wallet RFID',     basePrice: 38.00,  category: 'accessories' },
  { name: 'Adjustable Dumbbell Set 5–52 lb',    basePrice: 349.00, category: 'fitness' },
  { name: 'Air Purifier HEPA H13',              basePrice: 129.99, category: 'wellness' },
  { name: 'Standing Desk Mat Anti-fatigue',     basePrice: 69.99,  category: 'furniture' },
  { name: 'Reusable Grocery Bag 6-pack',        basePrice: 14.99,  category: 'outdoors' },
  { name: 'Ceramic Pour-over Coffee Set',       basePrice: 32.00,  category: 'kitchen' },
  { name: 'Compact Travel Tripod',              basePrice: 55.00,  category: 'electronics' },
  { name: 'Insulated Lunch Bag 6L',             basePrice: 21.50,  category: 'outdoors' },
  { name: 'Microfibre Cleaning Cloths 10-pack', basePrice: 9.99,   category: 'household' },
  { name: 'Acupressure Mat and Pillow Set',     basePrice: 35.99,  category: 'wellness' },
  { name: 'Foldable Laptop Stand Aluminium',    basePrice: 29.00,  category: 'electronics' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return a float in [min, max] rounded to 2 dp */
function randBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/** Apply a ±5–15% drift to a base price */
function driftPrice(basePrice) {
  const factor = 1 + (Math.random() * 0.20 - 0.10); // ±10%
  return Math.round(basePrice * factor * 100) / 100;
}

/** Pick n random items from an array (without replacement) */
function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** Build a fake product URL */
function makeUrl(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `https://mock-shop.example.com/products/${slug}`;
}

// ─── Healthy result ───────────────────────────────────────────────────────────

function generateHealthyProducts() {
  const count = Math.floor(randBetween(15, 30));
  const picked = sample(BASE_PRODUCTS, Math.min(count, BASE_PRODUCTS.length));
  const now = new Date().toISOString();

  return picked.map((p) => ({
    product_name: p.name,
    price:        driftPrice(p.basePrice),
    currency:     'USD',
    in_stock:     Math.random() > 0.15, // ~85% in stock
    product_url:  makeUrl(p.name),
    scraped_at:   now,
  }));
}

// ─── Broken shapes (simulate site redesign / extraction failure) ──────────────

const BROKEN_GENERATORS = [
  // 1. Empty array — scraper returned nothing
  () => [],

  // 2. Missing 'price' field entirely
  () =>
    generateHealthyProducts().map(({ price, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 3. Missing 'in_stock' field
  () =>
    generateHealthyProducts().map(({ in_stock, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 4. Wrong type: price is a string (e.g. "$29.99") instead of a number
  () =>
    generateHealthyProducts().map((p) => ({ ...p, price: `$${p.price}` })),

  // 5. Missing 'scraped_at' (common when collector schema changes)
  () =>
    generateHealthyProducts().map(({ scraped_at, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 6. Mixed bag: some healthy, some missing fields (partial extraction)
  () => {
    const products = generateHealthyProducts();
    return products.map((p, i) =>
      i % 3 === 0 ? { product_name: p.product_name, price: p.price } : p
    );
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateMockProducts()
 *
 * Returns an array of product objects matching the data contract.
 * With probability 1/8, intentionally returns a broken result to
 * exercise the heal-detection pipeline.
 *
 * @returns {Array<Object>}
 */
function generateMockProducts() {
  const isBroken = Math.random() < 1 / 8; // ~12.5% chance

  if (isBroken) {
    const brokenIndex = Math.floor(Math.random() * BROKEN_GENERATORS.length);
    const result = BROKEN_GENERATORS[brokenIndex]();
    console.log(`[mock-source] ⚠  Returning BROKEN shape #${brokenIndex + 1} (heal-detection test)`);
    return result;
  }

  const products = generateHealthyProducts();
  console.log(`[mock-source] ✓  Generated ${products.length} healthy products`);
  return products;
}

module.exports = { generateMockProducts };
