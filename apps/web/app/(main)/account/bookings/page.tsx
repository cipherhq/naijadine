import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatTime } from '@dineroot/shared';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Bookings — DineRoot' };

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirect=/account/bookings');

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, reference_code, date, time, party_size, status, deposit_amount, deposit_status, created_at, restaurants (name, slug, cover_photo_url, neighborhood, city)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(50);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = (reservations || []).filter((r) => r.date >= today && !['cancelled', 'no_show'].includes(r.status));
  const past = (reservations || []).filter((r) => r.date < today || ['cancelled', 'no_show'].includes(r.status));

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    seated: 'bg-blue-100 text-blue-800',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-red-100 text-red-700',
  };

  function BookingCard({ booking }: { booking: typeof reservations extends (infer T)[] | null ? T : never }) {
    const restaurantRaw = booking.restaurants as unknown;
    const restaurant = (Array.isArray(restaurantRaw) ? restaurantRaw[0] : restaurantRaw) as { name: string; slug: string; cover_photo_url: string | null; neighborhood: string; city: string } | null;
    const bookingDate = new Date(booking.date + 'T00:00').toLocaleDateString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });

    return (
      <Link
        href={`/account/bookings/${booking.reference_code}`}
        className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4 transition hover:border-brand-100 hover:shadow-sm"
      >
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-brand-50">
          {restaurant?.cover_photo_url ? (
            <img src={restaurant.cover_photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-lg font-bold text-brand-200">
              {restaurant?.name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{restaurant?.name}</h3>
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[booking.status] || 'bg-gray-100 text-gray-600'}`}>
              {booking.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{bookingDate} at {formatTime(booking.time)}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>{booking.party_size} guests</span>
            <span>Ref: {booking.reference_code}</span>
            {booking.deposit_amount > 0 && (
              <span className={booking.deposit_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                {formatNaira(booking.deposit_amount)} {booking.deposit_status}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <Link href="/restaurants" className="text-sm font-medium text-brand hover:underline">
          Book a Table
        </Link>
      </div>

      {/* Upcoming */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">No upcoming reservations</p>
            <Link href="/restaurants" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              Browse Restaurants
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Past ({past.length})</h2>
          <div className="space-y-3">
            {past.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
