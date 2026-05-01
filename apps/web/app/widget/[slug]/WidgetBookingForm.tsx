'use client';

import { useState } from 'react';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  cover_photo_url: string | null;
  neighborhood: string;
  city: string;
  deposit_per_guest: number;
  max_party_size: number;
  advance_booking_days: number;
}

export function WidgetBookingForm({ restaurant }: { restaurant: Restaurant }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + (restaurant.advance_booking_days || 30));

  const times: string[] = [];
  for (let h = 11; h <= 22; h++) {
    times.push(`${h}:00`);
    if (h < 22) times.push(`${h}:30`);
  }

  const deposit = (restaurant.deposit_per_guest || 0) * partySize;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Redirect to DineRoot booking page
    const params = new URLSearchParams({
      date,
      time,
      party_size: String(partySize),
      name,
      phone,
      source: 'widget',
    });
    window.open(
      `https://dineroot.com/booking/${restaurant.slug}?${params}`,
      '_blank',
    );
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Booking Started</h2>
        <p style={{ color: '#666', fontSize: 14 }}>
          Complete your reservation on DineRoot.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          style={{
            marginTop: 20,
            padding: '10px 24px',
            background: '#F04E37',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Book Another
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{restaurant.name}</h2>
        <p style={{ color: '#888', fontSize: 13 }}>
          {restaurant.neighborhood}, {restaurant.city.replace(/_/g, ' ')}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#333' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={today}
            max={maxDate.toISOString().split('T')[0]}
            required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        {/* Time */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#333' }}>Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
          >
            <option value="">Select a time...</option>
            {times.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Party size */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#333' }}>Guests</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))}
              style={{ width: 36, height: 36, border: '1px solid #ddd', borderRadius: 8, fontSize: 18, cursor: 'pointer', background: '#f9f9f9' }}>-</button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{partySize}</span>
            <button type="button" onClick={() => setPartySize(Math.min(restaurant.max_party_size || 20, partySize + 1))}
              style={{ width: 36, height: 36, border: '1px solid #ddd', borderRadius: 8, fontSize: 18, cursor: 'pointer', background: '#f9f9f9' }}>+</button>
          </div>
        </div>

        {/* Name & Phone */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#333' }}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#333' }}>Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+234..."
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        </div>

        {/* Deposit info */}
        {deposit > 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            Deposit: <strong>₦{deposit.toLocaleString()}</strong> ({restaurant.deposit_per_guest.toLocaleString()}/guest)
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={!date || !time || !name || !phone}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#F04E37',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: (!date || !time || !name || !phone) ? 0.5 : 1,
          }}
        >
          Book Now
        </button>
      </form>

      {/* Powered by */}
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#bbb' }}>
        Powered by <a href="https://dineroot.com" target="_blank" rel="noopener noreferrer" style={{ color: '#F04E37', textDecoration: 'none', fontWeight: 600 }}>DineRoot</a>
      </p>
    </div>
  );
}
