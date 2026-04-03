'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface Broadcast {
  id: string;
  channel: string;
  audience: string;
  subject: string;
  body: string;
  recipient_count: number;
  status: string;
  created_at: string;
}

export default function AdminCommunicationsPage() {
  const { verified } = useAdminGuard();
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    channel: 'email',
    audience: 'all_users',
    subject: '',
    body: '',
  });

  async function fetchHistory() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcasts')
      .select('id, channel, audience, subject, body, recipient_count, status, created_at')
      .is('restaurant_id', null) // Platform-wide broadcasts
      .order('created_at', { ascending: false })
      .limit(50);

    setHistory(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (verified && tab === 'history') fetchHistory();
  }, [tab, verified]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!verified || !form.subject || !form.body) return;
    setSending(true);

    const supabase = createClient();

    // Count recipients based on audience
    let count = 0;
    if (form.audience === 'all_users') {
      const { count: c } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      count = c || 0;
    } else if (form.audience === 'restaurant_owners') {
      const { count: c } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'restaurant_owner');
      count = c || 0;
    } else if (form.audience === 'diners') {
      const { count: c } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'diner');
      count = c || 0;
    }

    await supabase.from('broadcasts').insert({
      restaurant_id: null, // Platform-wide
      channel: form.channel,
      audience: form.audience,
      subject: form.subject,
      body: form.body,
      recipient_count: count,
      status: 'queued',
    });

    setSending(false);
    setSent(true);
    setForm({ channel: 'email', audience: 'all_users', subject: '', body: '' });
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Communications</h1>
      <p className="mt-1 text-sm text-gray-500">Send announcements to all users</p>

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        <button
          onClick={() => setTab('compose')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            tab === 'compose' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Compose
        </button>
        <button
          onClick={() => setTab('history')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            tab === 'history' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Sent History
        </button>
      </div>

      {tab === 'compose' ? (
        <form onSubmit={handleSend} className="mt-6 max-w-xl space-y-4">
          {sent && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Platform broadcast queued!
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
            <div className="flex gap-2">
              {['email', 'sms', 'push'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setForm({ ...form, channel: ch })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium uppercase ${
                    form.channel === ch
                      ? 'border-brand bg-brand-50 text-brand'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="all_users">All users</option>
              <option value="diners">Diners only</option>
              <option value="restaurant_owners">Restaurant owners only</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. New Feature Announcement"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={6}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sending || !form.subject || !form.body}
            className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Platform Broadcast'}
          </button>
        </form>
      ) : (
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-400">No platform broadcasts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((b) => (
                <div key={b.id} className="rounded-xl border border-gray-100 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{b.subject}</h3>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{b.body}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">{b.channel}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs capitalize text-blue-700">{b.audience?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span>{b.recipient_count} recipients</span>
                    <span className="capitalize">{b.status}</span>
                    <span>
                      {new Date(b.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
