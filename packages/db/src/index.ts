import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';

// ═══════════════════════════════════════
// Browser client (uses anon key + RLS)
// ═══════════════════════════════════════
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// ═══════════════════════════════════════
// Server client (uses service role key, bypasses RLS)
// Only use in API routes, Edge Functions, server actions
// ═══════════════════════════════════════
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ═══════════════════════════════════════
// Edge Function client (for Supabase Edge Functions)
// ═══════════════════════════════════════
export function createEdgeClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Re-export types
export type { Database } from './types/database.types';
