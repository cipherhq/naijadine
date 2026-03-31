'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { PRICING, formatNaira } from '@naijadine/shared';

interface WhatsAppConfig {
  gupshup_app_id: string;
  whatsapp_phone_number_id: string;
  whatsapp_plan: string;
  is_whitelabel: boolean;
  bot_greeting: string;
  bot_confirmation_template: string;
  bot_reminder_template: string;
  bot_alias: string;
}

const defaultGreeting = `Welcome to {restaurant_name}! 🍽️\n\nLet's book you a table.`;
const defaultConfirmation = `✅ *Booking Confirmed!*\n\n🍽️ {restaurant_name}\n📅 {date}\n🕐 {time}\n👥 {party_size} guests\n🔑 Ref: *{reference_code}*\n\nEnjoy your meal! 🎉`;
const defaultReminder = `⏰ *Reminder*\n\nYour reservation at {restaurant_name} is tomorrow at {time} for {party_size} guests.\n\nRef: {reference_code}\n\nSee you there! 🍽️`;

export default function WhatsAppConfigPage() {
  const restaurant = useRestaurant();
  const [config, setConfig] = useState<WhatsAppConfig>({
    gupshup_app_id: '',
    whatsapp_phone_number_id: '',
    whatsapp_plan: 'starter',
    is_whitelabel: false,
    bot_greeting: defaultGreeting,
    bot_confirmation_template: defaultConfirmation,
    bot_reminder_template: defaultReminder,
    bot_alias: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'setup' | 'templates' | 'plan'>('setup');

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const supabase = createClient();
    const { data } = await supabase
      .from('restaurants')
      .select('gupshup_app_id, whatsapp_phone_number_id, whatsapp_plan, is_whitelabel')
      .eq('id', restaurant.id)
      .single();

    // Load bot templates from whatsapp_config table or restaurant metadata
    const { data: botConfig } = await supabase
      .from('whatsapp_config')
      .select('bot_greeting, bot_confirmation_template, bot_reminder_template, bot_alias')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();

    if (data) {
      setConfig({
        gupshup_app_id: data.gupshup_app_id || '',
        whatsapp_phone_number_id: data.whatsapp_phone_number_id || '',
        whatsapp_plan: data.whatsapp_plan || 'starter',
        is_whitelabel: data.is_whitelabel || false,
        bot_greeting: botConfig?.bot_greeting || defaultGreeting,
        bot_confirmation_template: botConfig?.bot_confirmation_template || defaultConfirmation,
        bot_reminder_template: botConfig?.bot_reminder_template || defaultReminder,
        bot_alias: botConfig?.bot_alias || '',
      });
    }
    setLoading(false);
  }

  async function saveSetup() {
    setSaving(true);
    const supabase = createClient();

    await supabase
      .from('restaurants')
      .update({
        gupshup_app_id: config.gupshup_app_id || null,
        whatsapp_phone_number_id: config.whatsapp_phone_number_id || null,
      })
      .eq('id', restaurant.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function saveTemplates() {
    setSaving(true);
    const supabase = createClient();

    // Upsert whatsapp_config
    await supabase
      .from('whatsapp_config')
      .upsert({
        restaurant_id: restaurant.id,
        bot_greeting: config.bot_greeting,
        bot_confirmation_template: config.bot_confirmation_template,
        bot_reminder_template: config.bot_reminder_template,
        bot_alias: config.bot_alias || null,
      }, { onConflict: 'restaurant_id' });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const plan = config.whatsapp_plan as keyof typeof PRICING.whatsapp_standalone;
  const tier = PRICING.whatsapp_standalone[plan] || PRICING.whatsapp_standalone.starter;
  const isWhitelabelAllowed = tier.whitelabel;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bot Configuration</h1>
        <p className="text-sm text-gray-500">Configure your restaurant&apos;s WhatsApp booking bot</p>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['setup', 'templates', 'plan'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'setup' ? 'Gupshup Setup' : tab === 'templates' ? 'Bot Templates' : 'Plan & Billing'}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Gupshup Integration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Connect your dedicated Gupshup WhatsApp number. Each restaurant gets its own Gupshup App for independent messaging.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Gupshup App ID</label>
              <input
                type="text"
                value={config.gupshup_app_id}
                onChange={(e) => setConfig({ ...config, gupshup_app_id: e.target.value })}
                placeholder="e.g., your-restaurant-bot"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Found in your Gupshup dashboard under App Settings</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp Phone Number</label>
              <input
                type="text"
                value={config.whatsapp_phone_number_id}
                onChange={(e) => setConfig({ ...config, whatsapp_phone_number_id: e.target.value })}
                placeholder="e.g., 2348012345678"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Your registered WhatsApp Business number (no + prefix)</p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <h4 className="text-sm font-medium text-blue-800">Webhook URL</h4>
            <p className="mt-1 text-xs text-blue-600">
              Configure this URL in your Gupshup App webhook settings:
            </p>
            <code className="mt-2 block rounded bg-white px-3 py-2 text-xs text-gray-800">
              https://api.naijadine.com/api/v1/webhook/whatsapp
            </code>
          </div>

          <button
            onClick={saveSetup}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Setup'}
          </button>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Bot Message Templates</h3>
            <p className="mt-1 text-sm text-gray-500">
              Customize the messages your bot sends to guests.
              {!isWhitelabelAllowed && (
                <span className="ml-1 text-orange-600">
                  Upgrade to Professional to remove NaijaDine branding.
                </span>
              )}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Greeting Message
                {!isWhitelabelAllowed && (
                  <span className="ml-2 text-xs text-orange-500">(NaijaDine branding included on Starter)</span>
                )}
              </label>
              <textarea
                value={config.bot_greeting}
                onChange={(e) => setConfig({ ...config, bot_greeting: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Variables: {'{restaurant_name}'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bot Name / Alias (optional)</label>
              <input
                type="text"
                value={config.bot_alias}
                onChange={(e) => setConfig({ ...config, bot_alias: e.target.value.slice(0, 50) })}
                placeholder="e.g. Folake, Sarah, Donald"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Give your bot a friendly name. Guests will see: &quot;Hi! I&apos;m {config.bot_alias || 'Folake'}, your booking assistant.&quot;
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Booking Confirmation</label>
              <textarea
                value={config.bot_confirmation_template}
                onChange={(e) => setConfig({ ...config, bot_confirmation_template: e.target.value })}
                rows={6}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Variables: {'{restaurant_name}'}, {'{date}'}, {'{time}'}, {'{party_size}'}, {'{reference_code}'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Reminder Message (24h before)</label>
              <textarea
                value={config.bot_reminder_template}
                onChange={(e) => setConfig({ ...config, bot_reminder_template: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Variables: {'{restaurant_name}'}, {'{date}'}, {'{time}'}, {'{party_size}'}, {'{reference_code}'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveTemplates}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Templates'}
            </button>
            <button
              onClick={() =>
                setConfig({
                  ...config,
                  bot_greeting: defaultGreeting,
                  bot_confirmation_template: defaultConfirmation,
                  bot_reminder_template: defaultReminder,
                  bot_alias: '',
                })
              }
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Plan Tab */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          {/* Current plan */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-base font-semibold text-gray-900">Current Plan</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-full bg-[#25D366]/10 px-3 py-1 text-sm font-bold capitalize text-[#25D366]">
                {config.whatsapp_plan}
              </span>
              <span className="text-sm text-gray-500">
                {tier.price ? `${formatNaira(tier.price)}/month` : 'Custom pricing'}
              </span>
            </div>
          </div>

          {/* Plan comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.entries(PRICING.whatsapp_standalone) as [string, typeof tier][]).map(
              ([key, t]) => (
                <div
                  key={key}
                  className={`rounded-xl border p-5 ${
                    config.whatsapp_plan === key
                      ? 'border-brand bg-brand/5'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <h4 className="text-lg font-bold capitalize text-gray-900">{t.name}</h4>
                  <p className="mt-1 text-2xl font-bold text-brand">
                    {t.price ? formatNaira(t.price) : 'Custom'}
                    {t.price && <span className="text-sm font-normal text-gray-500">/mo</span>}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <Check />
                      {t.maxBookings === Infinity ? 'Unlimited' : t.maxBookings} bookings/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check />
                      WhatsApp booking bot
                    </li>
                    <li className="flex items-center gap-2">
                      {t.whitelabel ? <Check /> : <Cross />}
                      <span className={!t.whitelabel ? 'text-gray-400' : ''}>
                        White-label (remove branding)
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check />
                      Guest management
                    </li>
                    {key === 'enterprise' && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check />
                          Multi-location support
                        </li>
                        <li className="flex items-center gap-2">
                          <Check />
                          API access
                        </li>
                        <li className="flex items-center gap-2">
                          <Check />
                          Dedicated account manager
                        </li>
                      </>
                    )}
                  </ul>
                  {config.whatsapp_plan === key ? (
                    <div className="mt-4 rounded-lg bg-brand/10 py-2 text-center text-sm font-medium text-brand">
                      Current Plan
                    </div>
                  ) : (
                    <button className="mt-4 w-full rounded-lg border border-brand py-2 text-sm font-medium text-brand hover:bg-brand/5">
                      {key === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                    </button>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Check() {
  return (
    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
