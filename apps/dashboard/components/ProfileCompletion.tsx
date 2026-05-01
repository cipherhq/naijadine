'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRestaurant } from './DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Step {
  key: string;
  label: string;
  href: string;
  complete: boolean;
}

export function ProfileCompletion() {
  const restaurant = useRestaurant();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const supabase = createClient();

      const { count: photoCount } = await supabase
        .from('restaurant_photos')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id);

      const { count: menuCount } = await supabase
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id);

      const { count: tableCount } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .in('dining_area_id', (
          await supabase.from('dining_areas').select('id').eq('restaurant_id', restaurant.id)
        ).data?.map((d: { id: string }) => d.id) || []);

      const hours = restaurant.operating_hours;
      const hasHours = hours && Object.keys(hours).length > 0;

      setSteps([
        { key: 'photos', label: 'Upload 3+ photos', href: '/photos', complete: (photoCount || 0) >= 3 },
        { key: 'menu', label: 'Add your menu', href: '/menu', complete: (menuCount || 0) > 0 },
        { key: 'hours', label: 'Set operating hours', href: '/settings', complete: !!hasHours },
        { key: 'tables', label: 'Set up floor plan', href: '/floor-plan', complete: (tableCount || 0) > 0 },
        { key: 'cover', label: 'Add cover photo', href: '/photos', complete: !!restaurant.cover_photo_url },
      ]);
      setLoading(false);
    }
    check();
  }, [restaurant]);

  if (loading) return null;

  const completedCount = steps.filter((s) => s.complete).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  if (progress === 100) return null; // All done, hide the widget

  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Complete Your Profile</h3>
        <span className="text-sm font-bold text-brand">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {completedCount} of {steps.length} steps completed — complete restaurants get 5x more bookings
      </p>

      {/* Steps */}
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              step.complete
                ? 'text-gray-400'
                : 'bg-white text-gray-900 shadow-sm hover:shadow-md border border-gray-100'
            }`}
          >
            {step.complete ? (
              <svg className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-brand" />
            )}
            <span className={step.complete ? 'line-through' : 'font-medium'}>{step.label}</span>
            {!step.complete && (
              <span className="ml-auto text-xs text-brand font-medium">Do it →</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
