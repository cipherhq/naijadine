import { supabase } from './supabase';

/**
 * Optimistic concurrency update — prevents double-seats and race conditions.
 * Only succeeds if the current version matches expected.
 */
export async function updateWithVersion<T>(
  table: 'tables' | 'table_states',
  id: string,
  expectedVersion: number,
  patch: Partial<T>,
): Promise<{ ok: true; row: T } | { ok: false; reason: 'stale' | 'denied' | 'error' }> {
  const { data, error } = await supabase
    .from(table)
    .update({ ...patch, version: expectedVersion + 1 })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single();

  if (error) {
    if (error.code === '42501') return { ok: false, reason: 'denied' };
    return { ok: false, reason: 'error' };
  }
  if (!data) return { ok: false, reason: 'stale' };
  return { ok: true, row: data as T };
}
