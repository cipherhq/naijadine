'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  category: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

const statusOptions = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function AdminSupportPage() {
  const { verified } = useAdminGuard();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');

  async function fetchTickets() {
    const supabase = createClient();
    let query = supabase
      .from('support_tickets')
      .select('id, subject, body, status, priority, category, created_at, updated_at, profiles:user_id (email)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;

    setTickets(
      (data || []).map((t) => {
        const profileRaw = t.profiles as unknown;
        const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
        return {
          id: t.id,
          subject: t.subject,
          body: t.body,
          status: t.status,
          priority: t.priority || 'medium',
          category: t.category || 'general',
          user_email: profile?.email || '—',
          created_at: t.created_at,
          updated_at: t.updated_at,
        };
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (verified) fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, verified]);

  async function updateTicketStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from('support_tickets').update({ status }).eq('id', id);
    fetchTickets();
    if (selectedTicket?.id === id) {
      setSelectedTicket({ ...selectedTicket, status });
    }
  }

  async function sendReply() {
    if (!selectedTicket || !reply) return;
    const supabase = createClient();
    await supabase.from('support_ticket_replies').insert({
      ticket_id: selectedTicket.id,
      body: reply,
      is_admin: true,
    });

    // Auto-set to in_progress if open
    if (selectedTicket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selectedTicket.id);
    }

    setReply('');
    fetchTickets();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
              statusFilter === s ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {!verified || loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No support tickets</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`cursor-pointer rounded-xl border bg-white p-4 transition hover:shadow-sm ${
                selectedTicket?.id === t.id ? 'border-brand' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{t.subject}</h3>
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">{t.body}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColors[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                    {t.priority}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600">
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                <span>{t.user_email}</span>
                <span>{t.category}</span>
                <span>
                  {new Date(t.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              {selectedTicket?.id === t.id && (
                <div className="mt-4 border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.body}</p>

                  <div className="mt-4 flex gap-2">
                    {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateTicketStatus(t.id, s)}
                        disabled={t.status === s}
                        className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                          t.status === s ? 'bg-gray-200 text-gray-400' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="Reply to this ticket..."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
