'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  action_channel: string;
  action_template: string;
  is_active: boolean;
  sent_count: number;
  last_sent_at: string | null;
}

const channelIcons: Record<string, string> = {
  whatsapp: '💬',
  email: '📧',
  sms: '📱',
  in_app: '🔔',
};

const triggerLabels: Record<string, string> = {
  no_visit_days: 'Lapsed guest',
  birthday: 'Birthday',
  post_completion: 'After visit',
  vip_booking: 'VIP books',
  no_review: 'No review',
  new_review: 'New review',
};

export default function AutomationsPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAutomations() {
    // Seed defaults if needed
    const { data: existing } = await supabase
      .from('automations')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .limit(1);

    if (!existing || existing.length === 0) {
      // Seed defaults client-side
      const defaults = [
        { name: 'Win Back Lapsed Guests', description: 'Re-engage guests who haven\'t visited in 60 days', trigger_type: 'no_visit_days', trigger_config: { days: 60 }, action_channel: 'whatsapp', action_template: 'Hi {{guest_name}}! We miss you at {{restaurant_name}}. Book now: {{booking_link}}' },
        { name: 'Post-Visit Thank You', description: 'Thank guests 2 hours after their visit', trigger_type: 'post_completion', trigger_config: { hours: 2 }, action_channel: 'whatsapp', action_template: 'Thank you for dining at {{restaurant_name}}, {{guest_name}}!' },
        { name: 'Review Nudge', description: 'Ask for a review 24h after visit', trigger_type: 'no_review', trigger_config: { hours: 24 }, action_channel: 'email', action_template: 'How was your experience at {{restaurant_name}}? Leave a review: {{review_link}}' },
        { name: 'VIP Guest Alert', description: 'Notify staff when a VIP guest books', trigger_type: 'vip_booking', trigger_config: {}, action_channel: 'in_app', action_template: 'VIP guest {{guest_name}} booked for {{date}} at {{time}}' },
        { name: 'Re-engagement', description: 'Reach out to guests inactive for 90 days', trigger_type: 'no_visit_days', trigger_config: { days: 90 }, action_channel: 'email', action_template: 'It\'s been a while, {{guest_name}}! Check our new menu: {{booking_link}}' },
      ];
      await supabase.from('automations').insert(
        defaults.map((d) => ({ ...d, restaurant_id: restaurant.id, is_active: false })),
      );
    }

    const { data } = await supabase
      .from('automations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at');

    setAutomations(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchAutomations(); }, [restaurant.id]);

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('automations').update({ is_active: !current }).eq('id', id);
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a)));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const activeCount = automations.filter((a) => a.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeCount} of {automations.length} automations active &middot; Automated guest engagement
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        Automations send messages to guests automatically based on triggers. Toggle them on to start engaging your guests without lifting a finger.
      </div>

      <div className="mt-6 space-y-4">
        {automations.map((auto) => (
          <div
            key={auto.id}
            className={`rounded-xl border bg-white p-5 transition ${
              auto.is_active ? 'border-green-200 shadow-sm' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{auto.name}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {triggerLabels[auto.trigger_type] || auto.trigger_type}
                  </span>
                  <span className="text-sm">{channelIcons[auto.action_channel] || '📨'}</span>
                </div>
                {auto.description && (
                  <p className="mt-1 text-sm text-gray-500">{auto.description}</p>
                )}
                <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 font-mono">
                  {auto.action_template}
                </div>
                {auto.sent_count > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    {auto.sent_count} sent
                    {auto.last_sent_at && ` · Last: ${new Date(auto.last_sent_at).toLocaleDateString()}`}
                  </p>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleActive(auto.id, auto.is_active)}
                className={`relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  auto.is_active ? 'bg-green-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={auto.is_active}
                aria-label={`Toggle ${auto.name}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    auto.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
