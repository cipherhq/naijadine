'use client';

import { useEffect, useState } from 'react';
import { useRestaurant, useDashboard } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Reservation {
  id: string;
  reference_code: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
  guest_name: string | null;
  guest_phone: string | null;
  special_requests: string | null;
  channel: string;
  created_at: string;
  confirmed_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  booking_type: string | null;
}

const statusOptions = ['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];

const nextActions: Record<string, { label: string; next: string; color: string }[]> = {
  pending: [
    { label: 'Confirm', next: 'confirmed', color: 'text-green-700 bg-green-50 hover:bg-green-100' },
    { label: 'Cancel', next: 'cancelled', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
  ],
  confirmed: [
    { label: 'Seat', next: 'seated', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100' },
    { label: 'Cancel', next: 'cancelled', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
  ],
  seated: [
    { label: 'Complete', next: 'completed', color: 'text-gray-700 bg-gray-100 hover:bg-gray-200' },
  ],
};

export default function StandaloneReservationsPage() {
  const restaurant = useRestaurant();
  const { userId } = useDashboard();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Add reservation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    guest_name: '',
    guest_phone: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    party_size: 2,
    channel: 'phone' as 'phone' | 'walk_in',
    special_requests: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ date: '', time: '', party_size: 0, special_requests: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const selectedReservation = reservations.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    loadReservations();
    const supabase = createClient();
    const channel = supabase
      .channel('standalone-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => loadReservations(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, dateFilter]);

  async function loadReservations() {
    const supabase = createClient();
    let query = supabase
      .from('reservations')
      .select('id, reference_code, date, time, party_size, status, guest_name, guest_phone, special_requests, channel, created_at, confirmed_at, seated_at, completed_at, cancelled_at, booking_type')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (dateFilter) {
      query = query.eq('date', dateFilter);
    }

    const { data } = await query;
    setReservations((data || []) as Reservation[]);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const supabase = createClient();
    const extra: Record<string, unknown> = {};
    if (newStatus === 'confirmed') extra.confirmed_at = new Date().toISOString();
    if (newStatus === 'seated') extra.seated_at = new Date().toISOString();
    if (newStatus === 'completed') extra.completed_at = new Date().toISOString();
    if (newStatus === 'cancelled') extra.cancelled_at = new Date().toISOString();

    await supabase
      .from('reservations')
      .update({ status: newStatus, ...extra })
      .eq('id', id);
    loadReservations();
  }

  async function addReservation() {
    if (!addForm.guest_name || !addForm.date || !addForm.time) return;
    setAddSaving(true);
    const supabase = createClient();

    const { data: rest } = await supabase
      .from('restaurants')
      .select('owner_id')
      .eq('id', restaurant.id)
      .single();

    await supabase.from('reservations').insert({
      restaurant_id: restaurant.id,
      user_id: rest?.owner_id || userId,
      date: addForm.date,
      time: addForm.time,
      party_size: addForm.party_size,
      channel: addForm.channel,
      guest_name: addForm.guest_name,
      guest_phone: addForm.guest_phone || null,
      special_requests: addForm.special_requests || null,
      status: 'confirmed',
      booking_type: 'manual',
      deposit_amount: 0,
      deposit_status: 'none',
      confirmed_at: new Date().toISOString(),
    });

    setAddSaving(false);
    setShowAddModal(false);
    setAddForm({
      guest_name: '',
      guest_phone: '',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
      party_size: 2,
      channel: 'phone',
      special_requests: '',
    });
  }

  async function saveEdit() {
    if (!selectedId) return;
    setEditSaving(true);
    const supabase = createClient();
    await supabase
      .from('reservations')
      .update({
        date: editFields.date,
        time: editFields.time,
        party_size: editFields.party_size,
        special_requests: editFields.special_requests || null,
      })
      .eq('id', selectedId);
    setEditSaving(false);
    loadReservations();
  }

  async function cancelWithReason() {
    if (!selectedId) return;
    const supabase = createClient();
    await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancelReason || null,
      })
      .eq('id', selectedId);
    setCancelReason('');
    setSelectedId(null);
    loadReservations();
  }

  // Sync edit fields when selection changes
  useEffect(() => {
    if (selectedReservation) {
      setEditFields({
        date: selectedReservation.date,
        time: selectedReservation.time,
        party_size: selectedReservation.party_size,
        special_requests: selectedReservation.special_requests || '',
      });
      setCancelReason('');
    }
  }, [selectedId, selectedReservation?.date, selectedReservation?.time, selectedReservation?.party_size, selectedReservation?.special_requests]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-green-50 text-green-700',
      pending: 'bg-yellow-50 text-yellow-700',
      seated: 'bg-blue-50 text-blue-700',
      completed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-50 text-red-600',
      no_show: 'bg-orange-50 text-orange-600',
    };
    return map[s] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          + New Reservation
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Clear date
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No reservations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Party</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservations.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand">{r.reference_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.guest_name || '—'}</p>
                      <p className="text-xs text-gray-400">{r.guest_phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.date}</td>
                    <td className="px-4 py-3 text-gray-600">{r.time}</td>
                    <td className="px-4 py-3 text-gray-600">{r.party_size}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.channel === 'whatsapp'
                          ? 'bg-[#25D366]/10 text-[#25D366]'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {r.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {(nextActions[r.status] || []).map((action) => (
                          <button
                            key={action.next}
                            onClick={() => updateStatus(r.id, action.next)}
                            className={`rounded px-2 py-1 text-xs font-medium ${action.color}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">New Reservation</h2>
            <p className="mt-1 text-sm text-gray-500">Add a walk-in or phone reservation</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Guest Name *</label>
                <input
                  type="text"
                  value={addForm.guest_name}
                  onChange={(e) => setAddForm({ ...addForm, guest_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="e.g. Ade Johnson"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Guest Phone</label>
                <input
                  type="tel"
                  value={addForm.guest_phone}
                  onChange={(e) => setAddForm({ ...addForm, guest_phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="+2348012345678"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
                  <input
                    type="date"
                    value={addForm.date}
                    onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Time *</label>
                  <input
                    type="time"
                    value={addForm.time}
                    onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Party Size *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={addForm.party_size}
                    onChange={(e) => setAddForm({ ...addForm, party_size: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
                  <select
                    value={addForm.channel}
                    onChange={(e) => setAddForm({ ...addForm, channel: e.target.value as 'phone' | 'walk_in' })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  >
                    <option value="phone">Phone</option>
                    <option value="walk_in">Walk-in</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Special Requests</label>
                <textarea
                  value={addForm.special_requests}
                  onChange={(e) => setAddForm({ ...addForm, special_requests: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Any notes..."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addReservation}
                disabled={addSaving || !addForm.guest_name}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {addSaving ? 'Adding...' : 'Add Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Slide-over Panel */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedId(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div
            className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setSelectedId(null)}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <p className="font-mono text-lg font-bold text-brand">{selectedReservation.reference_code}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(selectedReservation.status)}`}>
                  {selectedReservation.status.replace('_', ' ')}
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* Guest info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Guest</h3>
                <p className="mt-1 text-sm font-medium text-gray-900">{selectedReservation.guest_name || '—'}</p>
                {selectedReservation.guest_phone && <p className="text-sm text-gray-500">{selectedReservation.guest_phone}</p>}
              </div>

              {/* Booking details */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Booking Details</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Date</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedReservation.date + 'T00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Time</span>
                    <p className="font-medium text-gray-900">{selectedReservation.time}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Party Size</span>
                    <p className="font-medium text-gray-900">{selectedReservation.party_size}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Channel</span>
                    <p className="font-medium text-gray-900">{selectedReservation.channel}</p>
                  </div>
                </div>
              </div>

              {/* Special requests */}
              {selectedReservation.special_requests && (
                <div className="rounded-lg bg-yellow-50 p-3">
                  <h3 className="text-sm font-medium text-yellow-800">Special Requests</h3>
                  <p className="mt-1 text-sm text-yellow-700">{selectedReservation.special_requests}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Timeline</h3>
                <div className="mt-2 space-y-2 text-sm">
                  <TimelineItem label="Created" time={selectedReservation.created_at} />
                  <TimelineItem label="Confirmed" time={selectedReservation.confirmed_at} />
                  <TimelineItem label="Seated" time={selectedReservation.seated_at} />
                  <TimelineItem label="Completed" time={selectedReservation.completed_at} />
                  {selectedReservation.status === 'cancelled' && (
                    <TimelineItem label="Cancelled" time={selectedReservation.cancelled_at} />
                  )}
                </div>
              </div>

              {/* Actions */}
              {nextActions[selectedReservation.status] && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Actions</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextActions[selectedReservation.status].map((action) => (
                      <button
                        key={action.next}
                        onClick={() => updateStatus(selectedReservation.id, action.next)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit section */}
              {!['cancelled', 'completed', 'no_show'].includes(selectedReservation.status) && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-500">Edit Reservation</h3>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Date</label>
                        <input
                          type="date"
                          value={editFields.date}
                          onChange={(e) => setEditFields({ ...editFields, date: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Time</label>
                        <input
                          type="time"
                          value={editFields.time}
                          onChange={(e) => setEditFields({ ...editFields, time: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Party Size</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editFields.party_size}
                        onChange={(e) => setEditFields({ ...editFields, party_size: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Special Requests</label>
                      <textarea
                        value={editFields.special_requests}
                        onChange={(e) => setEditFields({ ...editFields, special_requests: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                    </div>
                    <button
                      onClick={saveEdit}
                      disabled={editSaving}
                      className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      {editSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel with reason */}
              {['pending', 'confirmed'].includes(selectedReservation.status) && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-red-600">Cancel Reservation</h3>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-300"
                    />
                    <button
                      onClick={cancelWithReason}
                      className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Cancel Reservation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ label, time }: { label: string; time: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2 w-2 rounded-full ${time ? 'bg-brand' : 'bg-gray-200'}`} />
      <span className={`w-20 ${time ? 'text-gray-700' : 'text-gray-300'}`}>{label}</span>
      {time && (
        <span className="text-gray-400">
          {new Date(time).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
