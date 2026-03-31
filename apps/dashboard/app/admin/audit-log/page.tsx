'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  user_email: string;
  created_at: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);

  async function fetchLogs() {
    setLoading(true);
    const supabase = createClient();
    const limit = 50;

    let query = supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, details, created_at, profiles:user_id (email)')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (actionFilter) {
      query = query.ilike('action', `%${actionFilter}%`);
    }

    const { data } = await query;

    setEntries(
      (data || []).map((e) => {
        const profileRaw = e.profiles as unknown;
        const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
        return {
          id: e.id,
          action: e.action,
          entity_type: e.entity_type || '—',
          entity_id: e.entity_id || '—',
          details: (e.details as Record<string, unknown>) || {},
          user_email: profile?.email || 'system',
          created_at: e.created_at,
        };
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter]);

  const actionColors: Record<string, string> = {
    restaurant_approved: 'bg-green-100 text-green-700',
    restaurant_rejected: 'bg-red-100 text-red-700',
    user_role_changed: 'bg-blue-100 text-blue-700',
    config_updated: 'bg-purple-100 text-purple-700',
    review_approved: 'bg-green-100 text-green-700',
    review_rejected: 'bg-red-100 text-red-700',
    photo_approved: 'bg-green-100 text-green-700',
    photo_rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">Complete trail of admin actions</p>

      <div className="mt-4">
        <input
          type="text"
          placeholder="Filter by action (e.g. approved, rejected, config)..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No audit log entries</p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      actionColors[e.action] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {e.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      on <span className="font-medium">{e.entity_type}</span>
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(e.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                  <span>By: {e.user_email}</span>
                  <span>Entity: {e.entity_id.slice(0, 8)}...</span>
                  {Object.keys(e.details).length > 0 && (
                    <span className="text-gray-300">
                      {JSON.stringify(e.details).slice(0, 80)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={entries.length < 50}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
