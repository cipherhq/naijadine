'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { OtpInput } from '@/components/auth/OtpInput';
import { CITIES, PRICING, formatNaira } from '@naijadine/shared';
import type { User } from '@supabase/supabase-js';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_GUPSHUP_WHATSAPP_NUMBER || '2349XXXXXXXXX';
const standalone = PRICING.whatsapp_standalone;

type WizardStep = 'auth' | 'details' | 'persona' | 'plan' | 'success';
type AuthSubStep = 'phone' | 'otp';
type AuthMode = 'phone' | 'email';

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get('plan') as 'starter' | 'professional' | null;
  const successRestaurantId = searchParams.get('restaurant_id');
  const successStep = searchParams.get('step');

  const [step, setStep] = useState<WizardStep>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth state
  const [authMode, setAuthMode] = useState<AuthMode>('phone');
  const [authStep, setAuthStep] = useState<AuthSubStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pinId, setPinId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Restaurant details
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');

  // Bot persona
  const [botAlias, setBotAlias] = useState('');
  const [botGreeting, setBotGreeting] = useState('');

  // Plan & payment
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional'>(preselectedPlan || 'starter');
  const [restaurantId, setRestaurantId] = useState('');
  const [botCode, setBotCode] = useState('');

  // Success state
  const [successData, setSuccessData] = useState<{ bot_code: string; restaurant_id: string } | null>(null);

  // Check auth on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser(u);
        // If returning from Paystack with success step, go to success
        if (successStep === 'success' && successRestaurantId) {
          setRestaurantId(successRestaurantId);
          setStep('success');
        } else {
          setStep('details');
        }
      }
      setLoading(false);
    });
  }, [successStep, successRestaurantId]);

  // Handle Paystack callback — verify payment on success step
  useEffect(() => {
    if (step !== 'success' || successData) return;
    if (!successRestaurantId) return;

    const ref = searchParams.get('reference') || searchParams.get('trxref');
    // Call verify with whatever we have — reference, restaurant_id, or both
    verifyPayment(ref || '', successRestaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, successRestaurantId]);

  async function loadBotCode(rid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('restaurants')
      .select('bot_code')
      .eq('id', rid)
      .single();
    if (data?.bot_code) {
      setSuccessData({ bot_code: data.bot_code, restaurant_id: rid });
    }
  }

  async function verifyPayment(reference: string, rid?: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference || undefined,
          restaurant_id: rid || successRestaurantId || restaurantId,
          plan: selectedPlan,
        }),
      });
      const data = await res.json();
      if (data.bot_code) {
        setSuccessData({ bot_code: data.bot_code, restaurant_id: data.restaurant_id });
        setBotCode(data.bot_code);
      } else {
        setError(data.message || 'Payment verification failed');
      }
    } catch {
      setError('Failed to verify payment');
    } finally {
      setLoading(false);
    }
  }

  // ── Auth Handlers ──

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setAuthLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to send OTP'); return; }
      setPinId(data.pin_id);
      setAuthStep('otp');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setAuthLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, pin_id: pinId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Invalid OTP'); return; }

      // Establish client session
      const supabase = createClient();
      await supabase.auth.signInWithOtp({ phone });

      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      setStep('details');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Email Signup Handler ──

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (signUpData.session) {
        // Session established — move to restaurant details
        setUser(signUpData.user);
        setStep('details');
      } else if (signUpData.user) {
        // User created but email confirmation required
        setError('We sent a confirmation link to your email. Please verify, then sign in.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Registration Handler ──

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !city || !neighborhood || !address || !restaurantPhone) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          city,
          neighborhood,
          address,
          phone: restaurantPhone,
          plan: selectedPlan,
          bot_alias: botAlias || undefined,
          bot_greeting: botGreeting || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed'); return; }

      setRestaurantId(data.restaurant_id);
      setBotCode(data.bot_code);
      setStep('plan');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Payment Handler ──

  async function handlePay() {
    if (!restaurantId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Payment initialization failed'); return; }

      // Redirect to Paystack
      window.location.href = data.authorization_url;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator ──

  const steps: { key: WizardStep; label: string }[] = [
    { key: 'auth', label: 'Sign Up' },
    { key: 'details', label: 'Restaurant' },
    { key: 'persona', label: 'Persona' },
    { key: 'plan', label: 'Pay' },
    { key: 'success', label: 'Live!' },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  if (loading && step === 'auth') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  const cityOptions = Object.entries(CITIES).map(([key, val]) => ({ value: key, label: val.name }));
  const neighborhoodOptions = city && CITIES[city as keyof typeof CITIES]
    ? CITIES[city as keyof typeof CITIES].neighborhoods.map(n => ({ value: n, label: n }))
    : [];

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(successData?.bot_code || botCode)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-brand">
            NaijaDine
          </Link>
          <span className="text-sm text-gray-500">WhatsApp Automation Setup</span>
        </div>
      </header>

      {/* Step indicator */}
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    i <= stepIndex
                      ? 'bg-brand text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < stepIndex ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="mt-1 hidden text-xs text-gray-500 sm:block">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-0.5 w-8 sm:w-16 ${i < stepIndex ? 'bg-brand' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-medium underline">Dismiss</button>
          </div>
        )}

        {/* ── Step 1: Auth ── */}
        {step === 'auth' && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Create Your Account</h2>

            {/* Auth mode toggle */}
            <div className="mt-4 flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => { setAuthMode('phone'); setError(''); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  authMode === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Phone
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('email'); setError(''); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  authMode === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Email
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {authMode === 'email'
                ? 'Sign up with your email and password'
                : authStep === 'phone'
                  ? 'Enter your phone number to get started'
                  : `We sent a 6-digit code to ${phone}`}
            </p>

            {authMode === 'email' ? (
              <form onSubmit={handleEmailSignup} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!email || !password || authLoading}
                  className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {authLoading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>
            ) : authStep === 'phone' ? (
              <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
                  <PhoneInput value={phone} onChange={setPhone} disabled={authLoading} />
                </div>
                <button
                  type="submit"
                  disabled={!phone || authLoading}
                  className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {authLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <OtpInput value={otp} onChange={setOtp} disabled={authLoading} />
                <button
                  type="submit"
                  disabled={otp.length !== 6 || authLoading}
                  className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {authLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthStep('phone'); setOtp(''); setError(''); }}
                  className="w-full text-center text-sm text-gray-500 hover:text-brand"
                >
                  Change phone number
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login?redirect=/whatsapp/get-started" className="font-medium text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* ── Step 2: Restaurant Details ── */}
        {step === 'details' && (
          <form
            onSubmit={(e) => { e.preventDefault(); setStep('persona'); }}
            className="rounded-xl bg-white p-6 shadow-sm border border-gray-100"
          >
            <h2 className="text-xl font-semibold text-gray-900">Restaurant Details</h2>
            <p className="mt-1 text-sm text-gray-500">Tell us about your restaurant</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Restaurant Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bukka Hut & Grill"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">City *</label>
                  <select
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setNeighborhood(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    required
                  >
                    <option value="">Select city</option>
                    {cityOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Neighborhood *</label>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    required
                    disabled={!city}
                  >
                    <option value="">Select area</option>
                    {neighborhoodOptions.map(n => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 12 Admiralty Way, Lekki Phase 1"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Restaurant Phone *</label>
                <PhoneInput value={restaurantPhone} onChange={setRestaurantPhone} />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={!name || !city || !neighborhood || !address || !restaurantPhone}
                className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Bot Persona ── */}
        {step === 'persona' && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Automation Persona</h2>
            <p className="mt-1 text-sm text-gray-500">
              Customize how your WhatsApp assistant greets guests (optional)
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Assistant Name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={botAlias}
                  onChange={(e) => setBotAlias(e.target.value)}
                  placeholder="e.g. Sarah, Chef John"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Give your assistant a personality. Guests will chat with &quot;{botAlias || 'your assistant'}&quot;.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Custom Greeting <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={botGreeting}
                  onChange={(e) => setBotGreeting(e.target.value)}
                  placeholder={`Welcome to ${name || 'your restaurant'}! 🍽️ I can help you book a table. When would you like to dine?`}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Live preview */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Chat Preview</p>
                <div className="mx-auto max-w-xs overflow-hidden rounded-xl shadow-md">
                  <div className="flex items-center gap-3 px-3 py-2" style={{ backgroundColor: '#075E54' }}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                      {(botAlias || name || 'ND').charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{botAlias || name || 'NaijaDine'}</p>
                      <p className="text-[10px] text-green-200">online</p>
                    </div>
                  </div>
                  <div className="space-y-2 p-3" style={{ backgroundColor: '#ECE5DD' }}>
                    <div className="flex justify-start">
                      <div className="max-w-[85%] whitespace-pre-line rounded-lg bg-white px-3 py-2 text-xs text-gray-800">
                        {botGreeting || `Welcome to ${name || 'your restaurant'}! 🍽️ I can help you book a table. When would you like to dine?`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={loading || !name || !city || !neighborhood || !address || !restaurantPhone}
                className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Plan & Pay ── */}
        {step === 'plan' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
              <p className="mt-1 text-sm text-gray-500">Select a plan to activate your WhatsApp automation</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Starter */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('starter')}
                  className={`rounded-xl border-2 p-5 text-left transition ${
                    selectedPlan === 'starter'
                      ? 'border-brand bg-brand-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="text-sm font-semibold text-gray-900">{standalone.starter.name}</h3>
                  <p className="mt-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatNaira(standalone.starter.price as number)}
                    </span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2">
                    {['Up to 100 bookings/month', 'WhatsApp automation', 'Reservation dashboard', 'NaijaDine branding'].map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Professional */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('professional')}
                  className={`relative rounded-xl border-2 p-5 text-left transition ${
                    selectedPlan === 'professional'
                      ? 'border-brand bg-brand-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="absolute -top-2.5 right-3 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-medium text-white">
                    Most Popular
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">{standalone.professional.name}</h3>
                  <p className="mt-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatNaira(standalone.professional.price as number)}
                    </span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2">
                    {['Unlimited bookings', 'White-label (your brand)', 'Custom persona', 'Priority support', 'Advanced analytics'].map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('persona')}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={loading}
                className="flex-1 rounded-lg bg-gold py-3 text-sm font-semibold text-brand-800 transition hover:bg-gold-400 disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Pay ${formatNaira((standalone[selectedPlan].price as number))} with Paystack`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Success ── */}
        {step === 'success' && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 text-center">
            {loading ? (
              <div className="py-12">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
                <p className="mt-4 text-sm text-gray-500">Verifying payment...</p>
              </div>
            ) : successData ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-gray-900">Your Automation is Live!</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Share this link with guests to start taking bookings
                </p>

                {/* WhatsApp Link */}
                <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
                  <p className="text-xs font-medium text-green-800 uppercase">Your WhatsApp Booking Link</p>
                  <p className="mt-2 break-all text-sm font-mono text-green-900">
                    {waLink}
                  </p>
                </div>

                {/* QR Code */}
                <div className="mt-6">
                  <QRCodeDisplay value={waLink} />
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(waLink)}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Copy Link
                  </button>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    Test on WhatsApp
                  </a>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      type="button"
                      onClick={() => navigator.share({ title: 'Book a table', url: waLink })}
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Share
                    </button>
                  )}
                </div>

                <div className="mt-8 border-t pt-6">
                  <Link
                    href="/account"
                    className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-12">
                <p className="text-sm text-gray-500">
                  {error || 'Something went wrong. Please contact support.'}
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('plan'); setError(''); }}
                  className="mt-4 text-sm font-medium text-brand hover:underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QRCodeDisplay({ value }: { value: string }) {
  const [loaded, setLoaded] = useState(false);
  const componentRef = useRef<React.ComponentType<{ value: string; size: number; level: string }> | null>(null);

  useEffect(() => {
    import('qrcode.react').then(mod => {
      componentRef.current = mod.QRCodeSVG as unknown as React.ComponentType<{ value: string; size: number; level: string }>;
      setLoaded(true);
    }).catch(() => {
      // Library not available
    });
  }, []);

  if (!loaded || !componentRef.current) {
    return (
      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
        QR Code
      </div>
    );
  }

  const QR = componentRef.current;
  return (
    <div className="inline-block rounded-lg bg-white p-4 shadow-sm border">
      <QR value={value} size={192} level="M" />
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}
