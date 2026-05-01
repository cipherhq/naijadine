'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRestaurant } from './DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Insight {
  type: 'warning' | 'success' | 'info' | 'action';
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

const typeBg: Record<string, string> = {
  warning: 'border-amber-200 bg-amber-50',
  success: 'border-green-200 bg-green-50',
  info: 'border-blue-200 bg-blue-50',
  action: 'border-brand-200 bg-brand-50',
};

export function InsightCards() {
  const restaurant = useRestaurant();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        // Build insights client-side from restaurant data
        const ins: Insight[] = [];

        // Check photo count
        const { count: photoCount } = await supabase
          .from('restaurant_photos')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id);

        if ((photoCount || 0) < 5) {
          ins.push({
            type: 'action',
            icon: '📸',
            title: (photoCount || 0) === 0 ? 'No photos uploaded' : `Only ${photoCount} photos`,
            description: 'Restaurants with 5+ photos get 3x more bookings.',
            action: { label: 'Upload Photos', href: '/photos' },
          });
        }

        // Check today's bookings
        const today = new Date().toISOString().split('T')[0];
        const { data: todayBookings } = await supabase
          .from('reservations')
          .select('id, guest_name, time, party_size')
          .eq('restaurant_id', restaurant.id)
          .eq('date', today)
          .in('status', ['confirmed', 'pending']);

        if (todayBookings && todayBookings.length > 0) {
          const names = todayBookings.filter((b) => b.guest_name).map((b) => b.guest_name);
          ins.push({
            type: 'info',
            icon: '🎯',
            title: `${todayBookings.length} booking${todayBookings.length > 1 ? 's' : ''} today`,
            description: names.length > 0
              ? `Guests: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}`
              : 'Check your reservations page for details.',
            action: { label: 'View', href: '/reservations' },
          });
        } else {
          ins.push({
            type: 'info',
            icon: '📅',
            title: 'No bookings today',
            description: 'Share your DineRoot profile or booking widget to attract more diners.',
            action: { label: 'Get Widget', href: '/settings' },
          });
        }

        // Check no-show rate
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: recent } = await supabase
          .from('reservations')
          .select('status')
          .eq('restaurant_id', restaurant.id)
          .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

        if (recent && recent.length >= 10) {
          const noShows = recent.filter((r) => r.status === 'no_show').length;
          const rate = Math.round((noShows / recent.length) * 100);
          if (rate > 15) {
            ins.push({
              type: 'warning',
              icon: '⚠️',
              title: `${rate}% no-show rate`,
              description: 'Enable deposit collection to reduce no-shows by 60%.',
              action: { label: 'Enable Deposits', href: '/settings' },
            });
          }
        }

        setInsights(ins.slice(0, 4));
      } catch {
        // Silently fail
      }
      setLoading(false);
    }

    load();
  }, [restaurant.id]);

  if (loading || insights.length === 0) return null;

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`rounded-xl border p-4 ${typeBg[insight.type] || typeBg.info}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{insight.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
              <p className="mt-0.5 text-xs text-gray-600">{insight.description}</p>
              {insight.action && (
                <Link
                  href={insight.action.href}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  {insight.action.label} →
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
