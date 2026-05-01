'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { CITIES, BUSINESS_CATEGORIES as FALLBACK_CATEGORIES } from '@dineroot/shared';
import type { BusinessCategoryRow } from '@dineroot/shared';

const cityKeys = Object.keys(CITIES) as (keyof typeof CITIES)[];

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  city: string;
  neighborhood: string;
  status: string;
  product_type: string;
  business_category: string;
  avg_rating: number;
  total_reviews: number;
  owner_email: string;
  created_at: string;
  gupshup_app_id: string | null;
  whatsapp_phone_number_id: string | null;
  custom_commission_rate: number | null;
}

const VALID_STATUSES = ['active', 'approved', 'pending_review', 'suspended', 'rejected'] as const;
const statusOptions = ['all', ...VALID_STATUSES];

export default function AdminRestaurantsPage() {
  const { verified } = useAdminGuard();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [waConfig, setWaConfig] = useState({ gupshup_app_id: '', whatsapp_phone_number_id: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewBiz, setShowNewBiz] = useState(false);
  const [newBiz, setNewBiz] = useState({
    name: '',
    business_category: 'restaurant',
    city: 'lagos',
    neighborhood: '',
    address: '',
    phone: '',
    product_type: 'whatsapp_standalone',
    whatsapp_plan: 'starter',
    owner_email: '',
    auto_approve: false,
    payment_gateway: '' as '' | 'paystack' | 'flutterwave',
    bank_code: '',
    account_number: '',
    account_name: '',
    bank_name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [newBizBanks, setNewBizBanks] = useState<{ name: string; code: string }[]>([]);
  const [newBizResolving, setNewBizResolving] = useState(false);
  const [newBizResolveError, setNewBizResolveError] = useState('');

  // DB categories
  const [dbCategories, setDbCategories] = useState<BusinessCategoryRow[]>([]);
  const categoryKeys = dbCategories.length > 0
    ? dbCategories.filter(c => c.is_active).map(c => c.key)
    : FALLBACK_CATEGORIES.map(c => c.key);
  const categoryLabelMap = Object.fromEntries(
    dbCategories.length > 0
      ? dbCategories.map(c => [c.key, `${c.icon} ${c.label}`])
      : FALLBACK_CATEGORIES.map(c => [c.key, `${c.icon} ${c.label}`])
  );

  // Custom fee
  const [feeInput, setFeeInput] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);
  const [globalCommission, setGlobalCommission] = useState('10');

  async function loadNewBizBanks(gw: string) {
    if (!gw) { setNewBizBanks([]); return; }
    try {
      const res = await fetch(`/api/payments/banks?gateway=${gw}`);
      const data = await res.json();
      if (data.banks) setNewBizBanks(data.banks);
    } catch { /* ignore */ }
  }

  async function resolveNewBizAccount() {
    if (!newBiz.bank_code || newBiz.account_number.length !== 10 || !newBiz.payment_gateway) return;
    setNewBizResolving(true);
    setNewBizResolveError('');
    try {
      const res = await fetch(
        `/api/payments/resolve-account?account_number=${newBiz.account_number}&bank_code=${newBiz.bank_code}&gateway=${newBiz.payment_gateway}`,
      );
      const data = await res.json();
      if (res.ok) {
        setNewBiz((prev) => ({ ...prev, account_name: data.account_name }));
      } else {
        setNewBizResolveError(data.message || 'Could not resolve account');
      }
    } catch {
      setNewBizResolveError('Network error');
    }
    setNewBizResolving(false);
  }

  async function fetchDbCategories() {
    const supabase = createClient();
    const { data } = await supabase
      .from('business_categories')
      .select('*')
      .order('sort_order');
    if (data && data.length > 0) setDbCategories(data as BusinessCategoryRow[]);
  }

  async function fetchGlobalCommission() {
    const supabase = createClient();
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'platform_commission_pct')
      .single();
    if (data?.value) setGlobalCommission(data.value);
  }

  async function saveCustomFee(id: string) {
    setFeeSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const rate = feeInput.trim() === '' ? null : parseFloat(feeInput);

    if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
      alert('Enter a valid percentage between 0 and 100, or leave empty for global rate');
      setFeeSaving(false);
      return;
    }

    await supabase.from('restaurants').update({ custom_commission_rate: rate }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'custom_commission_updated',
      entity_type: 'restaurant',
      entity_id: id,
      user_id: user?.id,
      details: { custom_commission_rate: rate },
    });

    setFeeSaving(false);
    setFeeSaved(true);
    setTimeout(() => setFeeSaved(false), 2000);
    fetchRestaurants();
  }

  async function handleCreateBusiness() {
    if (!newBiz.name || !newBiz.city || !newBiz.neighborhood) {
      alert('Name, city, and neighborhood are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/onboard-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBiz),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to create business');
        setSubmitting(false);
        return;
      }
      setShowNewBiz(false);
      setNewBiz({
        name: '', business_category: 'restaurant', city: 'lagos', neighborhood: '',
        address: '', phone: '', product_type: 'whatsapp_standalone', whatsapp_plan: 'starter',
        owner_email: '', auto_approve: false, payment_gateway: '', bank_code: '',
        account_number: '', account_name: '', bank_name: '',
      });
      fetchRestaurants();
    } catch {
      alert('Network error');
    }
    setSubmitting(false);
  }

  const fetchRestaurants = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood, status, product_type, business_category, avg_rating, total_reviews, created_at, gupshup_app_id, whatsapp_phone_number_id, custom_commission_rate, profiles:owner_id (email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;

    let results = (data || []).map((r) => {
      const profileRaw = r.profiles as unknown;
      const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        city: r.city,
        neighborhood: r.neighborhood,
        status: r.status,
        product_type: r.product_type,
        business_category: r.business_category || 'restaurant',
        avg_rating: r.avg_rating,
        total_reviews: r.total_reviews,
        owner_email: profile?.email || '—',
        created_at: r.created_at,
        gupshup_app_id: r.gupshup_app_id,
        whatsapp_phone_number_id: r.whatsapp_phone_number_id,
        custom_commission_rate: r.custom_commission_rate ?? null,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.owner_email.toLowerCase().includes(q) ||
          r.slug.includes(q) ||
          r.business_category.includes(q),
      );
    }

    setRestaurants(results);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    if (verified) {
      fetchRestaurants();
      fetchDbCategories();
      fetchGlobalCommission();
    }
  }, [fetchRestaurants, verified]);

  async function updateStatus(id: string, newStatus: string) {
    if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const restaurant = restaurants.find((r) => r.id === id);
    const oldStatus = restaurant?.status;

    await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'restaurant_status_changed',
      entity_type: 'restaurant',
      entity_id: id,
      user_id: user.id,
      details: { old_status: oldStatus, new_status: newStatus },
    });

    fetchRestaurants();
  }

  function openWhatsAppConfig(r: Restaurant) {
    if (expandedId === r.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(r.id);
    setWaConfig({
      gupshup_app_id: r.gupshup_app_id || '',
      whatsapp_phone_number_id: r.whatsapp_phone_number_id || '',
    });
    setFeeInput(r.custom_commission_rate != null ? String(r.custom_commission_rate) : '');
    setSaved(false);
    setFeeSaved(false);
  }

  async function saveWhatsAppConfig(id: string) {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Check if this is the first time a dedicated number is being assigned
    const restaurant = restaurants.find((r) => r.id === id);
    const isNewDedicated = !restaurant?.whatsapp_phone_number_id && !!waConfig.whatsapp_phone_number_id;

    await supabase.from('restaurants').update({
      gupshup_app_id: waConfig.gupshup_app_id || null,
      whatsapp_phone_number_id: waConfig.whatsapp_phone_number_id || null,
    }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'whatsapp_config_updated',
      entity_type: 'restaurant',
      entity_id: id,
      user_id: user.id,
      details: {
        gupshup_app_id: waConfig.gupshup_app_id || null,
        whatsapp_phone_number_id: waConfig.whatsapp_phone_number_id || null,
      },
    });

    // Send "setup complete" email when a dedicated number is newly assigned
    if (isNewDedicated) {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'whatsapp_setup_complete', restaurantId: id }),
      }).catch(() => {}); // fire-and-forget
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchRestaurants();
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    pending_review: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (!verified) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="mt-1 text-sm text-gray-500">{restaurants.length} businesses</p>
        </div>
        <button
          onClick={() => setShowNewBiz(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          + New Business
        </button>
      </div>

      {/* New Business Modal */}
      {showNewBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowNewBiz(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">New Business</h2>
            <p className="mt-1 text-xs text-gray-400">Onboard a business to the platform</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">Business Name *</label>
                <input
                  type="text"
                  value={newBiz.name}
                  onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Business Category</label>
                <select
                  value={newBiz.business_category}
                  onChange={(e) => setNewBiz({ ...newBiz, business_category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none capitalize"
                >
                  {categoryKeys.map((c) => (
                    <option key={c} value={c}>{categoryLabelMap[c] || c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">City *</label>
                  <select
                    value={newBiz.city}
                    onChange={(e) => setNewBiz({ ...newBiz, city: e.target.value, neighborhood: '' })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  >
                    {cityKeys.map((c) => (
                      <option key={c} value={c}>{CITIES[c].name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Neighborhood *</label>
                  <select
                    value={newBiz.neighborhood}
                    onChange={(e) => setNewBiz({ ...newBiz, neighborhood: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Select...</option>
                    {(CITIES[newBiz.city as keyof typeof CITIES]?.neighborhoods || []).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Address</label>
                  <input
                    type="text"
                    value={newBiz.address}
                    onChange={(e) => setNewBiz({ ...newBiz, address: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Phone</label>
                  <input
                    type="text"
                    value={newBiz.phone}
                    onChange={(e) => setNewBiz({ ...newBiz, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Product Type</label>
                  <select
                    value={newBiz.product_type}
                    onChange={(e) => setNewBiz({ ...newBiz, product_type: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="marketplace">Marketplace</option>
                    <option value="whatsapp_standalone">WhatsApp Standalone</option>
                  </select>
                </div>
                {newBiz.product_type === 'whatsapp_standalone' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600">WhatsApp Plan</label>
                    <select
                      value={newBiz.whatsapp_plan}
                      onChange={(e) => setNewBiz({ ...newBiz, whatsapp_plan: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Owner Email (optional)</label>
                <input
                  type="email"
                  placeholder="Link to existing user account"
                  value={newBiz.owner_email}
                  onChange={(e) => setNewBiz({ ...newBiz, owner_email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              {/* Optional Payment Setup */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Payment Setup (optional)
                </p>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600">Payment Gateway</label>
                  <select
                    value={newBiz.payment_gateway}
                    onChange={(e) => {
                      const gw = e.target.value as '' | 'paystack' | 'flutterwave';
                      setNewBiz({ ...newBiz, payment_gateway: gw, bank_code: '', account_number: '', account_name: '', bank_name: '' });
                      loadNewBizBanks(gw);
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Skip — business sets up later</option>
                    <option value="paystack">Paystack</option>
                    <option value="flutterwave">Flutterwave</option>
                  </select>
                </div>

                {newBiz.payment_gateway && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Bank</label>
                      <select
                        value={newBiz.bank_code}
                        onChange={(e) => {
                          const code = e.target.value;
                          const bank = newBizBanks.find((b) => b.code === code);
                          setNewBiz({ ...newBiz, bank_code: code, bank_name: bank?.name || '', account_name: '' });
                          setNewBizResolveError('');
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                      >
                        <option value="">Select bank...</option>
                        {newBizBanks.map((b) => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600">Account Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="0123456789"
                          value={newBiz.account_number}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setNewBiz({ ...newBiz, account_number: val, account_name: '' });
                            setNewBizResolveError('');
                          }}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={resolveNewBizAccount}
                          disabled={newBizResolving || !newBiz.bank_code || newBiz.account_number.length !== 10}
                          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {newBizResolving ? '...' : 'Verify'}
                        </button>
                      </div>
                    </div>
                    {newBiz.account_name && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                        <p className="text-xs font-medium text-green-800">{newBiz.account_name}</p>
                      </div>
                    )}
                    {newBizResolveError && (
                      <p className="text-xs text-red-600">{newBizResolveError}</p>
                    )}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newBiz.auto_approve}
                  onChange={(e) => setNewBiz({ ...newBiz, auto_approve: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Auto-approve (skip review)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowNewBiz(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBusiness}
                disabled={submitting}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Business'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name, city, email, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                statusFilter === s ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Business</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">WhatsApp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {restaurants.map((r) => (
                <tr key={r.id} className="group">
                  <td colSpan={7} className="p-0">
                    <div
                      className="flex cursor-pointer items-center hover:bg-gray-50/50"
                      onClick={() => openWhatsAppConfig(r)}
                    >
                      <div className="w-[20%] px-4 py-3 font-medium text-gray-900">{r.name}</div>
                      <div className="w-[12%] px-4 py-3">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium capitalize text-brand">
                          {r.business_category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="w-[16%] px-4 py-3 text-gray-600">
                        {r.neighborhood}, {r.city.replace(/_/g, ' ')}
                      </div>
                      <div className="w-[14%] px-4 py-3 text-xs text-gray-400">{r.owner_email}</div>
                      <div className="w-[10%] px-4 py-3">
                        {r.whatsapp_phone_number_id ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Dedicated
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="w-[12%] px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="w-[16%] px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={r.status}
                          onChange={(e) => updateStatus(r.id, e.target.value)}
                          className="rounded border border-gray-200 px-2 py-1 text-xs outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="approved">Approved</option>
                          <option value="pending_review">Pending</option>
                          <option value="suspended">Suspended</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>

                    {/* Expanded Config Panel */}
                    {expandedId === r.id && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4 space-y-5">
                        {/* WhatsApp Config */}
                        <div className="flex items-start gap-6">
                          <div className="flex-1 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              WhatsApp Bot Configuration
                            </h4>
                            <div>
                              <label className="block text-xs font-medium text-gray-600">Gupshup App ID</label>
                              <input
                                type="text"
                                placeholder="e.g. grace-church-bot"
                                value={waConfig.gupshup_app_id}
                                onChange={(e) => setWaConfig({ ...waConfig, gupshup_app_id: e.target.value })}
                                className="mt-1 w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600">WhatsApp Phone Number</label>
                              <input
                                type="text"
                                placeholder="e.g. 2348012345678"
                                value={waConfig.whatsapp_phone_number_id}
                                onChange={(e) => setWaConfig({ ...waConfig, whatsapp_phone_number_id: e.target.value })}
                                className="mt-1 w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                              />
                              <p className="mt-1 text-[10px] text-gray-400">
                                Leave empty to use the shared platform number
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 pt-6">
                            <button
                              onClick={() => saveWhatsAppConfig(r.id)}
                              disabled={saving}
                              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            {saved && (
                              <span className="text-xs text-green-600">Saved!</span>
                            )}
                          </div>
                        </div>

                        {/* Custom Fee Section */}
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Fees
                          </h4>
                          <div className="mt-3 flex items-end gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600">
                                Custom Commission Rate (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                placeholder={`Global: ${globalCommission}%`}
                                value={feeInput}
                                onChange={(e) => setFeeInput(e.target.value)}
                                className="mt-1 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                              />
                            </div>
                            <button
                              onClick={() => saveCustomFee(r.id)}
                              disabled={feeSaving}
                              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                            >
                              {feeSaving ? 'Saving...' : 'Save'}
                            </button>
                            {r.custom_commission_rate != null && (
                              <button
                                onClick={async () => {
                                  setFeeSaving(true);
                                  const supabase = createClient();
                                  const { data: { user } } = await supabase.auth.getUser();
                                  await supabase.from('restaurants').update({ custom_commission_rate: null }).eq('id', r.id);
                                  await supabase.from('audit_logs').insert({
                                    action: 'custom_commission_updated',
                                    entity_type: 'restaurant',
                                    entity_id: r.id,
                                    user_id: user?.id,
                                    details: { custom_commission_rate: null },
                                  });
                                  setFeeInput('');
                                  setFeeSaving(false);
                                  setFeeSaved(true);
                                  setTimeout(() => setFeeSaved(false), 2000);
                                  fetchRestaurants();
                                }}
                                disabled={feeSaving}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Reset to global
                              </button>
                            )}
                            {feeSaved && (
                              <span className="text-xs text-green-600">Saved!</span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[10px] text-gray-400">
                            {r.custom_commission_rate != null
                              ? `Custom: ${r.custom_commission_rate}%`
                              : `Using global rate (${globalCommission}%)`
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
