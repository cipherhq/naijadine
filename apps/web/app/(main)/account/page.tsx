'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CITIES, LOYALTY_TIERS } from '@dineroot/shared';

type Tab = 'profile' | 'notifications' | 'security';

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string | null;
  avatar_url: string | null;
  loyalty_tier: string;
  loyalty_points: number;
  dietary_preferences: string[];
  notification_prefs: { whatsapp: boolean; sms: boolean; email: boolean; push: boolean };
  last_login_at: string | null;
  created_at: string;
}

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free',
  'Lactose-Free', 'Nut Allergy', 'Pescatarian', 'None',
] as const;

const cityOptions = Object.entries(CITIES).map(([key, city]) => ({
  value: key,
  label: city.name,
}));

function getTierConfig(tier: string) {
  const t = LOYALTY_TIERS[tier as keyof typeof LOYALTY_TIERS];
  return t || LOYALTY_TIERS.bronze;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('profile');

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification form
  const [prefs, setPrefs] = useState({ whatsapp: true, sms: true, email: true, push: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?redirect=/account'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone, city, avatar_url, loyalty_tier, loyalty_points, dietary_preferences, notification_prefs, last_login_at, created_at')
        .eq('id', user.id)
        .single();

      if (data) {
        const p = data as Profile;
        setProfile(p);
        setFirstName(p.first_name || '');
        setLastName(p.last_name || '');
        setEmail(p.email || '');
        setCity(p.city || '');
        setDietary(Array.isArray(p.dietary_preferences) ? p.dietary_preferences : []);
        setPrefs(p.notification_prefs || { whatsapp: true, sms: true, email: true, push: true });
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          city: city || null,
          dietary_preferences: dietary.filter(d => d !== 'None'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: 'error', text: data.message || 'Failed to save.' });
      } else {
        setProfileMsg({ type: 'success', text: 'Profile updated!' });
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSavingProfile(false);
  }

  async function handleSaveNotifications() {
    setSavingPrefs(true);
    setPrefsMsg(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: prefs })
        .eq('id', user.id);

      setPrefsMsg(error
        ? { type: 'error', text: 'Failed to save notification preferences.' }
        : { type: 'success', text: 'Notification preferences updated!' }
      );
    } catch {
      setPrefsMsg({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSavingPrefs(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: 'error', text: error.message });
      } else {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Failed to update password.' });
    }
    setSavingPassword(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ is_suspended: true })
        .eq('id', user.id);

      await supabase.auth.signOut();
      router.push('/');
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function toggleDietary(option: string) {
    if (option === 'None') {
      setDietary(dietary.includes('None') ? [] : ['None']);
      return;
    }
    const filtered = dietary.filter(d => d !== 'None');
    if (filtered.includes(option)) {
      setDietary(filtered.filter(d => d !== option));
    } else {
      setDietary([...filtered, option]);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const tier = getTierConfig(profile?.loyalty_tier || 'bronze');
  const initials = `${(profile?.first_name || '')[0] || ''}${(profile?.last_name || '')[0] || ''}`.toUpperCase() || '?';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
    : '';

  const menuItems = [
    { href: '/account/bookings', label: 'My Bookings', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { href: '/account/favorites', label: 'Saved Restaurants', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { href: '/account/loyalty', label: 'Loyalty & Rewards', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: tier.color }}
        >
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {profile?.first_name} {profile?.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: tier.color }}
            >
              {tier.name}
            </span>
            {memberSince && (
              <span className="text-xs text-gray-400">Member since {memberSince}</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 text-center hover:border-brand-100 hover:bg-brand-50/30 transition"
          >
            <svg className="h-6 w-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-8 flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {/* ── Profile Tab ── */}
        {tab === 'profile' && (
          <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">Select city</option>
                {cityOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Dietary Preferences</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((option) => {
                  const active = dietary.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleDietary(option)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                        active
                          ? 'bg-brand text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {profileMsg && (
              <p className={`text-sm ${profileMsg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {profileMsg.text}
              </p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* ── Notifications Tab ── */}
        {tab === 'notifications' && (
          <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-6">
            <p className="text-sm text-gray-500">Choose how you want to receive notifications.</p>
            <div className="space-y-4">
              {([
                { key: 'whatsapp' as const, label: 'WhatsApp', desc: 'Booking confirmations & reminders via WhatsApp' },
                { key: 'email' as const, label: 'Email', desc: 'Booking receipts and updates' },
                { key: 'sms' as const, label: 'SMS', desc: 'Text message notifications' },
                { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications' },
              ]).map((channel) => (
                <label key={channel.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{channel.label}</p>
                    <p className="text-xs text-gray-400">{channel.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[channel.key]}
                    onClick={() => setPrefs({ ...prefs, [channel.key]: !prefs[channel.key] })}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                      prefs[channel.key] ? 'bg-brand' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                        prefs[channel.key] ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>

            {prefsMsg && (
              <p className={`text-sm ${prefsMsg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {prefsMsg.text}
              </p>
            )}

            <button
              onClick={handleSaveNotifications}
              disabled={savingPrefs}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        )}

        {/* ── Security Tab ── */}
        {tab === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Change Password</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {passwordMsg.text}
                </p>
              )}

              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>

            {/* Account Information */}
            <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Account Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-gray-900">{profile?.email || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="text-gray-900">{profile?.phone || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Member since</span>
                  <span className="text-gray-900">{memberSince || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last login</span>
                  <span className="text-gray-900">
                    {profile?.last_login_at
                      ? new Date(profile.last_login_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-100 bg-white p-6">
              <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
              <p className="mt-1 text-xs text-gray-500">
                Deleting your account is permanent and cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-4 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Account
                </button>
              ) : (
                <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">
                    Are you sure? This will permanently delete your account and all data.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
