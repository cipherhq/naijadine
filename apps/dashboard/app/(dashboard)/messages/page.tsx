'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  guest_phone: string;
  guest_name: string | null;
  direction: string;
  channel: string;
  message: string;
  status: string;
  created_at: string;
  reservation_id: string | null;
}

interface TodayGuest {
  id: string;
  guest_name: string;
  guest_phone: string;
  reference_code: string;
  time: string;
  status: string;
}

const QUICK_MESSAGES = [
  { label: '🪑 Table Ready', text: 'Hi {name}, your table at {restaurant} is ready! Please come to the host stand.' },
  { label: '⏰ Running Late?', text: 'Hi {name}, we noticed you haven\'t arrived yet for your {time} reservation. Are you still coming? Reply YES to confirm.' },
  { label: '🎂 Happy Birthday', text: 'Happy Birthday {name}! 🎂 We have a special surprise waiting for you at {restaurant}. See you tonight!' },
  { label: '✅ Confirmed', text: 'Hi {name}, your reservation at {restaurant} for tonight at {time} is confirmed. See you soon!' },
  { label: '📍 Directions', text: 'Hi {name}, here are directions to {restaurant}: {address}. Looking forward to seeing you!' },
  { label: '🙏 Thank You', text: 'Thank you for dining at {restaurant}, {name}! We hope you had a wonderful experience. See you again soon!' },
];

export default function MessagesPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [todayGuests, setTodayGuests] = useState<TodayGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<TodayGuest | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0];

    const [{ data: msgs }, { data: guests }] = await Promise.all([
      supabase.from('guest_messages').select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('reservations')
        .select('id, guest_name, guest_phone, reference_code, time, status')
        .eq('restaurant_id', restaurant.id)
        .eq('date', today)
        .in('status', ['confirmed', 'pending', 'seated'])
        .order('time'),
    ]);

    setMessages(msgs || []);
    setTodayGuests((guests || []).filter(g => g.guest_phone) as TodayGuest[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [restaurant.id]);

  async function sendMessage(guest: TodayGuest, text: string) {
    setSending(true);
    const finalText = text
      .replace(/\{name\}/g, guest.guest_name || 'Guest')
      .replace(/\{restaurant\}/g, restaurant.name)
      .replace(/\{time\}/g, guest.time)
      .replace(/\{address\}/g, (restaurant as any).address || '');

    await supabase.from('guest_messages').insert({
      restaurant_id: restaurant.id,
      reservation_id: guest.id,
      guest_phone: guest.guest_phone,
      guest_name: guest.guest_name,
      direction: 'outbound',
      channel: 'whatsapp',
      message: finalText,
      status: 'sent',
    });

    // TODO: Actually send via Gupshup/Termii when API keys are configured
    // For now, just record the message

    setCustomMessage('');
    setSending(false);
    fetchData();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Guest Messages</h1>
      <p className="mt-1 text-sm text-gray-500">Send messages to today&apos;s guests via WhatsApp or SMS</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Today's guests */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Today&apos;s Guests ({todayGuests.length})</h2>
          {todayGuests.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No guests with phone numbers today</p>
          ) : (
            <div className="space-y-2">
              {todayGuests.map(guest => (
                <button key={guest.id} onClick={() => setSelectedGuest(guest)}
                  className={`w-full text-left rounded-xl border p-3 transition hover:shadow-sm ${
                    selectedGuest?.id === guest.id ? 'border-brand bg-brand-50' : 'border-gray-200 bg-white'
                  }`}>
                  <p className="text-sm font-medium text-gray-900">{guest.guest_name}</p>
                  <p className="text-xs text-gray-500">{guest.time} · {guest.reference_code} · <span className="capitalize">{guest.status}</span></p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compose */}
        <div className="lg:col-span-2">
          {selectedGuest ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedGuest.guest_name}</h3>
                  <p className="text-xs text-gray-500">{selectedGuest.guest_phone} · {selectedGuest.time}</p>
                </div>
                <button onClick={() => setSelectedGuest(null)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
              </div>

              {/* Quick message buttons */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-gray-500">Quick Messages</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_MESSAGES.map((qm, i) => (
                    <button key={i} onClick={() => sendMessage(selectedGuest, qm.text)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-brand">
                      {qm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom message */}
              <div className="flex gap-2">
                <input type="text" value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Type a custom message..."
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  onKeyDown={e => e.key === 'Enter' && customMessage && sendMessage(selectedGuest, customMessage)} />
                <button onClick={() => customMessage && sendMessage(selectedGuest, customMessage)}
                  disabled={!customMessage || sending}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                  {sending ? '...' : 'Send'}
                </button>
              </div>

              {/* Message history for this guest */}
              {messages.filter(m => m.guest_phone === selectedGuest.guest_phone).length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-medium text-gray-500">History</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {messages.filter(m => m.guest_phone === selectedGuest.guest_phone).map(m => (
                      <div key={m.id} className={`rounded-lg p-2.5 text-sm ${
                        m.direction === 'outbound' ? 'bg-brand-50 text-gray-900 ml-8' : 'bg-gray-50 text-gray-700 mr-8'
                      }`}>
                        <p>{m.message}</p>
                        <p className="mt-1 text-[10px] text-gray-400">
                          {m.direction === 'outbound' ? 'Sent' : 'Received'} · {new Date(m.created_at).toLocaleTimeString()} · {m.channel}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 py-20">
              <div className="text-center">
                <p className="text-gray-400">Select a guest to send a message</p>
                <p className="mt-1 text-sm text-gray-300">Quick messages like &quot;Table Ready&quot; or &quot;Running Late?&quot;</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
