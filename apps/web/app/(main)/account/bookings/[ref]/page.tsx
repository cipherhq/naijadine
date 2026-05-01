'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatNaira, formatTime, BOOKING_DEFAULTS } from '@dineroot/shared';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface Reservation {
  id: string;
  reference_code: string;
  restaurant_id: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
  deposit_amount: number;
  deposit_status: string;
  special_requests: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  restaurants: {
    name: string;
    slug: string;
    address: string;
    neighborhood: string;
    city: string;
    phone: string;
    cover_photo_url: string | null;
    cancellation_window_hours: number;
  } | null;
}

interface Review {
  id: string;
  rating: number;
  text: string | null;
  created_at: string;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ref = params.ref as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Review state
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Modify state
  const [showModify, setShowModify] = useState(false);
  const [modDate, setModDate] = useState('');
  const [modTime, setModTime] = useState('');
  const [modPartySize, setModPartySize] = useState(2);
  const [modifying, setModifying] = useState(false);
  const [modSuccess, setModSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/login?redirect=/account/bookings/${ref}`); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('reservations')
        .select('id, reference_code, restaurant_id, date, time, party_size, status, deposit_amount, deposit_status, special_requests, created_at, cancelled_at, cancelled_by, restaurants (name, slug, address, neighborhood, city, phone, cover_photo_url, cancellation_window_hours)')
        .eq('reference_code', ref)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setReservation(data as unknown as Reservation);
        setModDate(data.date);
        setModTime(data.time);
        setModPartySize(data.party_size);

        // Check for existing review
        const { data: review } = await supabase
          .from('reviews')
          .select('id, rating, text, created_at')
          .eq('reservation_id', data.id)
          .maybeSingle();

        if (review) setExistingReview(review);
      }
      setLoading(false);
    }
    load();
  }, [ref, router]);

  async function handleCancel() {
    if (!reservation) return;
    setCancelling(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: 'guest',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', reservation.id);

    if (!error) {
      setReservation({ ...reservation, status: 'cancelled', cancelled_by: 'guest', cancelled_at: new Date().toISOString() });
    }
    setCancelling(false);
    setShowCancel(false);
  }

  async function handleSubmitReview() {
    if (!reservation || !userId || reviewRating === 0) return;
    setSubmittingReview(true);

    const supabase = createClient();
    const { error } = await supabase.from('reviews').insert({
      reservation_id: reservation.id,
      user_id: userId,
      restaurant_id: reservation.restaurant_id,
      rating: reviewRating,
      text: reviewText.trim() || null,
      is_public: true,
    });

    if (!error) {
      setExistingReview({
        id: 'new',
        rating: reviewRating,
        text: reviewText.trim() || null,
        created_at: new Date().toISOString(),
      });
      setShowReviewForm(false);
      setReviewSuccess(true);
    }
    setSubmittingReview(false);
  }

  async function handleModify() {
    if (!reservation) return;
    setModifying(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('reservations')
      .update({
        date: modDate,
        time: modTime,
        party_size: modPartySize,
      })
      .eq('id', reservation.id);

    if (!error) {
      setReservation({ ...reservation, date: modDate, time: modTime, party_size: modPartySize });
      setShowModify(false);
      setModSuccess(true);
      setTimeout(() => setModSuccess(false), 3000);
    }
    setModifying(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <h1 className="text-xl font-bold text-gray-900">Booking not found</h1>
        <Link href="/account/bookings" className="mt-3 text-sm text-brand hover:underline">Back to bookings</Link>
      </div>
    );
  }

  const r = reservation;
  const restaurant = r.restaurants;
  const bookingDate = new Date(r.date + 'T00:00').toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const canCancel = ['pending', 'confirmed'].includes(r.status);
  const canModify = ['pending', 'confirmed'].includes(r.status);
  const canReview = r.status === 'completed' && !existingReview;

  // Check if within cancellation window
  const reservationDateTime = new Date(`${r.date}T${r.time}:00`);
  const hoursUntil = (reservationDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const windowHours = restaurant?.cancellation_window_hours || 4;
  const withinWindow = hoursUntil > windowHours;

  // Min date for modify = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + (BOOKING_DEFAULTS.maxAdvanceDays || 30));
  const maxDateStr = maxDate.toISOString().split('T')[0];

  // Generate time options for modify
  const timeOptions: string[] = [];
  for (let h = 12; h < 22; h++) {
    for (const m of [0, 30]) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    seated: 'bg-blue-100 text-blue-800',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-red-100 text-red-700',
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/account/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to bookings
      </Link>

      {modSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Booking updated successfully.
        </div>
      )}

      {/* Restaurant header */}
      <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-brand-50">
          {restaurant?.cover_photo_url ? (
            <img src={restaurant.cover_photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xl font-bold text-brand-200">
              {restaurant?.name?.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">{restaurant?.name}</h1>
          <p className="text-sm text-gray-500">{restaurant?.neighborhood}, {restaurant?.city?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Status + reference */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
        <div>
          <p className="text-xs text-gray-400">Reference</p>
          <p className="text-lg font-bold tracking-wider text-brand">{r.reference_code}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100'}`}>
          {r.status}
        </span>
      </div>

      {/* Details */}
      <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-white p-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Date</span>
          <span className="font-medium">{bookingDate}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Time</span>
          <span className="font-medium">{formatTime(r.time)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Guests</span>
          <span className="font-medium">{r.party_size}</span>
        </div>
        {r.special_requests && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Special Requests</span>
            <span className="max-w-[200px] text-right font-medium">{r.special_requests}</span>
          </div>
        )}
        {r.deposit_amount > 0 && (
          <div className="flex justify-between border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-500">Deposit</span>
            <div className="text-right">
              <span className="font-medium">{formatNaira(r.deposit_amount)}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                r.deposit_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {r.deposit_status}
              </span>
            </div>
          </div>
        )}
        {r.cancelled_at && (
          <div className="flex justify-between border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-500">Cancelled</span>
            <span className="font-medium text-red-600">
              {new Date(r.cancelled_at).toLocaleDateString('en-NG')} by {r.cancelled_by}
            </span>
          </div>
        )}
      </div>

      {/* Address */}
      {restaurant?.address && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900">{restaurant.address}</p>
          <p>{restaurant.neighborhood}, {restaurant.city?.replace(/_/g, ' ')}</p>
          {restaurant.phone && <p className="mt-1">{restaurant.phone}</p>}
        </div>
      )}

      {/* Modify Booking */}
      {canModify && (
        <div className="mt-6">
          {!showModify ? (
            <button
              onClick={() => setShowModify(true)}
              className="w-full rounded-lg border border-brand bg-white py-3 text-sm font-semibold text-brand hover:bg-brand-50"
            >
              Modify Booking
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Reschedule Booking</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">New Date</label>
                  <input
                    type="date"
                    value={modDate}
                    onChange={(e) => setModDate(e.target.value)}
                    min={minDate}
                    max={maxDateStr}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">New Time</label>
                  <select
                    value={modTime}
                    onChange={(e) => setModTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Party Size</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setModPartySize(Math.max(1, modPartySize - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-lg hover:bg-gray-50"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-semibold">{modPartySize}</span>
                    <button
                      type="button"
                      onClick={() => setModPartySize(Math.min(BOOKING_DEFAULTS.maxPartySize, modPartySize + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-lg hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => { setShowModify(false); setModDate(r.date); setModTime(r.time); setModPartySize(r.party_size); }}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModify}
                  disabled={modifying || (modDate === r.date && modTime === r.time && modPartySize === r.party_size)}
                  className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {modifying ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Booking */}
      {canCancel && (
        <div className="mt-3">
          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full rounded-lg border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Cancel Booking
            </button>
          ) : (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                {withinWindow
                  ? 'Are you sure you want to cancel this reservation?'
                  : `Cancellation window has passed (${windowHours}h before). You may still cancel, but the deposit may not be refunded.`}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing Review */}
      {existingReview && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Your Review</h3>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`h-5 w-5 ${star <= existingReview.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          {existingReview.text && (
            <p className="mt-2 text-sm text-gray-600">{existingReview.text}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Submitted {new Date(existingReview.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Review Form */}
      {canReview && !reviewSuccess && (
        <div className="mt-6">
          {!showReviewForm ? (
            <button
              onClick={() => setShowReviewForm(true)}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Leave a Review
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">How was your experience?</h3>

              {/* Star Rating */}
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-0.5"
                  >
                    <svg
                      className={`h-8 w-8 transition ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-200'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewRating]}
                </p>
              )}

              {/* Review Text */}
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                placeholder="Tell others about your dining experience (optional)"
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                maxLength={1000}
              />

              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewText(''); }}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview || reviewRating === 0}
                  className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {reviewSuccess && !existingReview && (
        <div className="mt-6 rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
          Thank you for your review!
        </div>
      )}
    </div>
  );
}
