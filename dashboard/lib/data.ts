/**
 * dashboard/lib/data.ts
 *
 * Server-side data fetching functions.
 * These run in Next.js Server Components — never shipped to the browser.
 */

import { supabase, isConfigured } from './supabase';

// Re-export for convenient single-import in page components
export { isConfigured };

// ─── Types matching the Supabase schema ───────────────────────────────────────

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
};

export type HealEvent = {
  id: string;
  timestamp: string;
  description: string;
  resolved: boolean;
  created_at: string;
};

export type RunSummary = {
  run_id: string;
  product_count: number;
  scraped_at: string;
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

/**
 * Fetch the latest batch of products (from the most recent run).
 * Returns mock data if Supabase is not configured.
 */
export async function getLatestProducts(): Promise<Product[]> {
  if (!supabase) {
    return getMockProducts();
  }

  // Get the most recent run_id
  const { data: runData, error: runError } = await supabase
    .from('products')
    .select('run_id')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  if (runError || !runData) {
    return getMockProducts();
  }

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

/**
 * Fetch all heal events, most recent first.
 * Returns empty array if Supabase is not configured.
 */
export async function getHealEvents(): Promise<HealEvent[]> {
  if (!supabase) {
    return getMockHealEvents();
  }

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

/**
 * Fetch a summary of recent pipeline runs.
 */
export async function getRunHistory(): Promise<RunSummary[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('run_id, scraped_at')
    .order('scraped_at', { ascending: false });

  if (error || !data) return [];

  // Group by run_id
  const grouped: Record<string, { count: number; scraped_at: string }> = {};
  for (const row of data) {
    if (!grouped[row.run_id]) {
      grouped[row.run_id] = { count: 0, scraped_at: row.scraped_at };
    }
    grouped[row.run_id].count++;
  }

  return Object.entries(grouped).map(([run_id, v]) => ({
    run_id,
    product_count: v.count,
    scraped_at: v.scraped_at,
  }));
}

// ─── Mock data for local development without Supabase ────────────────────────

function getMockProducts(): Product[] {
  const now = new Date().toISOString();
  const runId = 'run_mock_local';
  return [
    { id: '1', run_id: runId, product_name: 'Ergonomic Mesh Office Chair', price: 289.99, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/ergonomic-mesh-office-chair', scraped_at: now, created_at: now },
    { id: '2', run_id: runId, product_name: 'Wireless Noise-Cancelling Headphones', price: 179.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/wireless-noise-cancelling-headphones', scraped_at: now, created_at: now },
    { id: '3', run_id: runId, product_name: 'USB-C Hub 7-in-1', price: 49.99, currency: 'USD', in_stock: false, product_url: 'https://mock-shop.example.com/products/usb-c-hub-7-in-1', scraped_at: now, created_at: now },
    { id: '4', run_id: runId, product_name: 'Mechanical Keyboard (TKL, Blue)', price: 119.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/mechanical-keyboard-tkl-blue', scraped_at: now, created_at: now },
    { id: '5', run_id: runId, product_name: 'Portable SSD 1TB', price: 89.99, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/portable-ssd-1tb', scraped_at: now, created_at: now },
    { id: '6', run_id: runId, product_name: 'Smart LED Desk Lamp', price: 54.99, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/smart-led-desk-lamp', scraped_at: now, created_at: now },
    { id: '7', run_id: runId, product_name: 'Air Purifier HEPA H13', price: 129.99, currency: 'USD', in_stock: false, product_url: 'https://mock-shop.example.com/products/air-purifier-hepa-h13', scraped_at: now, created_at: now },
    { id: '8', run_id: runId, product_name: 'Electric Standing Desk 60"', price: 499.00, currency: 'USD', in_stock: true,  product_url: 'https://mock-shop.example.com/products/electric-standing-desk-60', scraped_at: now, created_at: now },
  ];
}

function getMockHealEvents(): HealEvent[] {
  return [
    {
      id: 'he-1',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      description: 'Collector returned empty array — possible scraper extraction failure',
      resolved: false,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'he-2',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      description: '14 validation error(s) across 14 items: item[0]: missing field \'in_stock\'; item[1]: missing field \'in_stock\'',
      resolved: true,
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];
}
