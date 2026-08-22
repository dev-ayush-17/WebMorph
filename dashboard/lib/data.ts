/**
 * dashboard/lib/data.ts  (v0.3)
 *
 * Server-side data fetching functions.
 * v0.3 additions:
 *   - Extended Product type: price_changed, stock_changed, previous_price
 *   - Extended HealEvent type: attempt_number, heal_method, error_type, duration_ms
 *   - New Run type + getRunHistory() fetches from `runs` table (not derived from products)
 *   - Mock data updated to demonstrate all new fields
 */

import { supabase, isConfigured } from './supabase';

export { isConfigured };

// ─── Types (v0.3 — extended) ──────────────────────────────────────────────────

export type Product = {
  id: string;
  run_id: string;
  product_name: string;
  price: number;
  currency: string;
  in_stock: boolean;
  product_url: string;
  scraped_at: string;
  created_at: string;
  // v0.3 diff fields
  price_changed: boolean;
  stock_changed: boolean;
  previous_price: number | null;
};

export type HealEvent = {
  id: string;
  timestamp: string;
  description: string;
  resolved: boolean;
  created_at: string;
  // v0.3 richer fields
  attempt_number: number;
  heal_method: 'simulated' | 'real';
  error_type: 'empty_result' | 'missing_fields' | 'type_mismatch' | 'cli_auth' | 'collector_gone' | 'unknown';
  duration_ms: number | null;
};

export type Run = {
  id: string;
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'healthy' | 'degraded' | 'failed';
  summary_json: {
    products_found: number;
    price_increases: number;
    price_decreases: number;
    stock_flips: number;
    new_products: number;
    heal_events_total: number;
    heal_events_resolved: number;
    heal_events_unresolved: number;
    duration_ms: number;
  } | null;
  created_at: string;
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

export async function getLatestProducts(): Promise<Product[]> {
  if (!supabase) return getMockProducts();

  const { data: runData, error: runError } = await supabase
    .from('products')
    .select('run_id')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  if (runError || !runData) return getMockProducts();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('run_id', runData.run_id)
    .order('product_name', { ascending: true });

  if (error || !data) {
    console.error('Failed to fetch products:', error);
    return getMockProducts();
  }

  return data as Product[];
}

export async function getHealEvents(): Promise<HealEvent[]> {
  if (!supabase) return getMockHealEvents();

  const { data, error } = await supabase
    .from('heal_events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error || !data) {
    console.error('Failed to fetch heal events:', error);
    return getMockHealEvents();
  }

  return data as HealEvent[];
}

export async function getRunHistory(): Promise<Run[]> {
  if (!supabase) return getMockRuns();

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);

  if (error || !data) {
    console.error('Failed to fetch run history:', error);
    return getMockRuns();
  }

  return data as Run[];
}

// ─── Mock data (v0.3 — demonstrates all new fields) ──────────────────────────

function getMockProducts(): Product[] {
  const now = new Date().toISOString();
  const runId = 'run_mock_local';
  return [
    { id: '1', run_id: runId, product_name: 'Ergonomic Mesh Office Chair',        price: 289.99, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/chair',       scraped_at: now, created_at: now, price_changed: true,  stock_changed: false, previous_price: 319.99 },
    { id: '2', run_id: runId, product_name: 'Wireless Noise-Cancelling Headphones', price: 179.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/headphones',  scraped_at: now, created_at: now, price_changed: false, stock_changed: false, previous_price: 179.00 },
    { id: '3', run_id: runId, product_name: 'USB-C Hub 7-in-1',                   price: 49.99,  currency: 'USD', in_stock: false, product_url: 'https://mock-shop.example.com/products/usb-hub',     scraped_at: now, created_at: now, price_changed: false, stock_changed: true,  previous_price: 49.99  },
    { id: '4', run_id: runId, product_name: 'Mechanical Keyboard TKL',            price: 134.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/keyboard',    scraped_at: now, created_at: now, price_changed: true,  stock_changed: false, previous_price: 119.00 },
    { id: '5', run_id: runId, product_name: 'Portable SSD 1TB',                   price: 89.99,  currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/ssd',         scraped_at: now, created_at: now, price_changed: false, stock_changed: false, previous_price: null   },
    { id: '6', run_id: runId, product_name: 'Smart LED Desk Lamp',                price: 54.99,  currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/lamp',        scraped_at: now, created_at: now, price_changed: false, stock_changed: false, previous_price: 54.99  },
    { id: '7', run_id: runId, product_name: 'Air Purifier HEPA H13',              price: 109.99, currency: 'USD', in_stock: false, product_url: 'https://mock-shop.example.com/products/air-purifier', scraped_at: now, created_at: now, price_changed: true,  stock_changed: true,  previous_price: 129.99 },
    { id: '8', run_id: runId, product_name: 'Electric Standing Desk 60"',         price: 499.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/desk',        scraped_at: now, created_at: now, price_changed: false, stock_changed: false, previous_price: null   },
  ];
}

function getMockHealEvents(): HealEvent[] {
  return [
    {
      id: 'he-1',
      timestamp: new Date(Date.now() - 3_600_000).toISOString(),
      description: 'Collector returned empty array — possible scraper extraction failure',
      resolved: false,
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
      attempt_number: 2,
      heal_method: 'real',
      error_type: 'empty_result',
      duration_ms: 4210,
    },
    {
      id: 'he-2',
      timestamp: new Date(Date.now() - 86_400_000).toISOString(),
      description: "14 validation error(s) across 14 items: item[0]: missing field 'in_stock'",
      resolved: true,
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      attempt_number: 1,
      heal_method: 'real',
      error_type: 'missing_fields',
      duration_ms: 1832,
    },
    {
      id: 'he-3',
      timestamp: new Date(Date.now() - 172_800_000).toISOString(),
      description: 'Collector returned empty array — possible scraper extraction failure',
      resolved: false,
      created_at: new Date(Date.now() - 172_800_000).toISOString(),
      attempt_number: 1,
      heal_method: 'simulated',
      error_type: 'empty_result',
      duration_ms: 0,
    },
  ];
}

function getMockRuns(): Run[] {
  const makeTs = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  return [
    { id: 'r-1', run_id: 'run_mock_1', started_at: makeTs(3_600_000),   finished_at: makeTs(3_597_000),   status: 'degraded', summary_json: { products_found: 23, price_increases: 2, price_decreases: 1, stock_flips: 1, new_products: 0, heal_events_total: 1, heal_events_resolved: 0, heal_events_unresolved: 1, duration_ms: 3100 }, created_at: makeTs(3_600_000) },
    { id: 'r-2', run_id: 'run_mock_2', started_at: makeTs(90_000_000),  finished_at: makeTs(89_996_000),  status: 'healthy',  summary_json: { products_found: 21, price_increases: 0, price_decreases: 3, stock_flips: 0, new_products: 2, heal_events_total: 0, heal_events_resolved: 0, heal_events_unresolved: 0, duration_ms: 4000 }, created_at: makeTs(90_000_000) },
    { id: 'r-3', run_id: 'run_mock_3', started_at: makeTs(176_400_000), finished_at: makeTs(176_395_000), status: 'healthy',  summary_json: { products_found: 25, price_increases: 1, price_decreases: 0, stock_flips: 2, new_products: 5, heal_events_total: 0, heal_events_resolved: 0, heal_events_unresolved: 0, duration_ms: 2800 }, created_at: makeTs(176_400_000) },
  ];
}
