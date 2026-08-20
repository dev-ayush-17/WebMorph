/**
 * dashboard/lib/supabase.ts
 *
 * Supabase client singleton for the dashboard.
 * Uses the public anon key — reads are public, which is fine for this dashboard.
 * Credentials come from NEXT_PUBLIC_* env vars set at build/runtime.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * In development (before real credentials), return a null-safe stub so
 * the dashboard renders with empty state rather than crashing.
 */
function isConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

export const supabase = isConfigured()
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export { isConfigured };
