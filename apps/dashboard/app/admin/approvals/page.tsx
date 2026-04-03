'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface PendingRestaurant {
  id: string;
  name: string;
  slug: string;
  city: string;
  neighborhood: string;
  address: string;
  cuisine_types: string[];
  pricing_tier: string;
  product_type: string;
  owner_email: string;
  phone: string;
  created_at: string;
  documents: { id: string; type: string; file_url: string }[];
}

export default function ApprovalsPage() {
  const { verified } = useAdminGuard();
  const [pending, setPending] = useState<PendingRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  async function fetchPending() {
    const supabase = createClient();
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood, address, cuisine_types, pricing_tier, product_type, phone, created_at, profiles:owner_id (email)')
      .eq('status', 'pending_review')
      .order('created_at');

    const restaurants = (data || []).map((r) => {
      const profileRaw = r.profiles as unknown;
      const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        city: r.city,
        neighborhood: r.neighborhood,
        address: r.address,
        cuisine_types: r.cuisine_types || [],
        pricing_tier: r.pricing_tier,
        product_type: r.product_type,
        owner_email: profile?.email || '—',
        phone: r.phone || '',
        created_at: r.created_at,
        documents: [] as { id: string; type: string; file_url: string }[],
      };
    });

    // Fetch documents for each restaurant
    if (restaurants.length > 0) {
      const ids = restaurants.map((r) => r.id);
      const { data: docs } = await supabase
        .from('restaurant_documents')
        .select('id, restaurant_id, document_type, file_url')
        .in('restaurant_id', ids);

      if (docs) {
        for (const doc of docs) {
          const rest = restaurants.find((r) => r.id === doc.restaurant_id);
          if (rest) {
            rest.documents.push({ id: doc.id, type: doc.document_type, file_url: doc.file_url });
          }
        }
      }
    }

    setPending(restaurants);
    setLoading(false);
  }

  useEffect(() => {
    if (verified) fetchPending();
  }, [verified]);

  async function approve(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('restaurants').update({ status: 'approved' }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'restaurant_approved',
      entity_type: 'restaurant',
      entity_id: id,
      user_id: user.id,
      details: { status: 'approved' },
    });

    fetchPending();
  }

  async function reject(id: string) {
    if (!rejectionReason) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('restaurants')
      .update({ status: 'rejected', rejection_reason: rejectionReason })
      .eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'restaurant_rejected',
      entity_type: 'restaurant',
      entity_id: id,
      user_id: user.id,
      details: { status: 'rejected', reason: rejectionReason },
    });

    setSelectedId(null);
    setRejectionReason('');
    fetchPending();
  }

  if (!verified || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
      <p className="mt-1 text-sm text-gray-500">{pending.length} applications awaiting review</p>

      {pending.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-lg text-gray-400">All caught up!</p>
          <p className="mt-1 text-sm text-gray-300">No pending restaurant applications</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{r.name}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {r.neighborhood}, {r.city.replace(/_/g, ' ')} &middot; {r.address}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                  Pending
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-gray-400">Owner</span>
                  <p className="font-medium text-gray-700">{r.owner_email}</p>
                </div>
                <div>
                  <span className="text-gray-400">Phone</span>
                  <p className="font-medium text-gray-700">{r.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Type</span>
                  <p className="font-medium capitalize text-gray-700">{r.product_type}</p>
                </div>
                <div>
                  <span className="text-gray-400">Cuisine</span>
                  <p className="font-medium text-gray-700">
                    {r.cuisine_types.map((c) => c.replace(/_/g, ' ')).join(', ')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Pricing</span>
                  <p className="font-medium capitalize text-gray-700">{r.pricing_tier.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-400">Applied</span>
                  <p className="font-medium text-gray-700">
                    {new Date(r.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Documents */}
              {r.documents.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-medium text-gray-400">Documents</span>
                  <div className="mt-1 flex gap-2">
                    {r.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-50"
                      >
                        {doc.type.replace('_', ' ')}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-3 border-t border-gray-50 pt-4">
                <button
                  onClick={() => approve(r.id)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Approve
                </button>
                {selectedId === r.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      placeholder="Rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400"
                    />
                    <button
                      onClick={() => reject(r.id)}
                      disabled={!rejectionReason}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setSelectedId(null); setRejectionReason(''); }}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
