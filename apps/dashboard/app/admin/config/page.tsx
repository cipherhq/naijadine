'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES, FEES } from '@dineroot/shared';
import type { BusinessCategoryRow } from '@dineroot/shared';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface ConfigEntry {
  id: string;
  key: string;
  value: string;
  description: string;
}

const BOOKING_TYPES = ['appointment', 'order', 'general'] as const;
const CATEGORY_GROUPS = ['food', 'beauty', 'health', 'hospitality', 'services', 'community'] as const;

const EMPTY_CAT_FORM: {
  key: string;
  label: string;
  group: string;
  icon: string;
  booking_type: 'appointment' | 'order' | 'general';
  default_greeting: string;
} = {
  key: '',
  label: '',
  group: 'services',
  icon: '🏢',
  booking_type: 'general',
  default_greeting: '',
};

export default function AdminConfigPage() {
  const { verified } = useAdminGuard();
  const [tab, setTab] = useState<'platform' | 'payments' | 'cities' | 'fees' | 'categories' | 'flags'>('platform');
  const [commissionPct, setCommissionPct] = useState('');
  const [commissionId, setCommissionId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: '', value: '' });

  // Categories tab state
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState({ ...EMPTY_CAT_FORM });
  const [editingCatKey, setEditingCatKey] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ ...EMPTY_CAT_FORM });
  const [catSaving, setCatSaving] = useState(false);

  async function fetchConfigs() {
    const supabase = createClient();
    const { data } = await supabase
      .from('platform_config')
      .select('id, key, value, description')
      .order('key');

    setConfigs(data || []);
    const commission = (data || []).find((c) => c.key === 'platform_commission_pct');
    if (commission) {
      setCommissionPct(commission.value);
      setCommissionId(commission.id);
    }
    setLoading(false);
  }

  async function fetchCategories() {
    setCatLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('business_categories')
      .select('*')
      .order('sort_order');
    setCategories((data as BusinessCategoryRow[]) || []);
    setCatLoading(false);
  }

  async function saveCategory(isNew: boolean) {
    const form = isNew ? catForm : editCatForm;
    if (!form.key || !form.label) return;
    setCatSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const row = {
      key: form.key,
      label: form.label,
      group: form.group,
      icon: form.icon || '🏢',
      booking_type: form.booking_type,
      default_greeting: form.default_greeting || null,
    };

    if (isNew) {
      await supabase.from('business_categories').insert(row);
    } else {
      await supabase.from('business_categories').update(row).eq('key', form.key);
    }

    await supabase.from('audit_logs').insert({
      action: isNew ? 'category_created' : 'category_updated',
      entity_type: 'business_category',
      entity_id: form.key,
      user_id: user?.id,
      details: row,
    });

    setCatSaving(false);
    setShowAddCat(false);
    setEditingCatKey(null);
    setCatForm({ ...EMPTY_CAT_FORM });
    fetchCategories();
  }

  async function toggleCategoryActive(cat: BusinessCategoryRow) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('business_categories').update({ is_active: !cat.is_active }).eq('key', cat.key);
    await supabase.from('audit_logs').insert({
      action: 'category_toggled',
      entity_type: 'business_category',
      entity_id: cat.key,
      user_id: user?.id,
      details: { is_active: !cat.is_active },
    });
    fetchCategories();
  }

  useEffect(() => {
    if (verified) {
      fetchConfigs();
      fetchCategories();
    }
  }, [verified]);

  async function updateConfig(id: string, value: string) {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('platform_config').update({ value }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'config_updated',
      entity_type: 'platform_config',
      entity_id: id,
      user_id: user?.id,
      details: { new_value: value },
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchConfigs();
  }

  async function addFlag() {
    if (!newFlag.key) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('platform_config').insert({
      key: newFlag.key,
      value: newFlag.value || 'false',
      description: 'Feature flag',
    });

    setNewFlag({ key: '', value: '' });
    setSaving(false);
    fetchConfigs();
  }

  async function deleteConfig(id: string) {
    const supabase = createClient();
    await supabase.from('platform_config').delete().eq('id', id);
    fetchConfigs();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Config</h1>

      {saved && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Configuration saved!
        </div>
      )}

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit flex-wrap">
        {(['platform', 'payments', 'cities', 'fees', 'categories', 'flags'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'flags' ? 'Feature Flags' : t === 'payments' ? 'Payments' : t}
          </button>
        ))}
      </div>

      <div className={`mt-6 ${tab === 'categories' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {tab === 'platform' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : configs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
                <p className="text-sm text-gray-400">No configuration entries yet</p>
                <p className="mt-1 text-xs text-gray-300">Add entries via the Feature Flags tab or directly in Supabase</p>
              </div>
            ) : (
              configs.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-100 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.key}</p>
                      {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                    </div>
                    <button
                      onClick={() => deleteConfig(c.id)}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                  <input
                    type="text"
                    defaultValue={c.value}
                    onBlur={(e) => {
                      if (e.target.value !== c.value) updateConfig(c.id, e.target.value);
                    }}
                    className="mt-2 w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'payments' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Payment Settings</h2>
            <p className="mt-1 text-xs text-gray-400">
              Configure platform commission for payment splits with businesses
            </p>

            {loading ? (
              <div className="mt-6 flex justify-center py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Platform Commission (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={commissionPct}
                      onChange={(e) => setCommissionPct(e.target.value)}
                      className="w-32 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    DineRoot keeps this percentage from each payment. The rest goes to the business.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const pct = parseFloat(commissionPct);
                    if (isNaN(pct) || pct < 0 || pct > 100) {
                      alert('Enter a valid percentage between 0 and 100');
                      return;
                    }
                    if (commissionId) {
                      updateConfig(commissionId, String(pct));
                    }
                  }}
                  disabled={saving || !commissionId}
                  className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Commission Rate'}
                </button>

                {!commissionId && (
                  <p className="text-xs text-amber-600">
                    Commission config not found. Run the payment_split migration first.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'cities' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Supported Cities</h2>
            <p className="mt-1 text-xs text-gray-400">
              Cities are configured in the shared package (@dineroot/shared)
            </p>
            <div className="mt-4 space-y-4">
              {Object.entries(CITIES).map(([key, city]) => (
                <div key={key} className="border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{city.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{key}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {city.neighborhoods.map((n) => (
                      <span key={n} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'fees' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Fee Structure</h2>
            <p className="mt-1 text-xs text-gray-400">
              Fees are configured in the shared package (@dineroot/shared)
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-600">Platform Commission</span>
                <span className="font-medium text-gray-900">{FEES.commissionRate}%</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-600">VAT</span>
                <span className="font-medium text-gray-900">{FEES.vatRate}%</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-600">Paystack Local Rate</span>
                <span className="font-medium text-gray-900">{FEES.paystackLocalRate}%</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-600">Paystack Flat Fee</span>
                <span className="font-medium text-gray-900">{formatNaira(FEES.paystackLocalFlat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paystack Cap</span>
                <span className="font-medium text-gray-900">{formatNaira(FEES.paystackLocalCap)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Custom commission rates can be set per business on the Businesses page.
            </p>
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Business Categories</h2>
                <p className="text-xs text-gray-400">
                  Manage categories available during signup. Deactivated categories are hidden from new businesses.
                </p>
              </div>
              <button
                onClick={() => { setShowAddCat(true); setCatForm({ ...EMPTY_CAT_FORM }); }}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                + Add Category
              </button>
            </div>

            {/* Add Category Form */}
            {showAddCat && (
              <div className="rounded-xl border border-brand/20 bg-brand-50/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">New Category</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Label *</label>
                    <input
                      type="text"
                      value={catForm.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                        setCatForm({ ...catForm, label, key });
                      }}
                      placeholder="e.g. Pet Grooming"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Key (slug)</label>
                    <input
                      type="text"
                      value={catForm.key}
                      onChange={(e) => setCatForm({ ...catForm, key: e.target.value })}
                      placeholder="e.g. pet_grooming"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Group</label>
                    <select
                      value={catForm.group}
                      onChange={(e) => setCatForm({ ...catForm, group: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none capitalize"
                    >
                      {CATEGORY_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Icon (emoji)</label>
                    <input
                      type="text"
                      value={catForm.icon}
                      onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Booking Type</label>
                    <select
                      value={catForm.booking_type}
                      onChange={(e) => setCatForm({ ...catForm, booking_type: e.target.value as typeof catForm.booking_type })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                    >
                      {BOOKING_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Default Greeting <span className="text-gray-400">({'{business_name}'} will be replaced)</span>
                  </label>
                  <textarea
                    value={catForm.default_greeting}
                    onChange={(e) => setCatForm({ ...catForm, default_greeting: e.target.value })}
                    placeholder="Welcome to {business_name}! I can help you book an appointment."
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddCat(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveCategory(true)}
                    disabled={catSaving || !catForm.key || !catForm.label}
                    className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                  >
                    {catSaving ? 'Saving...' : 'Add Category'}
                  </button>
                </div>
              </div>
            )}

            {/* Categories Table */}
            {catLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Icon</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Key</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Label</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Group</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Booking</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Greeting</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {categories.map((cat) => (
                      <tr key={cat.key} className="group">
                        <td colSpan={7} className="p-0">
                          {editingCatKey === cat.key ? (
                            /* Inline Edit Form */
                            <div className="border-l-2 border-brand bg-brand-50/10 p-4 space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Label</label>
                                  <input
                                    type="text"
                                    value={editCatForm.label}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, label: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Icon</label>
                                  <input
                                    type="text"
                                    value={editCatForm.icon}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, icon: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Group</label>
                                  <select
                                    value={editCatForm.group}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, group: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none capitalize"
                                  >
                                    {CATEGORY_GROUPS.map((g) => (
                                      <option key={g} value={g}>{g}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600">Booking Type</label>
                                  <select
                                    value={editCatForm.booking_type}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, booking_type: e.target.value as typeof editCatForm.booking_type })}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                                  >
                                    {BOOKING_TYPES.map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600">
                                  Default Greeting <span className="text-gray-400">({'{business_name}'} placeholder)</span>
                                </label>
                                <textarea
                                  value={editCatForm.default_greeting}
                                  onChange={(e) => setEditCatForm({ ...editCatForm, default_greeting: e.target.value })}
                                  rows={2}
                                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingCatKey(null)}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveCategory(false)}
                                  disabled={catSaving}
                                  className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                                >
                                  {catSaving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Normal Row */
                            <div
                              className="flex cursor-pointer items-center hover:bg-gray-50/50"
                              onClick={() => {
                                setEditingCatKey(cat.key);
                                setEditCatForm({
                                  key: cat.key,
                                  label: cat.label,
                                  group: cat.group,
                                  icon: cat.icon,
                                  booking_type: cat.booking_type,
                                  default_greeting: cat.default_greeting || '',
                                });
                              }}
                            >
                              <div className="w-[6%] px-3 py-2.5 text-lg">{cat.icon}</div>
                              <div className="w-[14%] px-3 py-2.5 font-mono text-xs text-gray-500">{cat.key}</div>
                              <div className="w-[14%] px-3 py-2.5 font-medium text-gray-900">{cat.label}</div>
                              <div className="w-[12%] px-3 py-2.5">
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600">
                                  {cat.group}
                                </span>
                              </div>
                              <div className="w-[12%] px-3 py-2.5">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  {cat.booking_type}
                                </span>
                              </div>
                              <div className="w-[30%] px-3 py-2.5 text-xs text-gray-400 truncate">
                                {cat.default_greeting || '—'}
                              </div>
                              <div className="w-[12%] px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleCategoryActive(cat)}
                                  className={`relative h-6 w-11 rounded-full transition ${
                                    cat.is_active ? 'bg-brand' : 'bg-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                      cat.is_active ? 'translate-x-5' : ''
                                    }`}
                                  />
                                </button>
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
        )}

        {tab === 'flags' && (
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Flag key (e.g. enable_whatsapp_bot)"
                value={newFlag.key}
                onChange={(e) => setNewFlag({ ...newFlag, key: e.target.value })}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <select
                value={newFlag.value}
                onChange={(e) => setNewFlag({ ...newFlag, value: e.target.value })}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
              <button
                onClick={addFlag}
                disabled={saving || !newFlag.key}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {configs
                .filter((c) => c.value === 'true' || c.value === 'false')
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.key}</p>
                      {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateConfig(c.id, c.value === 'true' ? 'false' : 'true')}
                        className={`relative h-6 w-11 rounded-full transition ${
                          c.value === 'true' ? 'bg-brand' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                            c.value === 'true' ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => deleteConfig(c.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}
