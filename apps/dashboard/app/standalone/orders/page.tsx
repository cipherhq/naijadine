'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@naijadine/shared';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  line_total: number;
}

interface Order {
  id: string;
  reference_code: string;
  order_type: string;
  status: string;
  subtotal: number;
  delivery_fee: number | null;
  total: number;
  delivery_address: string | null;
  special_instructions: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
}

const statusOptions = ['all', 'pending_payment', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'];

const nextActions: Record<string, { label: string; next: string; color: string }[]> = {
  confirmed: [
    { label: 'Start Preparing', next: 'preparing', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100' },
    { label: 'Cancel', next: 'cancelled', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
  ],
  preparing: [
    { label: 'Mark Ready', next: 'ready', color: 'text-green-700 bg-green-50 hover:bg-green-100' },
  ],
  ready: [
    { label: 'Picked Up', next: 'picked_up', color: 'text-gray-700 bg-gray-100 hover:bg-gray-200' },
    { label: 'Delivered', next: 'delivered', color: 'text-green-700 bg-green-50 hover:bg-green-100' },
  ],
};

function getCategoryLabels(category: string | null) {
  switch (category) {
    case 'church':
      return { pageTitle: 'Offerings', subtitle: 'Manage tithes, offerings, and donations',
               emptyText: 'No offerings received yet.', itemsLabel: 'Offerings',
               customerLabel: 'Giver', hideType: true, hideQuantity: true };
    case 'cinema':
      return { pageTitle: 'Tickets', subtitle: 'Manage movie ticket purchases',
               emptyText: 'No ticket purchases yet.', itemsLabel: 'Tickets',
               customerLabel: 'Customer', hideType: true, hideQuantity: false };
    case 'events':
      return { pageTitle: 'Tickets', subtitle: 'Manage event ticket sales',
               emptyText: 'No ticket purchases yet.', itemsLabel: 'Tickets',
               customerLabel: 'Customer', hideType: true, hideQuantity: false };
    case 'shop':
      return { pageTitle: 'Orders', subtitle: 'Manage product orders',
               emptyText: 'No orders found.', itemsLabel: 'Items',
               customerLabel: 'Customer', hideType: false, hideQuantity: false };
    default:
      return { pageTitle: 'Orders', subtitle: 'Manage orders and transactions',
               emptyText: 'No orders found.', itemsLabel: 'Items',
               customerLabel: 'Customer', hideType: false, hideQuantity: false };
  }
}

export default function StandaloneOrdersPage() {
  const restaurant = useRestaurant();
  const labels = getCategoryLabels(restaurant.business_category);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);

  const selectedOrder = orders.find((o) => o.id === selectedId) || null;

  useEffect(() => {
    loadOrders();
    const supabase = createClient();
    const channel = supabase
      .channel('standalone-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => loadOrders(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, dateFilter]);

  async function loadOrders() {
    const supabase = createClient();
    let query = supabase
      .from('orders')
      .select('id, reference_code, order_type, status, subtotal, delivery_fee, total, delivery_address, special_instructions, customer_name, customer_phone, customer_email, confirmed_at, cancelled_at, cancelled_by, created_at')
      .eq('restaurant_id', restaurant.id)
      .not('status', 'eq', 'cart')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (dateFilter) {
      query = query.gte('created_at', `${dateFilter}T00:00:00`).lte('created_at', `${dateFilter}T23:59:59`);
    }

    const { data } = await query;
    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  async function loadOrderItems(orderId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('order_items')
      .select('id, name, price, quantity, line_total')
      .eq('order_id', orderId);
    setSelectedItems((data || []) as OrderItem[]);
  }

  async function updateStatus(id: string, newStatus: string) {
    const supabase = createClient();
    const extra: Record<string, unknown> = {};
    if (newStatus === 'confirmed') extra.confirmed_at = new Date().toISOString();
    if (newStatus === 'cancelled') {
      extra.cancelled_at = new Date().toISOString();
      extra.cancelled_by = 'restaurant';
    }

    await supabase
      .from('orders')
      .update({ status: newStatus, ...extra })
      .eq('id', id);
    loadOrders();
  }

  // Load items when selection changes
  useEffect(() => {
    if (selectedId) {
      loadOrderItems(selectedId);
    } else {
      setSelectedItems([]);
    }
  }, [selectedId]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending_payment: 'bg-yellow-50 text-yellow-700',
      confirmed: 'bg-green-50 text-green-700',
      preparing: 'bg-blue-50 text-blue-700',
      ready: 'bg-purple-50 text-purple-700',
      picked_up: 'bg-gray-100 text-gray-700',
      delivered: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-50 text-red-600',
    };
    return map[s] || 'bg-gray-100 text-gray-600';
  };

  const formatStatus = (s: string) => s.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{labels.pageTitle}</h1>
        <p className="text-sm text-gray-500">{labels.subtitle}</p>
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
              {s === 'all' ? 'All Statuses' : formatStatus(s)}
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
        ) : orders.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">{labels.emptyText}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">{labels.customerLabel}</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  {!labels.hideType && <th className="px-4 py-3 font-medium">Type</th>}
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedId(o.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand">{o.reference_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.customer_name || '—'}</p>
                      <p className="text-xs text-gray-400">{o.customer_phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(o.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </td>
                    {!labels.hideType && (
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          o.order_type === 'delivery'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {o.order_type}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-900">{formatNaira(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(o.status)}`}>
                        {formatStatus(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {(nextActions[o.status] || []).map((action) => (
                          <button
                            key={action.next}
                            onClick={() => updateStatus(o.id, action.next)}
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

      {/* Detail Slide-over Panel */}
      {selectedOrder && (
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
                <p className="font-mono text-lg font-bold text-brand">{selectedOrder.reference_code}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(selectedOrder.status)}`}>
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* Customer info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Customer</h3>
                <p className="mt-1 text-sm font-medium text-gray-900">{selectedOrder.customer_name || '—'}</p>
                {selectedOrder.customer_phone && <p className="text-sm text-gray-500">{selectedOrder.customer_phone}</p>}
                {selectedOrder.customer_email && <p className="text-sm text-gray-400">{selectedOrder.customer_email}</p>}
              </div>

              {/* Order items */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">{labels.itemsLabel}</h3>
                <div className="mt-2 space-y-2">
                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-gray-400">Loading...</p>
                  ) : (
                    selectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {!labels.hideQuantity && <span className="ml-2 text-gray-400">x{item.quantity}</span>}
                        </div>
                        <span className="font-medium text-gray-700">{formatNaira(item.line_total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pricing breakdown */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Payment</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700">{formatNaira(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.delivery_fee != null && selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Delivery Fee</span>
                      <span className="text-gray-700">{formatNaira(selectedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{formatNaira(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Order details */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Details</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  {!labels.hideType && (
                    <div>
                      <span className="text-gray-400">Type</span>
                      <p className="font-medium text-gray-900 capitalize">{selectedOrder.order_type}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Date</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedOrder.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery address */}
              {selectedOrder.order_type === 'delivery' && selectedOrder.delivery_address && (
                <div className="rounded-lg bg-orange-50 p-3">
                  <h3 className="text-sm font-medium text-orange-800">Delivery Address</h3>
                  <p className="mt-1 text-sm text-orange-700">{selectedOrder.delivery_address}</p>
                </div>
              )}

              {/* Special instructions */}
              {selectedOrder.special_instructions && (
                <div className="rounded-lg bg-yellow-50 p-3">
                  <h3 className="text-sm font-medium text-yellow-800">Special Instructions</h3>
                  <p className="mt-1 text-sm text-yellow-700">{selectedOrder.special_instructions}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Timeline</h3>
                <div className="mt-2 space-y-2 text-sm">
                  <TimelineItem label="Created" time={selectedOrder.created_at} />
                  <TimelineItem label="Confirmed" time={selectedOrder.confirmed_at} />
                  {selectedOrder.status === 'cancelled' && (
                    <TimelineItem label="Cancelled" time={selectedOrder.cancelled_at} />
                  )}
                </div>
              </div>

              {/* Actions */}
              {nextActions[selectedOrder.status] && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Actions</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextActions[selectedOrder.status].map((action) => (
                      <button
                        key={action.next}
                        onClick={() => {
                          updateStatus(selectedOrder.id, action.next);
                          setSelectedId(null);
                        }}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
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
