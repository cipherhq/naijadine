'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Broadcast {
  id: string;
  channel: string;
  subject: string;
  body: string;
  recipient_count: number;
  status: string;
  created_at: string;
}

export default function CommunicationsPage() {
  const restaurant = useRestaurant();
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    channel: 'email',
    audience: 'all_guests',
    subject: '',
    body: '',
  });

  useEffect(() => {
    if (tab === 'history') {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function fetchHistory() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcasts')
      .select('id, channel, subject, body, recipient_count, status, created_at')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(30);

    setHistory(data || []);
    setLoading(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject || !form.body) return;
    setSending(true);

    const supabase = createClient();

    // Count recipients
    let recipientQuery = supabase
      .from('reservations')
      .select('guest_email', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .not('guest_email', 'is', null);

    if (form.audience === 'recent') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      recipientQuery = recipientQuery.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
    }

    const { count } = await recipientQuery;

    // Save broadcast record
    await supabase.from('broadcasts').insert({
      restaurant_id: restaurant.id,
      channel: form.channel,
      audience: form.audience,
      subject: form.subject,
      body: form.body,
      recipient_count: count || 0,
      status: 'queued',
    });

    setSending(false);
    setSent(true);
    setForm({ channel: 'email', audience: 'all_guests', subject: '', body: '' });
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Communications</h1>

      {/* Tabs */}
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
              Broadcast queued successfully!
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
            <div className="flex gap-2">
              {['email', 'sms', 'whatsapp'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setForm({ ...form, channel: ch })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize ${
                    form.channel === ch
                      ? 'border-brand bg-brand-50 text-brand'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {ch === 'whatsapp' ? 'WhatsApp' : ch.toUpperCase()}
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
              <option value="all_guests">All past guests</option>
              <option value="recent">Recent guests (last 30 days)</option>
              <option value="vip">VIP guests (10+ visits)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. New Menu Launch!"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write your message..."
              rows={6}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              required
            />
          </div>

          {/* Templates */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'New Menu', body: `We're excited to announce our new menu at ${restaurant.name}! Come try our latest dishes.` },
                { label: 'Special Event', body: `You're invited to a special event at ${restaurant.name}. Book your table now!` },
                { label: 'Thank You', body: `Thank you for dining with us at ${restaurant.name}. We hope to see you again soon!` },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setForm({ ...form, subject: t.label, body: t.body })}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-brand hover:text-brand"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || !form.subject || !form.body}
            className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Broadcast'}
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
              <p className="text-sm text-gray-400">No broadcasts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{b.subject}</h3>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{b.body}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                      {b.channel}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span>{b.recipient_count} recipients</span>
                    <span className="capitalize">{b.status}</span>
                    <span>
                      {new Date(b.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
