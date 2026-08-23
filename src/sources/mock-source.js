/**
 * src/sources/mock-source.js  (v0.4 — Raajkart Physics catalogue)
 *
 * Generates fake product data matching the pipeline data contract exactly:
 *   { product_name, price, currency, in_stock, product_url, scraped_at }
 *
 * v0.4 update: mock data now mirrors the real Raajkart.com target:
 *   - Currency is INR (was USD)
 *   - Product catalogue is Physics textbooks (matches real target category)
 *   - Prices are realistic Indian academic book prices (₹150–₹1200)
 *   - ~73 products (matches the real Physics category size)
 *   - URLs follow raajkart.com slug format
 *
 * This module is the ONLY mock-specific file. Swapping to live mode requires
 * only setting BRIGHTDATA_COLLECTOR_ID + TARGET_URL in .env — no code change.
 */

'use strict';

// ─── Seed product catalogue (Raajkart Physics books) ─────────────────────────
// Represents the real Physics category at raajkart.com/books/college-books.html
// Prices are approximate INR equivalents of typical academic textbook prices.
const BASE_PRODUCTS = [
  {
    name: 'Concepts of Physics Part 1 — H C Verma',
    basePrice: 320,
    slug: 'concepts-of-physics-part-1-hc-verma',
  },
  {
    name: 'Concepts of Physics Part 2 — H C Verma',
    basePrice: 320,
    slug: 'concepts-of-physics-part-2-hc-verma',
  },
  {
    name: 'University Physics — Young & Freedman',
    basePrice: 895,
    slug: 'university-physics-young-freedman',
  },
  {
    name: 'Introduction to Electrodynamics — Griffiths',
    basePrice: 750,
    slug: 'introduction-to-electrodynamics-griffiths',
  },
  {
    name: 'The Feynman Lectures on Physics Vol 1',
    basePrice: 999,
    slug: 'feynman-lectures-on-physics-vol-1',
  },
  {
    name: 'The Feynman Lectures on Physics Vol 2',
    basePrice: 999,
    slug: 'feynman-lectures-on-physics-vol-2',
  },
  {
    name: 'The Feynman Lectures on Physics Vol 3',
    basePrice: 999,
    slug: 'feynman-lectures-on-physics-vol-3',
  },
  { name: 'Optics — Ajoy Ghatak', basePrice: 425, slug: 'optics-ajoy-ghatak' },
  {
    name: 'Classical Mechanics — H Goldstein',
    basePrice: 680,
    slug: 'classical-mechanics-goldstein',
  },
  { name: 'Quantum Mechanics — Griffiths', basePrice: 695, slug: 'quantum-mechanics-griffiths' },
  {
    name: 'Thermal Physics — Kittel & Kroemer',
    basePrice: 580,
    slug: 'thermal-physics-kittel-kroemer',
  },
  {
    name: 'Electricity and Magnetism — Griffiths',
    basePrice: 599,
    slug: 'electricity-magnetism-griffiths',
  },
  { name: 'Nuclear Physics — S B Patel', basePrice: 295, slug: 'nuclear-physics-sb-patel' },
  { name: 'Solid State Physics — Kittel', basePrice: 725, slug: 'solid-state-physics-kittel' },
  {
    name: 'Problems in General Physics — Irodov',
    basePrice: 195,
    slug: 'problems-general-physics-irodov',
  },
  {
    name: 'Engineering Physics — M N Avadhanulu',
    basePrice: 265,
    slug: 'engineering-physics-avadhanulu',
  },
  {
    name: 'Waves and Oscillations — N Subramaniam',
    basePrice: 220,
    slug: 'waves-and-oscillations-subramaniam',
  },
  {
    name: 'Modern Physics — Murugeshan & Kiruthiga',
    basePrice: 285,
    slug: 'modern-physics-murugeshan',
  },
  {
    name: 'Statistical Mechanics — R K Pathria',
    basePrice: 795,
    slug: 'statistical-mechanics-pathria',
  },
  {
    name: 'Mathematical Methods for Physicists — Arfken',
    basePrice: 895,
    slug: 'mathematical-methods-physicists-arfken',
  },
  {
    name: 'Classical Electrodynamics — J D Jackson',
    basePrice: 960,
    slug: 'classical-electrodynamics-jackson',
  },
  { name: 'Quantum Mechanics — L I Schiff', basePrice: 550, slug: 'quantum-mechanics-schiff' },
  {
    name: 'Atomic and Nuclear Physics — S N Ghoshal',
    basePrice: 310,
    slug: 'atomic-nuclear-physics-ghoshal',
  },
  {
    name: 'Electromagnetic Field Theory — Hayt',
    basePrice: 430,
    slug: 'electromagnetic-field-theory-hayt',
  },
  {
    name: 'Physics for Scientists and Engineers — Serway',
    basePrice: 825,
    slug: 'physics-scientists-engineers-serway',
  },
  {
    name: 'Fundamentals of Physics — Halliday Resnick Krane',
    basePrice: 875,
    slug: 'fundamentals-physics-halliday-resnick',
  },
  { name: 'Laser Physics — Saleh & Teich', basePrice: 780, slug: 'laser-physics-saleh-teich' },
  { name: 'Plasma Physics — F F Chen', basePrice: 490, slug: 'plasma-physics-chen' },
  {
    name: 'Astrophysics for Physicists — Choudhuri',
    basePrice: 395,
    slug: 'astrophysics-physicists-choudhuri',
  },
  { name: 'Thermodynamics — P K Nag', basePrice: 350, slug: 'thermodynamics-pk-nag' },
  { name: 'Fluid Mechanics — Frank White', basePrice: 760, slug: 'fluid-mechanics-frank-white' },
  { name: 'Biophysics — Vasantha Pattabhi', basePrice: 275, slug: 'biophysics-vasantha-pattabhi' },
  {
    name: 'Quantum Field Theory — Peskin & Schroeder',
    basePrice: 1150,
    slug: 'quantum-field-theory-peskin-schroeder',
  },
  { name: 'General Relativity — Wald', basePrice: 870, slug: 'general-relativity-wald' },
  {
    name: 'An Introduction to Mechanics — Kleppner',
    basePrice: 620,
    slug: 'introduction-mechanics-kleppner',
  },
  { name: 'Vibrations and Waves — French', basePrice: 280, slug: 'vibrations-waves-french' },
  {
    name: 'A Course of Modern Analysis — Whittaker Watson',
    basePrice: 450,
    slug: 'course-modern-analysis-whittaker',
  },
  {
    name: 'Atomic Spectra and Atomic Structure — Herzberg',
    basePrice: 340,
    slug: 'atomic-spectra-structure-herzberg',
  },
  {
    name: 'Introduction to Quantum Mechanics — Pauling',
    basePrice: 390,
    slug: 'introduction-quantum-mechanics-pauling',
  },
  {
    name: 'Physics of Atoms and Molecules — Bransden',
    basePrice: 660,
    slug: 'physics-atoms-molecules-bransden',
  },
  {
    name: 'Condensed Matter Physics — Marder',
    basePrice: 840,
    slug: 'condensed-matter-physics-marder',
  },
  {
    name: 'Particle Physics — Martin & Shaw',
    basePrice: 555,
    slug: 'particle-physics-martin-shaw',
  },
  {
    name: 'Nuclear and Particle Physics — Burcham',
    basePrice: 610,
    slug: 'nuclear-particle-physics-burcham',
  },
  { name: 'Cosmology — Weinberg', basePrice: 920, slug: 'cosmology-weinberg' },
  {
    name: 'The Physics of Superheroes — Kakalios',
    basePrice: 299,
    slug: 'physics-superheroes-kakalios',
  },
  {
    name: 'Thirty Years That Shook Physics — Gamow',
    basePrice: 175,
    slug: 'thirty-years-shook-physics-gamow',
  },
  { name: 'QED: The Strange Theory — Feynman', basePrice: 250, slug: 'qed-strange-theory-feynman' },
  { name: 'Six Easy Pieces — Feynman', basePrice: 199, slug: 'six-easy-pieces-feynman' },
  { name: 'The Elegant Universe — Greene', basePrice: 320, slug: 'elegant-universe-greene' },
  { name: 'A Brief History of Time — Hawking', basePrice: 275, slug: 'brief-history-time-hawking' },
  { name: "Surely You're Joking Mr Feynman", basePrice: 245, slug: 'surely-youre-joking-feynman' },
  {
    name: 'Gravitation — Misner Thorne Wheeler',
    basePrice: 1200,
    slug: 'gravitation-misner-thorne-wheeler',
  },
  { name: 'Special Relativity — French', basePrice: 310, slug: 'special-relativity-french' },
  { name: 'Spectroscopy — Banwell', basePrice: 340, slug: 'spectroscopy-banwell' },
  {
    name: 'Optical Fiber Communications — Keiser',
    basePrice: 495,
    slug: 'optical-fiber-communications-keiser',
  },
  {
    name: 'Physics of Semiconductor Devices — Sze',
    basePrice: 720,
    slug: 'physics-semiconductor-devices-sze',
  },
  {
    name: 'Magnetism and Magnetic Materials — Coey',
    basePrice: 840,
    slug: 'magnetism-magnetic-materials-coey',
  },
  { name: 'Chaos — James Gleick', basePrice: 285, slug: 'chaos-james-gleick' },
  { name: 'Physics of the Future — Kaku', basePrice: 350, slug: 'physics-future-kaku' },
  { name: 'Applied Physics — S O Pillai', basePrice: 290, slug: 'applied-physics-pillai' },
  {
    name: 'Electronics and Optoelectronics — Wilson',
    basePrice: 575,
    slug: 'electronics-optoelectronics-wilson',
  },
  { name: 'Problems in Physics — V Zubov', basePrice: 165, slug: 'problems-physics-zubov' },
  { name: 'Physique — Perez (French)', basePrice: 410, slug: 'physique-perez' },
  {
    name: 'Cryogenic Engineering — T M Flynn',
    basePrice: 690,
    slug: 'cryogenic-engineering-flynn',
  },
  { name: 'Acoustics — Kinsler & Frey', basePrice: 540, slug: 'acoustics-kinsler-frey' },
  {
    name: 'Geometrical Optics — R S Longhurst',
    basePrice: 320,
    slug: 'geometrical-optics-longhurst',
  },
  { name: 'Crystal Physics — Bhagavantam', basePrice: 230, slug: 'crystal-physics-bhagavantam' },
  {
    name: 'Radiation Detection and Measurement — Knoll',
    basePrice: 780,
    slug: 'radiation-detection-measurement-knoll',
  },
  {
    name: 'Quantum Optics — Walls & Milburn',
    basePrice: 820,
    slug: 'quantum-optics-walls-milburn',
  },
  { name: 'Non-linear Optics — Boyd', basePrice: 740, slug: 'non-linear-optics-boyd' },
  { name: 'Superconductivity — Tinkham', basePrice: 860, slug: 'superconductivity-tinkham' },
  { name: 'Atomic Physics — J B Rajam', basePrice: 260, slug: 'atomic-physics-rajam' },
  { name: 'Quantum Chromodynamics — Muta', basePrice: 690, slug: 'quantum-chromodynamics-muta' },
  { name: 'The Standard Model — Griffiths', basePrice: 580, slug: 'standard-model-griffiths' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/** Apply a ±8% drift to a base price, rounded to nearest 5 (realistic for Indian pricing) */
function driftPrice(basePrice) {
  const factor = 1 + (Math.random() * 0.16 - 0.08);
  const raw = basePrice * factor;
  return Math.round(raw / 5) * 5; // round to nearest ₹5
}

function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function makeUrl(slug) {
  return `https://raajkart.com/books/${slug}-p${Math.floor(Math.random() * 90000 + 10000)}.html`;
}

// ─── Healthy result ───────────────────────────────────────────────────────────

function generateHealthyProducts() {
  // ~73 products matching the real Physics category size
  const count = Math.floor(randBetween(68, 73));
  const picked = sample(BASE_PRODUCTS, Math.min(count, BASE_PRODUCTS.length));
  const now = new Date().toISOString();

  return picked.map((p) => ({
    product_name: p.name,
    price: driftPrice(p.basePrice),
    currency: 'INR', // real target currency
    in_stock: Math.random() > 0.12, // ~88% in stock (textbooks usually available)
    product_url: makeUrl(p.slug),
    scraped_at: now,
  }));
}

// ─── Broken shapes (simulate Bright Data scraper failures) ────────────────────

const BROKEN_GENERATORS = [
  // 1. Empty array — scraper returned nothing (selector drift)
  () => [],

  // 2. Missing 'price' field — site restructured the price element
  () => generateHealthyProducts().map(({ price, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 3. Missing 'in_stock' field — out-of-stock label class name changed
  () => generateHealthyProducts().map(({ in_stock, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 4. Wrong type: price is "Rs 299.00" string instead of number
  //    (typical Bright Data AI extraction failure on Indian price format)
  () => generateHealthyProducts().map((p) => ({ ...p, price: `Rs ${p.price}.00` })),

  // 5. Missing 'scraped_at' field
  () => generateHealthyProducts().map(({ scraped_at, ...rest }) => rest), // eslint-disable-line no-unused-vars

  // 6. Partial: some books missing price+in_stock (pagination cut-off scenario)
  () => {
    const products = generateHealthyProducts();
    return products.map((p, i) =>
      i % 4 === 0
        ? {
            product_name: p.product_name,
            product_url: p.product_url,
            currency: 'INR',
            scraped_at: p.scraped_at,
          }
        : p
    );
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateMockProducts()
 *
 * Returns an array matching the data contract.
 * 1-in-8 chance of returning a deliberately broken shape.
 *
 * @returns {Array<Object>}
 */
function generateMockProducts() {
  const isBroken = Math.random() < 1 / 8;

  if (isBroken) {
    const idx = Math.floor(Math.random() * BROKEN_GENERATORS.length);
    const result = BROKEN_GENERATORS[idx]();
    console.log(`[mock-source] ⚠  Returning BROKEN shape #${idx + 1} (heal-detection test)`);
    return result;
  }

  const products = generateHealthyProducts();
  console.log(
    `[mock-source] ✓  Generated ${products.length} healthy products (Raajkart Physics mock)`
  );
  return products;
}

module.exports = { generateMockProducts };
