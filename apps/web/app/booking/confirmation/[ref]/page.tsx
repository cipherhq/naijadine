import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatTime } from '@dineroot/shared';
import { CalendarButtons } from '@/components/CalendarButtons';

export const metadata: Metadata = {
  title: 'Booking Confirmed',
};

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { ref } = await params;
  const supabase = await createClient();

  // Auth check — redirect unauthenticated users to login
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/booking/confirmation/${encodeURIComponent(ref)}`);
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, restaurants (name, slug, address, neighborhood, city, phone)')
    .eq('reference_code', ref)
    .eq('user_id', user.id)
    .single();

  if (!reservation) notFound();

  const restaurant = reservation.restaurants as {
    name: string;
    slug: string;
    address: string;
    neighborhood: string;
    city: string;
    phone: string;
  } | null;

  const bookingDate = new Date(reservation.date + 'T00:00').toLocaleDateString(
    'en-NG',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
          {/* Success icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">Booking Confirmed!</h1>
          <p className="mt-2 text-gray-500">
            Your reservation has been submitted successfully.
          </p>

          {/* Reference code */}
          <div className="mt-6 rounded-lg bg-brand-50 p-4">
            <p className="text-xs text-gray-500">Reference Code</p>
            <p className="text-2xl font-bold tracking-wider text-brand">
              {reservation.reference_code}
            </p>
          </div>

          {/* Details */}
          <div className="mt-6 space-y-3 text-left text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Restaurant</span>
              <span className="font-medium">{restaurant?.name}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Date</span>
              <span className="font-medium">{bookingDate}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{formatTime(reservation.time)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Guests</span>
              <span className="font-medium">{reservation.party_size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                reservation.status === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {reservation.status}
              </span>
            </div>
            {reservation.deposit_amount > 0 && (
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="text-gray-500">Deposit</span>
                <div className="text-right">
                  <span className="font-medium">{formatNaira(reservation.deposit_amount)}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    reservation.deposit_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : reservation.deposit_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {reservation.deposit_status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {restaurant && (
            <div className="mt-6 rounded-lg bg-gray-50 p-3 text-left text-sm text-gray-600">
              <p className="font-medium text-gray-900">{restaurant.address}</p>
              <p>
                {restaurant.neighborhood},{' '}
                {restaurant.city.replace(/_/g, ' ')}
              </p>
              {restaurant.phone && <p className="mt-1">{restaurant.phone}</p>}
            </div>
          )}

          {/* Add to Calendar */}
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-gray-400">Add to Calendar</p>
            <CalendarButtons
              title={`Dinner at ${restaurant?.name || 'Restaurant'}`}
              description={`DineRoot reservation ${reservation.reference_code} for ${reservation.party_size} guests`}
              location={restaurant ? `${restaurant.address}, ${restaurant.neighborhood}` : ''}
              date={reservation.date}
              time={reservation.time}
            />
          </div>

          {/* Share */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-400">Share with friends</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`I'm dining at ${restaurant?.name} on ${bookingDate} at ${formatTime(reservation.time)}! Book yours on DineRoot: https://dineroot.com/restaurants/${restaurant?.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366] bg-[#25D366]/5 py-2.5 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/10"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Share on WhatsApp
            </a>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/account/bookings"
              className="flex-1 rounded-lg border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              My Bookings
            </Link>
            <Link
              href="/restaurants"
              className="flex-1 rounded-lg bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-500"
            >
              Browse More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
