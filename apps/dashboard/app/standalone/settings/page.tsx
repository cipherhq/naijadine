'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@dineroot/shared';

type DayHours = { open: string; close: string };

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function StandaloneSettingsPage() {
  const restaurant = useRestaurant();
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'booking'>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile state
  const [name, setName] = useState(restaurant.name);
  const [phone, setPhone] = useState(restaurant.phone || '');
  const [email, setEmail] = useState(restaurant.email || '');
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [neighborhood, setNeighborhood] = useState(restaurant.neighborhood);

  // Hours state
  const [hours, setHours] = useState<Record<string, DayHours | null>>(
    restaurant.operating_hours || {},
  );

  // Booking config
  const [depositPerGuest, setDepositPerGuest] = useState(restaurant.deposit_per_guest);
  const [maxPartySize, setMaxPartySize] = useState(restaurant.max_party_size);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(restaurant.advance_booking_days);
  const [cancellationHours, setCancellationHours] = useState(restaurant.cancellation_hours);

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('restaurants')
      .update({ name, phone: phone || null, email: email || null, address, city, neighborhood })
      .eq('id', restaurant.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function saveHours() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('restaurants')
      .update({ operating_hours: hours })
      .eq('id', restaurant.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function saveBooking() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('restaurants')
      .update({
        deposit_per_guest: depositPerGuest,
        max_party_size: maxPartySize,
        advance_booking_days: advanceBookingDays,
        cancellation_hours: cancellationHours,
      })
      .eq('id', restaurant.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const cityKey = city as keyof typeof CITIES;
  const neighborhoods = CITIES[cityKey]?.neighborhoods || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['profile', 'hours', 'booking'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'profile' ? 'Profile' : tab === 'hours' ? 'Operating Hours' : 'Booking Config'}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Restaurant Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setNeighborhood('');
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {Object.entries(CITIES).map(([key, c]) => (
                  <option key={key} value={key}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Neighborhood</label>
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
          <button
            onClick={saveProfile}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Operating Hours */}
      {activeTab === 'hours' && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          {weekdays.map((day) => {
            const dayHours = hours[day];
            const isOpen = dayHours !== null && dayHours !== undefined;
            return (
              <div key={day} className="flex items-center gap-4">
                <label className="flex w-28 items-center gap-2 text-sm font-medium capitalize text-gray-700">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => {
                      setHours({
                        ...hours,
                        [day]: e.target.checked ? { open: '12:00', close: '22:00' } : null,
                      });
                    }}
                    className="rounded border-gray-300 text-brand"
                  />
                  {day}
                </label>
                {isOpen && (
                  <>
                    <input
                      type="time"
                      value={dayHours!.open}
                      onChange={(e) =>
                        setHours({ ...hours, [day]: { ...dayHours!, open: e.target.value } })
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={dayHours!.close}
                      onChange={(e) =>
                        setHours({ ...hours, [day]: { ...dayHours!, close: e.target.value } })
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                    />
                  </>
                )}
                {!isOpen && <span className="text-sm text-gray-400">Closed</span>}
              </div>
            );
          })}
          <button
            onClick={saveHours}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Hours'}
          </button>
        </div>
      )}

      {/* Booking Config */}
      {activeTab === 'booking' && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Deposit per Guest (NGN)</label>
              <input
                type="number"
                value={depositPerGuest}
                onChange={(e) => setDepositPerGuest(parseInt(e.target.value) || 0)}
                min={0}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Set to 0 to disable deposits</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Party Size</label>
              <input
                type="number"
                value={maxPartySize}
                onChange={(e) => setMaxPartySize(parseInt(e.target.value) || 1)}
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Advance Booking Days</label>
              <input
                type="number"
                value={advanceBookingDays}
                onChange={(e) => setAdvanceBookingDays(parseInt(e.target.value) || 1)}
                min={1}
                max={365}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">How far in advance guests can book</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Free Cancellation Hours</label>
              <input
                type="number"
                value={cancellationHours}
                onChange={(e) => setCancellationHours(parseInt(e.target.value) || 0)}
                min={0}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Hours before booking for free cancellation</p>
            </div>
          </div>
          <button
            onClick={saveBooking}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Booking Config'}
          </button>
        </div>
      )}
    </div>
  );
}
