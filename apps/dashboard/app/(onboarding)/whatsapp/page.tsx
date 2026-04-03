'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CITIES, CUISINE_TYPES, PRICING, formatNaira } from '@naijadine/shared';

type Step = 'plan' | 'info' | 'gupshup' | 'done';

export default function WhatsAppOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('plan');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Plan selection
  const [plan, setPlan] = useState<'starter' | 'professional'>('starter');

  // Restaurant info
  const [name, setName] = useState('');
  const [city, setCity] = useState('lagos');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [cuisines, setCuisines] = useState<string[]>([]);

  // Gupshup
  const [gupshupAppId, setGupshupAppId] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const cityKey = city as keyof typeof CITIES;
  const neighborhoods = CITIES[cityKey]?.neighborhoods || [];

  async function handleSubmit() {
    if (!name.trim()) { setError('Restaurant name is required'); return; }
    if (!neighborhood) { setError('Select a neighborhood'); return; }

    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const { data: restaurant, error: insertErr } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        city,
        neighborhood,
        address: address.trim(),
        phone: phone.trim() || null,
        cuisine_types: cuisines.length > 0 ? cuisines : ['other'],
        pricing_tier: 'moderate',
        product_type: 'whatsapp_standalone',
        whatsapp_plan: plan,
        is_whitelabel: plan === 'professional',
        gupshup_app_id: gupshupAppId.trim() || null,
        whatsapp_phone_number_id: whatsappNumber.trim() || null,
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (insertErr || !restaurant) {
      setError(insertErr?.message || 'Failed to create restaurant');
      setSaving(false);
      return;
    }

    // Update user role to restaurant_owner
    await supabase
      .from('profiles')
      .update({ role: 'restaurant_owner' })
      .eq('id', user.id);

    // Create default whatsapp_config
    await supabase
      .from('whatsapp_config')
      .insert({
        restaurant_id: restaurant.id,
        bot_greeting: `Welcome to ${name.trim()}! 🍽️\n\nLet's book you a table.`,
        bot_confirmation_template: `✅ *Booking Confirmed!*\n\n🍽️ {restaurant_name}\n📅 {date}\n🕐 {time}\n👥 {party_size} guests\n🔑 Ref: *{reference_code}*\n\nEnjoy your meal! 🎉`,
        bot_reminder_template: `⏰ *Reminder*\n\nYour reservation at {restaurant_name} is tomorrow at {time} for {party_size} guests.\n\nRef: {reference_code}\n\nSee you there! 🍽️`,
      });

    // Send "setup pending" email to the business owner
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'whatsapp_setup_pending', restaurantId: restaurant.id }),
    }).catch(() => {}); // fire-and-forget

    setSaving(false);
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
            <svg className="h-8 w-8 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Application Submitted!</h1>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;re reviewing your application and setting up your WhatsApp bot. This typically takes 2-3 business days. We&apos;ll send you an email once everything is ready.
          </p>
          <button
            onClick={() => router.push('/standalone')}
            className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand/90"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366] text-lg font-bold text-white">
          W
        </div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Booking Bot</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up your restaurant&apos;s WhatsApp reservation bot
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {(['plan', 'info', 'gupshup'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? 'bg-brand text-white'
                  : (['plan', 'info', 'gupshup'].indexOf(step) > i)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {['plan', 'info', 'gupshup'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Plan */}
      {step === 'plan' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Choose Your Plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['starter', 'professional'] as const).map((key) => {
              const t = PRICING.whatsapp_standalone[key];
              return (
                <button
                  key={key}
                  onClick={() => setPlan(key)}
                  className={`rounded-xl border p-5 text-left transition ${
                    plan === key ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="text-lg font-bold capitalize text-gray-900">{t.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-brand">{formatNaira(t.price!)}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                  <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
                    <li>{t.maxBookings === Infinity ? 'Unlimited' : t.maxBookings} bookings/mo</li>
                    <li>{t.whitelabel ? 'White-label (your brand)' : 'NaijaDine branded'}</li>
                    <li>Guest management</li>
                    <li>Reservation dashboard</li>
                  </ul>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setStep('info')}
            className="w-full rounded-lg bg-brand py-3 text-sm font-medium text-white hover:bg-brand/90"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Restaurant Info */}
      {step === 'info' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Restaurant Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Restaurant Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bukka Hut"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">City *</label>
                <select
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setNeighborhood(''); }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {Object.entries(CITIES).map(([key, c]) => (
                    <option key={key} value={key}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Neighborhood *</label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {neighborhoods.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cuisine Types</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUISINE_TYPES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setCuisines((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      cuisines.includes(c)
                        ? 'bg-brand text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('plan')}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep('gupshup')}
              className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Gupshup Setup */}
      {step === 'gupshup' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">WhatsApp Setup</h2>
          <p className="text-sm text-gray-500">
            Connect your Gupshup WhatsApp Business account. You can skip this and set it up later.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Gupshup App ID</label>
              <input
                type="text"
                value={gupshupAppId}
                onChange={(e) => setGupshupAppId(e.target.value)}
                placeholder="Optional — configure later in settings"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp Phone Number</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g., 2348012345678"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            <strong>Need help?</strong> Our team can help you set up your Gupshup account and WhatsApp Business number.
            Contact us at <span className="font-medium">support@naijadine.com</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('info')}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
