'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRestaurant, useDashboard } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { CUISINE_TYPES } from '@naijadine/shared';

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const cuisineLabels: Record<string, string> = {
  nigerian: 'Nigerian',
  continental: 'Continental',
  asian: 'Asian',
  mediterranean: 'Mediterranean',
  fast_casual: 'Fast Casual',
  grill_bbq: 'Grill & BBQ',
  seafood: 'Seafood',
  italian: 'Italian',
  chinese: 'Chinese',
  indian: 'Indian',
  lebanese: 'Lebanese',
  other: 'Other',
};

export default function SettingsPage() {
  const restaurant = useRestaurant();
  const { userId } = useDashboard();
  const [tab, setTab] = useState<'profile' | 'hours' | 'booking' | 'menu' | 'staff' | 'payments'>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Payments
  const [payGateway, setPayGateway] = useState<'paystack' | 'flutterwave'>(
    (restaurant.payment_gateway as 'paystack' | 'flutterwave') || 'paystack',
  );
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [paymentEnabled, setPaymentEnabled] = useState(!!restaurant.gateway_subaccount_code);
  const [paymentError, setPaymentError] = useState('');
  const [existingBank, setExistingBank] = useState<{ bank_name: string; account_number: string } | null>(null);
  const [banksLoading, setBanksLoading] = useState(false);

  const loadBanks = useCallback(async (gw: string) => {
    setBanksLoading(true);
    try {
      const res = await fetch(`/api/payments/banks?gateway=${gw}`);
      const data = await res.json();
      if (data.banks) setBanks(data.banks);
    } catch { /* ignore */ }
    setBanksLoading(false);
  }, []);

  const loadExistingBank = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('bank_accounts')
      .select('bank_name, account_number')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();
    if (data) setExistingBank(data);
  }, [restaurant.id]);

  useEffect(() => {
    if (tab === 'payments') {
      loadBanks(payGateway);
      loadExistingBank();
    }
  }, [tab, payGateway, loadBanks, loadExistingBank]);

  async function resolveAccount() {
    if (!bankCode || accountNumber.length !== 10) return;
    setResolving(true);
    setResolveError('');
    setResolvedName('');
    try {
      const res = await fetch(
        `/api/payments/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}&gateway=${payGateway}`,
      );
      const data = await res.json();
      if (res.ok) {
        setResolvedName(data.account_name);
      } else {
        setResolveError(data.message || 'Could not resolve account');
      }
    } catch {
      setResolveError('Network error');
    }
    setResolving(false);
  }

  async function enablePayments() {
    if (!resolvedName || !bankCode) return;
    setSaving(true);
    setPaymentError('');
    const selectedBank = banks.find((b) => b.code === bankCode);
    try {
      const res = await fetch('/api/payments/create-subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          gateway: payGateway,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: resolvedName,
          bank_name: selectedBank?.name || bankCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentEnabled(true);
        setExistingBank({ bank_name: selectedBank?.name || bankCode, account_number: accountNumber });
        showSaved();
      } else {
        setPaymentError(data.message || 'Failed to enable payments');
      }
    } catch {
      setPaymentError('Network error');
    }
    setSaving(false);
  }

  // Menu
  const [menuUrl, setMenuUrl] = useState<string | null>(restaurant.menu_url || null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Profile form
  const [profile, setProfile] = useState({
    name: restaurant.name,
    description: restaurant.description || '',
    address: restaurant.address,
    phone: restaurant.phone || '',
    email: restaurant.email || '',
    instagram_handle: restaurant.instagram_handle || '',
    website_url: restaurant.website_url || '',
    pricing_tier: restaurant.pricing_tier,
    cuisine_types: restaurant.cuisine_types || [],
  });

  // Operating hours
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    daysOfWeek.reduce(
      (acc, day) => {
        const h = restaurant.operating_hours?.[day];
        acc[day] = h ? { open: h.open, close: h.close, closed: false } : { open: '12:00', close: '22:00', closed: true };
        return acc;
      },
      {} as Record<string, { open: string; close: string; closed: boolean }>,
    ),
  );

  // Booking config
  const [bookingConfig, setBookingConfig] = useState({
    deposit_per_guest: restaurant.deposit_per_guest || 0,
    max_party_size: restaurant.max_party_size || 20,
    advance_booking_days: restaurant.advance_booking_days || 30,
    cancellation_hours: restaurant.cancellation_hours || 4,
  });

  // Staff
  const [staffEmail, setStaffEmail] = useState('');
  const [staffList, setStaffList] = useState<{ id: string; email: string; role: string }[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  async function loadStaff() {
    if (staffLoaded) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('restaurant_staff')
      .select('id, user_id, role, profiles:user_id (email)')
      .eq('restaurant_id', restaurant.id);

    if (data) {
      setStaffList(
        data.map((s) => {
          const profileRaw = s.profiles as unknown;
          const p = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
          return { id: s.id, email: p?.email || '—', role: s.role };
        }),
      );
    }
    setStaffLoaded(true);
  }

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('restaurants')
      .update({
        name: profile.name,
        description: profile.description || null,
        address: profile.address,
        phone: profile.phone || null,
        email: profile.email || null,
        instagram_handle: profile.instagram_handle || null,
        website_url: profile.website_url || null,
        pricing_tier: profile.pricing_tier,
        cuisine_types: profile.cuisine_types,
      })
      .eq('id', restaurant.id);

    setSaving(false);
    showSaved();
  }

  async function saveHours() {
    setSaving(true);
    const supabase = createClient();
    const operatingHours: Record<string, { open: string; close: string }> = {};
    for (const day of daysOfWeek) {
      if (!hours[day].closed) {
        operatingHours[day] = { open: hours[day].open, close: hours[day].close };
      }
    }
    await supabase
      .from('restaurants')
      .update({ operating_hours: operatingHours })
      .eq('id', restaurant.id);

    setSaving(false);
    showSaved();
  }

  async function saveBookingConfig() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('restaurants')
      .update({
        deposit_per_guest: bookingConfig.deposit_per_guest,
        max_party_size: bookingConfig.max_party_size,
        advance_booking_days: bookingConfig.advance_booking_days,
        cancellation_hours: bookingConfig.cancellation_hours,
      })
      .eq('id', restaurant.id);

    setSaving(false);
    showSaved();
  }

  async function addStaff() {
    if (!staffEmail) return;
    setSaving(true);
    const supabase = createClient();

    // Look up user by email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', staffEmail)
      .single();

    if (!userProfile) {
      alert('No user found with that email');
      setSaving(false);
      return;
    }

    await supabase.from('restaurant_staff').insert({
      restaurant_id: restaurant.id,
      user_id: userProfile.id,
      role: 'staff',
    });

    setStaffEmail('');
    setStaffLoaded(false);
    loadStaff();
    setSaving(false);
  }

  async function removeStaff(id: string) {
    const supabase = createClient();
    await supabase.from('restaurant_staff').delete().eq('id', id);
    setStaffList(staffList.filter((s) => s.id !== id));
  }

  async function uploadMenu() {
    if (!menuFile) return;
    setUploading(true);
    const supabase = createClient();
    const ext = menuFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    const path = `${restaurant.id}/menu.${ext}`;

    // Remove old file if exists
    if (menuUrl) {
      const oldPath = menuUrl.split('/menu-files/')[1];
      if (oldPath) await supabase.storage.from('menu-files').remove([oldPath]);
    }

    const { error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(path, menuFile, { upsert: true });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('menu-files').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    await supabase
      .from('restaurants')
      .update({ menu_url: publicUrl })
      .eq('id', restaurant.id);

    setMenuUrl(publicUrl);
    setMenuFile(null);
    setUploading(false);
    showSaved();
  }

  async function removeMenu() {
    if (!menuUrl) return;
    setUploading(true);
    const supabase = createClient();
    const filePath = menuUrl.split('/menu-files/')[1];
    if (filePath) {
      await supabase.storage.from('menu-files').remove([filePath]);
    }
    await supabase
      .from('restaurants')
      .update({ menu_url: null })
      .eq('id', restaurant.id);
    setMenuUrl(null);
    setUploading(false);
    showSaved();
  }

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleCuisine(type: string) {
    const current = profile.cuisine_types;
    if (current.includes(type)) {
      setProfile({ ...profile, cuisine_types: current.filter((c: string) => c !== type) });
    } else {
      setProfile({ ...profile, cuisine_types: [...current, type] });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {saved && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Settings saved successfully!
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {([
          { key: 'profile', label: 'Profile' },
          { key: 'hours', label: 'Hours' },
          { key: 'booking', label: 'Booking' },
          { key: 'menu', label: 'Menu' },
          { key: 'staff', label: 'Staff' },
          { key: 'payments', label: 'Payments' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === 'staff') loadStaff();
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-2xl">
        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <Field label="Restaurant Name">
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </Field>
            <Field label="Address">
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Instagram">
                <input
                  type="text"
                  value={profile.instagram_handle}
                  onChange={(e) => setProfile({ ...profile, instagram_handle: e.target.value })}
                  placeholder="handle (without @)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={profile.website_url}
                  onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
            </div>
            <Field label="Pricing Tier">
              <select
                value={profile.pricing_tier}
                onChange={(e) => setProfile({ ...profile, pricing_tier: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              >
                <option value="budget">Budget</option>
                <option value="moderate">Moderate</option>
                <option value="upscale">Upscale</option>
                <option value="fine_dining">Fine Dining</option>
              </select>
            </Field>
            <Field label="Cuisine Types">
              <div className="flex flex-wrap gap-2">
                {CUISINE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleCuisine(type)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      profile.cuisine_types.includes(type)
                        ? 'border-brand bg-brand-50 text-brand'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {cuisineLabels[type] || type}
                  </button>
                ))}
              </div>
            </Field>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* Hours Tab */}
        {tab === 'hours' && (
          <div className="space-y-3">
            {daysOfWeek.map((day) => (
              <div key={day} className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3">
                <span className="w-24 text-sm font-medium capitalize text-gray-700">{day}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!hours[day].closed}
                    onChange={() =>
                      setHours({
                        ...hours,
                        [day]: { ...hours[day], closed: !hours[day].closed },
                      })
                    }
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="text-xs text-gray-500">Open</span>
                </label>
                {!hours[day].closed && (
                  <>
                    <input
                      type="time"
                      value={hours[day].open}
                      onChange={(e) =>
                        setHours({
                          ...hours,
                          [day]: { ...hours[day], open: e.target.value },
                        })
                      }
                      className="rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={hours[day].close}
                      onChange={(e) =>
                        setHours({
                          ...hours,
                          [day]: { ...hours[day], close: e.target.value },
                        })
                      }
                      className="rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand"
                    />
                  </>
                )}
                {hours[day].closed && (
                  <span className="text-sm text-gray-400">Closed</span>
                )}
              </div>
            ))}
            <button
              onClick={saveHours}
              disabled={saving}
              className="mt-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Hours'}
            </button>
          </div>
        )}

        {/* Booking Tab */}
        {tab === 'booking' && (
          <div className="space-y-4">
            <Field label="Deposit per Guest (Naira)">
              <input
                type="number"
                min={0}
                step={500}
                value={bookingConfig.deposit_per_guest}
                onChange={(e) =>
                  setBookingConfig({ ...bookingConfig, deposit_per_guest: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-xs text-gray-400">Set to 0 for no deposit required</p>
            </Field>
            <Field label="Max Party Size">
              <input
                type="number"
                min={1}
                max={100}
                value={bookingConfig.max_party_size}
                onChange={(e) =>
                  setBookingConfig({ ...bookingConfig, max_party_size: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </Field>
            <Field label="Advance Booking (days)">
              <input
                type="number"
                min={1}
                max={90}
                value={bookingConfig.advance_booking_days}
                onChange={(e) =>
                  setBookingConfig({ ...bookingConfig, advance_booking_days: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-xs text-gray-400">How far in advance guests can book</p>
            </Field>
            <Field label="Cancellation Window (hours)">
              <input
                type="number"
                min={1}
                max={48}
                value={bookingConfig.cancellation_hours}
                onChange={(e) =>
                  setBookingConfig({ ...bookingConfig, cancellation_hours: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-xs text-gray-400">Minimum hours before reservation for free cancellation</p>
            </Field>
            <button
              onClick={saveBookingConfig}
              disabled={saving}
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Booking Config'}
            </button>
          </div>
        )}

        {/* Menu Tab */}
        {tab === 'menu' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Upload your restaurant menu (PDF or image). It will be displayed on your public page.</p>

            {menuUrl && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Current Menu</p>
                {/\.(jpg|jpeg|png|webp)(\?|$)/i.test(menuUrl) ? (
                  <img src={menuUrl} alt="Menu" className="max-h-60 rounded-lg object-contain" />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm2-3a.5.5 0 01-.5-.5v-2a.5.5 0 01.854-.354L8 13.793l2.646-2.647a.5.5 0 01.854.354v2a.5.5 0 01-.5.5H6z" /></svg>
                    <span>PDF menu uploaded</span>
                    <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View</a>
                  </div>
                )}
                <button
                  onClick={removeMenu}
                  disabled={uploading}
                  className="mt-3 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                >
                  Remove Menu
                </button>
              </div>
            )}

            <Field label="Upload Menu">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setMenuFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-100"
              />
            </Field>

            <button
              onClick={uploadMenu}
              disabled={uploading || !menuFile}
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Menu'}
            </button>
          </div>
        )}

        {/* Payments Tab */}
        {tab === 'payments' && (
          <div className="space-y-6">
            {/* Already enabled status */}
            {paymentEnabled && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Payments enabled
                  </span>
                  <span className="text-sm text-gray-600">
                    via {restaurant.payment_gateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'}
                  </span>
                </div>
                {existingBank && (
                  <p className="mt-2 text-sm text-gray-600">
                    {existingBank.bank_name} &middot; ******{existingBank.account_number.slice(-4)}
                  </p>
                )}
                <button
                  onClick={() => {
                    setPaymentEnabled(false);
                    setResolvedName('');
                    setAccountNumber('');
                    setBankCode('');
                  }}
                  className="mt-3 text-xs text-brand hover:underline"
                >
                  Update Bank Account
                </button>
              </div>
            )}

            {!paymentEnabled && (
              <>
                {/* Gateway Selection */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payment Gateway</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    Choose how you want to receive payments from customers
                  </p>
                  <div className="mt-3 flex gap-3">
                    {(['paystack', 'flutterwave'] as const).map((gw) => (
                      <button
                        key={gw}
                        type="button"
                        onClick={() => {
                          setPayGateway(gw);
                          setBankCode('');
                          setResolvedName('');
                          setResolveError('');
                        }}
                        className={`flex-1 rounded-lg border-2 p-4 text-left transition ${
                          payGateway === gw
                            ? 'border-brand bg-brand-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 capitalize">{gw}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {gw === 'paystack'
                            ? 'Popular in Nigeria. Fast settlements.'
                            : 'Pan-African coverage. Multiple currencies.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bank Account Setup */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Bank Account</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    Enter your business bank account for receiving payouts
                  </p>
                  <div className="mt-3 space-y-3">
                    <Field label="Bank">
                      {banksLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                          <span className="text-xs text-gray-400">Loading banks...</span>
                        </div>
                      ) : (
                        <select
                          value={bankCode}
                          onChange={(e) => {
                            setBankCode(e.target.value);
                            setResolvedName('');
                            setResolveError('');
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                        >
                          <option value="">Select bank...</option>
                          {banks.map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Field label="Account Number">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="0123456789"
                            value={accountNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setAccountNumber(val);
                              setResolvedName('');
                              setResolveError('');
                            }}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                          />
                        </Field>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={resolveAccount}
                          disabled={resolving || !bankCode || accountNumber.length !== 10}
                          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {resolving ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                    </div>

                    {resolvedName && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                        <p className="text-sm font-medium text-green-800">{resolvedName}</p>
                        <p className="text-xs text-green-600">Account verified successfully</p>
                      </div>
                    )}

                    {resolveError && (
                      <p className="text-sm text-red-600">{resolveError}</p>
                    )}
                  </div>
                </div>

                {/* Enable Payments */}
                {resolvedName && (
                  <div>
                    <button
                      onClick={enablePayments}
                      disabled={saving}
                      className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      {saving ? 'Setting up...' : 'Enable Payments'}
                    </button>
                    {paymentError && (
                      <p className="mt-2 text-sm text-red-600">{paymentError}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Staff Tab */}
        {tab === 'staff' && (
          <div>
            <div className="flex gap-2">
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="Staff member email"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={addStaff}
                disabled={saving || !staffEmail}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {staffList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-400">No staff members added yet</p>
                </div>
              ) : (
                staffList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.email}</p>
                      <p className="text-xs capitalize text-gray-400">{s.role}</p>
                    </div>
                    <button
                      onClick={() => removeStaff(s.id)}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
