'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PhoneInput } from '@/components/auth/PhoneInput';
import {
  CITIES,
  PRICING,
  CUISINE_TYPES,
  BUSINESS_CATEGORIES,
  CATEGORY_GROUP_LABELS,
  formatNaira,
} from '@naijadine/shared';
import type { BusinessCategoryRow } from '@naijadine/shared';
import type { User } from '@supabase/supabase-js';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_GUPSHUP_WHATSAPP_NUMBER || '2349XXXXXXXXX';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.naijadine.com';
const standalone = PRICING.whatsapp_standalone;

type WizardStep = 'category' | 'details' | 'auth' | 'plan' | 'success';

// Static fallback groups (used when DB fetch fails)
const FALLBACK_GROUPS = Object.entries(CATEGORY_GROUP_LABELS).map(([group, label]) => ({
  group,
  label,
  categories: BUSINESS_CATEGORIES.filter(c => c.group === group),
}));

function buildCategoryGroups(cats: { key: string; label: string; group: string; icon: string }[]) {
  return Object.entries(CATEGORY_GROUP_LABELS).map(([group, label]) => ({
    group,
    label,
    categories: cats.filter(c => c.group === group),
  })).filter(g => g.categories.length > 0);
}

function GetStartedWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successRestaurantId = searchParams.get('restaurant_id');
  const successStep = searchParams.get('step');

  const [step, setStep] = useState<WizardStep>('category');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Categories from DB
  const [dbCategories, setDbCategories] = useState<{ key: string; label: string; group: string; icon: string }[]>([]);
  const activeCategories = dbCategories.length > 0 ? dbCategories : [...BUSINESS_CATEGORIES];
  const categoryGroups = dbCategories.length > 0 ? buildCategoryGroups(dbCategories) : FALLBACK_GROUPS;

  // Category
  const [selectedCategory, setSelectedCategory] = useState('');
  const selectedCatObj = activeCategories.find(c => c.key === selectedCategory);

  // Business details
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  // Food-specific
  const [cuisineTypes, setCuisineTypes] = useState<string[]>([]);
  const [pricingTier, setPricingTier] = useState('');
  // Beauty-specific
  const [servicesDescription, setServicesDescription] = useState('');

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignIn, setIsSignIn] = useState(false);

  // Plan & payment
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional'>('starter');
  const [restaurantId, setRestaurantId] = useState('');
  const [botCode, setBotCode] = useState('');

  // Success
  const [successData, setSuccessData] = useState<{ bot_code: string; restaurant_id: string } | null>(null);

  // Fetch categories from DB
  useEffect(() => {
    async function loadCategories() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('business_categories')
          .select('key, label, "group", icon')
          .eq('is_active', true)
          .order('sort_order');
        if (data && data.length > 0) {
          setDbCategories(data.map(d => ({ key: d.key, label: d.label, group: d.group, icon: d.icon })));
        }
      } catch {
        // fall back to hardcoded
      }
    }
    loadCategories();
  }, []);

  // Check auth on mount + handle Paystack callback
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser(u);
        if (successStep === 'success' && successRestaurantId) {
          setRestaurantId(successRestaurantId);
          setStep('success');
        }
      }
      setInitialLoading(false);
    });
  }, [successStep, successRestaurantId]);

  // Verify payment when landing on success step from Paystack callback
  useEffect(() => {
    if (step !== 'success' || successData) return;
    if (!successRestaurantId) return;

    const ref = searchParams.get('reference') || searchParams.get('trxref');
    verifyPayment(ref || '', successRestaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, successRestaurantId]);

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

  // ── Auth: Signup ──
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setError('');

    try {
      // Create account via API (auto-confirms)
      const res = await fetch('/api/onboarding/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, phone: businessPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to create account');
        return;
      }

      // Now sign in client-side to establish session
      const supabase = createClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setUser(signInData.user);
      // Auto-register and go to plan
      await registerBusiness(signInData.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Auth: Sign in ──
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setUser(signInData.user);
      await registerBusiness(signInData.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Register business (called after auth) ──
  async function registerBusiness(authUser?: User | null) {
    const currentUser = authUser || user;
    if (!currentUser || !name || !city || !neighborhood || !address || !businessPhone) return;
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
          phone: businessPhone,
          plan: selectedPlan,
          business_category: selectedCategory || 'restaurant',
          cuisine_types: selectedCatObj?.group === 'food' ? cuisineTypes : undefined,
          pricing_tier: selectedCatObj?.group === 'food' ? pricingTier : undefined,
          services_description: selectedCatObj?.group === 'beauty' ? servicesDescription : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Registration failed');
        return;
      }

      setRestaurantId(data.restaurant_id);
      setBotCode(data.bot_code);
      setStep('plan');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Payment ──
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
      if (!res.ok) {
        setError(data.message || 'Payment initialization failed');
        return;
      }
      window.location.href = data.authorization_url;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Free trial (skip payment) ──
  async function handleFreeTrial() {
    if (!restaurantId) return;
    setLoading(true);
    setError('');

    try {
      // Call verify with no reference — activates in mock/trial mode
      const res = await fetch('/api/onboarding/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, plan: selectedPlan }),
      });
      const data = await res.json();
      if (data.bot_code) {
        setSuccessData({ bot_code: data.bot_code, restaurant_id: data.restaurant_id });
        setBotCode(data.bot_code);
        setStep('success');
      } else {
        setError(data.message || 'Failed to activate trial');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator ──
  const steps: { key: WizardStep; label: string }[] = [
    { key: 'category', label: 'Category' },
    { key: 'details', label: 'Details' },
    { key: 'auth', label: 'Account' },
    { key: 'plan', label: 'Plan' },
    { key: 'success', label: 'Live!' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  const cityOptions = Object.entries(CITIES).map(([key, val]) => ({ value: key, label: val.name }));
  const neighborhoodOptions = city && CITIES[city as keyof typeof CITIES]
    ? CITIES[city as keyof typeof CITIES].neighborhoods.map(n => ({ value: n, label: n }))
    : [];

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(successData?.bot_code || botCode)}`;

  if (initialLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <>
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

        {/* ── Step 1: Category Selection ── */}
        {step === 'category' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">What type of business do you run?</h2>
              <p className="mt-2 text-sm text-gray-500">
                Choose your category to get a customized setup
              </p>
            </div>

            {categoryGroups.map(({ group, label, categories }) => (
              <div key={group}>
                <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {categories.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.key);
                        setStep('details');
                      }}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition hover:border-brand hover:bg-brand-50/30 ${
                        selectedCategory === cat.key
                          ? 'border-brand bg-brand-50/30'
                          : 'border-gray-200'
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 2: Business Details ── */}
        {step === 'details' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // If already authed, register directly; otherwise go to auth
              if (user) {
                registerBusiness();
              } else {
                setStep('auth');
              }
            }}
            className="rounded-xl bg-white p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2">
              {selectedCatObj && <span className="text-xl">{selectedCatObj.icon}</span>}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedCatObj ? `${selectedCatObj.label} Details` : 'Business Details'}
                </h2>
                <p className="text-sm text-gray-500">Tell us about your business</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Business Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedCatObj ? `e.g. ${selectedCatObj.label} name` : 'e.g. Business name'}
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Business Phone *</label>
                <PhoneInput value={businessPhone} onChange={setBusinessPhone} />
              </div>

              {/* Food-specific fields */}
              {selectedCatObj?.group === 'food' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Cuisine Types</label>
                    <div className="flex flex-wrap gap-2">
                      {CUISINE_TYPES.map(ct => (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => {
                            setCuisineTypes(prev =>
                              prev.includes(ct) ? prev.filter(x => x !== ct) : [...prev, ct]
                            );
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            cuisineTypes.includes(ct)
                              ? 'bg-brand text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {ct.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Price Range</label>
                    <select
                      value={pricingTier}
                      onChange={(e) => setPricingTier(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    >
                      <option value="">Select price range</option>
                      <option value="budget">Budget-friendly</option>
                      <option value="mid">Mid-range</option>
                      <option value="premium">Premium</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </div>
                </>
              )}

              {/* Beauty-specific fields */}
              {selectedCatObj?.group === 'beauty' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">What services do you offer?</label>
                  <textarea
                    value={servicesDescription}
                    onChange={(e) => setServicesDescription(e.target.value)}
                    placeholder="e.g. Haircuts, braids, coloring, beard grooming..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep('category')}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!name || !city || !neighborhood || !address || !businessPhone || loading}
                className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Create Account ── */}
        {step === 'auth' && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              {isSignIn ? 'Sign In' : 'Create Your Account'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isSignIn
                ? 'Sign in with your existing account'
                : 'Create an account to manage your business'}
            </p>

            <form onSubmit={isSignIn ? handleSignIn : handleSignup} className="mt-6 space-y-4">
              {!isSignIn && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                  minLength={6}
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                type="submit"
                disabled={!email || !password || authLoading || loading}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {authLoading || loading
                  ? (isSignIn ? 'Signing in...' : 'Creating account...')
                  : (isSignIn ? 'Sign In & Continue' : 'Create Account & Continue')
                }
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-sm text-gray-500 hover:text-brand"
              >
                Back
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => { setIsSignIn(!isSignIn); setError(''); }}
                className="text-sm font-medium text-brand hover:underline"
              >
                {isSignIn ? 'Create a new account' : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Plan Selection ── */}
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
                    {['Up to 100 bookings/month', 'WhatsApp automation', 'Business dashboard', 'NaijaDine branding'].map(f => (
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
                onClick={handleFreeTrial}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Activating...' : 'Start Free Trial'}
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={loading}
                className="flex-1 rounded-lg bg-gold py-3 text-sm font-semibold text-brand-800 transition hover:bg-gold-400 disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Pay ${formatNaira(standalone[selectedPlan].price as number)} with Paystack`}
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

                <h2 className="mt-4 text-xl font-semibold text-gray-900">Your Business is Live!</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Share these details with your customers to start receiving orders via WhatsApp
                </p>

                {/* Bot Code */}
                <div className="mt-6 rounded-lg bg-brand-50/30 border border-brand/20 p-4">
                  <p className="text-xs font-medium text-brand uppercase">Your Business Code</p>
                  <p className="mt-2 text-3xl font-bold tracking-wider text-brand">
                    {successData.bot_code}
                  </p>
                </div>

                {/* WhatsApp Number */}
                <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
                  <p className="text-xs font-medium text-green-800 uppercase">Customers message this number</p>
                  <p className="mt-1 text-lg font-semibold text-green-900">{WHATSAPP_NUMBER}</p>
                  <p className="mt-1 text-xs text-green-700">
                    with the code <span className="font-bold">{successData.bot_code}</span>
                  </p>
                </div>

                {/* WhatsApp Link */}
                <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-600 uppercase">Direct link for customers</p>
                  <p className="mt-2 break-all text-sm font-mono text-gray-800">
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
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Message us on WhatsApp`, url: waLink });
                      } else {
                        navigator.clipboard.writeText(waLink);
                      }
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Share
                  </button>
                </div>

                <div className="mt-8 border-t pt-6">
                  <a
                    href={DASHBOARD_URL}
                    className="inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
                  >
                    Go to Dashboard
                  </a>
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
    </>
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        </div>
      }
    >
      <GetStartedWizard />
    </Suspense>
  );
}
