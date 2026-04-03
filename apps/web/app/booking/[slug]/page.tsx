'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatNaira, formatTime, BOOKING_DEFAULTS } from '@naijadine/shared';

type Step = 'details' | 'confirm';

interface TimeSlot {
  time: string;
  available: boolean;
  remaining_seats: number;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  deposit_per_guest: number;
  cover_photo_url: string | null;
  address: string;
  neighborhood: string;
  city: string;
}

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<Step>('details');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Booking fields
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Waitlist state
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + (BOOKING_DEFAULTS.maxAdvanceDays || 30));
  const maxDateStr = maxDate.toISOString().split('T')[0];

  useEffect(() => {
    async function loadRestaurant() {
      const supabase = createClient();
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, deposit_per_guest, cover_photo_url, address, neighborhood, city')
        .eq('slug', slug)
        .in('status', ['active', 'approved'])
        .single();

      if (data) {
        setRestaurant(data);
      }
      setLoading(false);
    }
    loadRestaurant();
  }, [slug]);

  useEffect(() => {
    if (!restaurant || !date) return;

    async function loadSlots() {
      setSlotsLoading(true);
      const supabase = createClient();

      // Use the availability endpoint logic client-side
      const { data: reservations } = await supabase
        .from('reservations')
        .select('time, party_size')
        .eq('restaurant_id', restaurant!.id)
        .eq('date', date)
        .not('status', 'in', '("cancelled","no_show")');

      // Generate basic slots 12:00-22:00
      const generated: TimeSlot[] = [];
      for (let h = 12; h < 22; h++) {
        for (const m of [0, 30]) {
          const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

          let reservedSeats = 0;
          if (reservations) {
            for (const r of reservations) {
              const [rh, rm] = r.time.split(':').map(Number);
              const rStart = rh * 60 + rm;
              const rEnd = rStart + 120;
              const slotMin = h * 60 + m;
              const slotEnd = slotMin + 120;
              if (rStart < slotEnd && rEnd > slotMin) {
                reservedSeats += r.party_size;
              }
            }
          }

          const capacity = 30; // Default
          const remaining = capacity - reservedSeats;

          generated.push({
            time: timeStr,
            available: remaining >= partySize,
            remaining_seats: Math.max(0, remaining),
          });
        }
      }

      setSlots(generated);
      setSlotsLoading(false);
    }

    loadSlots();
  }, [restaurant, date, partySize]);

  async function handleSubmit() {
    if (!restaurant || !date || !time) return;

    setSubmitting(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirect=/booking/${slug}`);
        return;
      }

      const { data: reservation, error: insertError } = await supabase
        .from('reservations')
        .insert({
          restaurant_id: restaurant.id,
          user_id: user.id,
          date,
          time,
          party_size: partySize,
          channel: 'web',
          special_requests: specialRequests || null,
          deposit_amount: (restaurant.deposit_per_guest || 0) * partySize,
          deposit_status: restaurant.deposit_per_guest > 0 ? 'pending' : 'none',
          status: 'pending',
          booking_type: 'instant',
        })
        .select('id, reference_code')
        .single();

      if (insertError) {
        setError('Failed to create booking. The slot may no longer be available.');
        return;
      }

      // Create in-app notification for booking
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'booking_confirmation',
        channel: 'in_app',
        title: 'Booking Submitted',
        body: `Your reservation at ${restaurant.name} on ${new Date(date + 'T00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })} at ${time} for ${partySize} guests has been submitted.`,
        metadata: { reservation_id: reservation.id, reference_code: reservation.reference_code },
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      });

      // If deposit required, redirect to Paystack
      if (depositTotal > 0) {
        const callbackUrl = `${window.location.origin}/booking/payment`;
        const res = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            callback_url: callbackUrl,
          }),
        });

        const paymentData = await res.json();

        if (res.ok && paymentData.authorization_url) {
          window.location.href = paymentData.authorization_url;
          return;
        }

        // Payment init failed — still show confirmation (deposit pending)
        setError('');
      }

      router.push(`/booking/confirmation/${reservation.reference_code}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!restaurant || !date || !waitlistName.trim()) return;
    setJoiningWaitlist(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirect=/booking/${slug}`);
        return;
      }

      await supabase.from('waitlist_entries').insert({
        restaurant_id: restaurant.id,
        user_id: user.id,
        guest_name: waitlistName.trim(),
        guest_phone: waitlistPhone.trim() || null,
        party_size: partySize,
        status: 'waiting',
      });

      setWaitlistSuccess(true);
      setShowWaitlist(false);
    } catch {
      setError('Failed to join waitlist. Please try again.');
    } finally {
      setJoiningWaitlist(false);
    }
  }

  const allSlotsFull = date && !slotsLoading && slots.length > 0 && slots.every((s) => !s.available);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold text-gray-900">Restaurant not found</h1>
        <Link href="/restaurants" className="mt-4 text-brand hover:underline">
          Browse restaurants
        </Link>
      </div>
    );
  }

  const depositTotal = (restaurant.deposit_per_guest || 0) * partySize;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        {/* Restaurant header */}
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-white p-4 border border-gray-100">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-brand-50">
            {restaurant.cover_photo_url ? (
              <img src={restaurant.cover_photo_url} alt={restaurant.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xl font-bold text-brand-200">
                {restaurant.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{restaurant.name}</h1>
            <p className="text-sm text-gray-500">
              {restaurant.neighborhood}, {restaurant.city.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {step === 'details' && (
          <div className="space-y-6 rounded-xl bg-white p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Book a Table</h2>

            {/* Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setTime(''); }}
                min={minDate}
                max={maxDateStr}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Party Size */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Guests</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-50"
                >
                  -
                </button>
                <span className="w-12 text-center text-lg font-semibold">{partySize}</span>
                <button
                  type="button"
                  onClick={() => setPartySize(Math.min(BOOKING_DEFAULTS.maxPartySize, partySize + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Time Slots */}
            {date && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
                {slotsLoading ? (
                  <div className="py-4 text-center text-sm text-gray-400">Loading times...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setTime(slot.time)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            time === slot.time
                              ? 'border-brand bg-brand text-white'
                              : slot.available
                              ? 'border-gray-200 text-gray-700 hover:border-brand hover:text-brand'
                              : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {formatTime(slot.time)}
                        </button>
                      ))}
                    </div>

                    {/* Waitlist option when all slots full */}
                    {allSlotsFull && !waitlistSuccess && (
                      <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                        <p className="text-sm font-medium text-yellow-800">
                          No tables available for this date and party size.
                        </p>
                        {!showWaitlist ? (
                          <button
                            type="button"
                            onClick={() => setShowWaitlist(true)}
                            className="mt-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
                          >
                            Join Waitlist
                          </button>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-yellow-800">Your Name</label>
                              <input
                                type="text"
                                value={waitlistName}
                                onChange={(e) => setWaitlistName(e.target.value)}
                                placeholder="Full name"
                                className="w-full rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                                required
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-yellow-800">Phone (optional)</label>
                              <input
                                type="tel"
                                value={waitlistPhone}
                                onChange={(e) => setWaitlistPhone(e.target.value)}
                                placeholder="+234..."
                                className="w-full rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setShowWaitlist(false)}
                                className="flex-1 rounded-lg border border-yellow-300 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleJoinWaitlist}
                                disabled={joiningWaitlist || !waitlistName.trim()}
                                className="flex-1 rounded-lg bg-yellow-600 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-50"
                              >
                                {joiningWaitlist ? 'Joining...' : 'Join Waitlist'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {waitlistSuccess && (
                      <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
                        You&apos;ve been added to the waitlist! We&apos;ll notify you when a table becomes available.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Special Requests */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Special Requests (optional)
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={2}
                placeholder="Allergies, birthday celebration, seating preference..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                maxLength={500}
              />
            </div>

            <button
              onClick={() => setStep('confirm')}
              disabled={!date || !time}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6 rounded-xl bg-white p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Confirm Booking</h2>

            <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date(date + 'T00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{formatTime(time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guests</span>
                <span className="font-medium">{partySize}</span>
              </div>
              {specialRequests && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Requests</span>
                  <span className="max-w-[200px] text-right font-medium">{specialRequests}</span>
                </div>
              )}
              {depositTotal > 0 && (
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="font-medium text-gray-900">Deposit</span>
                  <span className="font-semibold text-brand">{formatNaira(depositTotal)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {submitting ? 'Booking...' : depositTotal > 0 ? `Pay ${formatNaira(depositTotal)} & Book` : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
