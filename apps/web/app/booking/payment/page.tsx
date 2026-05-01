'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking_auth' | 'verifying' | 'success' | 'failed' | 'needs_auth';

function PaymentVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking_auth');
  const [errorMessage, setErrorMessage] = useState('');

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const verify = useCallback(async () => {
    if (!reference) {
      setErrorMessage('No payment reference found in the URL.');
      setStatus('failed');
      return;
    }

    setStatus('verifying');
    setErrorMessage('');

    try {
      const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
      const data = await res.json();

      if (res.status === 401) {
        setStatus('needs_auth');
        return;
      }

      if (!res.ok) {
        setErrorMessage(data.message || 'Payment verification failed.');
        setStatus('failed');
        return;
      }

      if (data.status === 'success' && data.reservation_id) {
        setStatus('success');
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
        setErrorMessage(data.message || `Payment status: ${data.status || 'unknown'}`);
        setStatus('failed');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setStatus('failed');
    }
  }, [reference, router]);

  useEffect(() => {
    async function checkAuthAndVerify() {
      if (!reference) {
        setErrorMessage('No payment reference found in the URL.');
        setStatus('failed');
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus('needs_auth');
        return;
      }

      verify();
    }

    checkAuthAndVerify();
  }, [reference, verify]);

  const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/booking/payment';

  if (status === 'checking_auth' || status === 'verifying') {
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

  if (status === 'needs_auth') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Sign In Required</h1>
          <p className="mt-2 text-sm text-gray-500">
            Please sign in to verify your payment.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(currentUrl)}`}
            className="mt-6 block w-full rounded-lg bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-500"
          >
            Sign In
          </Link>
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
          {errorMessage || 'We couldn\'t verify your payment. Please try again or contact support.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={verify}
            className="w-full rounded-lg bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-500"
          >
            Try Again
          </button>
          <div className="flex gap-3">
            <Link
              href="/restaurants"
              className="flex-1 rounded-lg border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Browse Restaurants
            </Link>
            <Link
              href="/account/bookings"
              className="flex-1 rounded-lg border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              My Bookings
            </Link>
          </div>
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
