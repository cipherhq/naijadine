import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LOYALTY_TIERS } from '@dineroot/shared';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Loyalty & Rewards — DineRoot' };

export default async function LoyaltyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/loyalty');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, loyalty_tier, loyalty_points, total_bookings')
    .eq('id', user.id)
    .single();

  const tier = (profile?.loyalty_tier as keyof typeof LOYALTY_TIERS) || 'bronze';
  const points = profile?.loyalty_points || 0;
  const totalBookings = profile?.total_bookings || 0;
  const tierInfo = LOYALTY_TIERS[tier];

  // Find next tier
  const tiers = Object.entries(LOYALTY_TIERS) as [string, typeof LOYALTY_TIERS[keyof typeof LOYALTY_TIERS]][];
  const currentIdx = tiers.findIndex(([k]) => k === tier);
  const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

  const progressToNext = nextTier
    ? Math.min(100, Math.round((totalBookings / nextTier[1].minBookings) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Loyalty & Rewards</h1>

      {/* Current tier card */}
      <div
        className="mt-6 rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}dd)` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Current Tier</p>
            <p className="text-3xl font-bold">{tierInfo.name}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{points}</p>
            <p className="text-sm opacity-80">points</p>
          </div>
        </div>

        {tierInfo.discountPct > 0 && (
          <div className="mt-4 rounded-lg bg-white/20 px-3 py-2 text-sm">
            You get <strong>{tierInfo.discountPct}% off</strong> every booking!
          </div>
        )}
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Progress to {nextTier[1].name}</span>
            <span className="font-medium">{totalBookings} / {nextTier[1].minBookings} bookings</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressToNext}%`, backgroundColor: nextTier[1].color }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {nextTier[1].minBookings - totalBookings} more bookings to reach {nextTier[1].name} ({nextTier[1].discountPct}% off)
          </p>
        </div>
      )}

      {/* All tiers */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">All Tiers</h2>
        <div className="space-y-3">
          {tiers.map(([key, info]) => (
            <div
              key={key}
              className={`flex items-center justify-between rounded-lg p-3 ${
                key === tier ? 'border-2' : 'border border-gray-100'
              }`}
              style={key === tier ? { borderColor: info.color } : {}}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{info.name}</p>
                  <p className="text-xs text-gray-400">{info.minBookings}+ bookings</p>
                </div>
              </div>
              <span className="text-sm font-medium" style={{ color: info.color }}>
                {info.discountPct > 0 ? `${info.discountPct}% off` : 'Base tier'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">How It Works</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>1. Book and dine at any restaurant on DineRoot</p>
          <p>2. Earn points with every completed reservation</p>
          <p>3. Move up tiers to unlock bigger discounts</p>
          <p>4. Your tier resets annually — keep dining to maintain your level!</p>
        </div>
      </div>
    </div>
  );
}
