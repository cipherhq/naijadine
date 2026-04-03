import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatTime } from '@naijadine/shared';

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

          <div className="mt-8 flex gap-3">
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
