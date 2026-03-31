'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function PaymentVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference!)}`);
        const data = await res.json();

        if (data.status === 'success' && data.reservation_id) {
          setStatus('success');
          // Get reservation reference code for redirect
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: reservation } = await supabase
            .from('reservations')
            .select('reference_code')
            .eq('id', data.reservation_id)
            .single();

          if (reservation?.reference_code) {
            setTimeout(() => {
              router.push(`/booking/confirmation/${reservation.reference_code}`);
            }, 2000);
          }
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    }

    verify();
  }, [reference, router]);

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Verifying Payment</h1>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we confirm your payment...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Payment Successful!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Redirecting to your booking confirmation...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Payment Failed</h1>
        <p className="mt-2 text-sm text-gray-500">
          We couldn&apos;t verify your payment. Please try again or contact support.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/restaurants"
            className="flex-1 rounded-lg border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Browse Restaurants
          </Link>
          <Link
            href="/account/bookings"
            className="flex-1 rounded-lg bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-500"
          >
            My Bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      }
    >
      <PaymentVerifyContent />
    </Suspense>
  );
}
