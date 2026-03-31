'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES, FEES } from '@naijadine/shared';

interface ConfigEntry {
  id: string;
  key: string;
  value: string;
  description: string;
}

export default function AdminConfigPage() {
  const [tab, setTab] = useState<'platform' | 'cities' | 'fees' | 'flags'>('platform');
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: '', value: '' });

  async function fetchConfigs() {
    const supabase = createClient();
    const { data } = await supabase
      .from('platform_config')
      .select('id, key, value, description')
      .order('key');

    setConfigs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function updateConfig(id: string, value: string) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('platform_config').update({ value }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'config_updated',
      entity_type: 'platform_config',
      entity_id: id,
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

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['platform', 'cities', 'fees', 'flags'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'flags' ? 'Feature Flags' : t}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-2xl">
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

        {tab === 'cities' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Supported Cities</h2>
            <p className="mt-1 text-xs text-gray-400">
              Cities are configured in the shared package (@naijadine/shared)
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
              Fees are configured in the shared package (@naijadine/shared)
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
