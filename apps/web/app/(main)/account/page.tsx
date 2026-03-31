'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  notification_prefs: { whatsapp: boolean; sms: boolean; email: boolean; push: boolean };
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState({ whatsapp: true, sms: true, email: true, push: true });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?redirect=/account'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone, notification_prefs')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setPrefs((data.notification_prefs as Profile['notification_prefs']) || { whatsapp: true, sms: true, email: true, push: true });
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, email, notification_prefs: prefs })
      .eq('id', user.id);

    setSaving(false);
    setMessage(error ? 'Failed to save changes.' : 'Changes saved!');
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const menuItems = [
    { href: '/account/bookings', label: 'My Bookings', icon: '📋' },
    { href: '/account/favorites', label: 'Saved Restaurants', icon: '❤️' },
    { href: '/account/loyalty', label: 'Loyalty & Rewards', icon: '⭐' },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">My Account</h1>

      {/* Quick nav */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 p-4 text-center hover:border-brand-100 hover:bg-brand-50/30 transition"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Profile form */}
      <div className="mt-8 space-y-6 rounded-xl border border-gray-100 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            value={profile?.phone || ''}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">Phone number cannot be changed</p>
        </div>

        {/* Notification preferences */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Notifications</label>
          <div className="space-y-2">
            {(['whatsapp', 'email', 'sms', 'push'] as const).map((channel) => (
              <label key={channel} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={prefs[channel]}
                  onChange={(e) => setPrefs({ ...prefs, [channel]: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span className="text-sm text-gray-700 capitalize">{channel === 'sms' ? 'SMS' : channel}</span>
              </label>
            ))}
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
