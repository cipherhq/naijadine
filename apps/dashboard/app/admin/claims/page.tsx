'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Claim {
  id: string;
  claimant_name: string;
  claimant_email: string;
  claimant_phone: string;
  role_at_restaurant: string;
  proof_description: string | null;
  verification_method: string | null;
  cac_registration_number: string | null;
  address_on_proof: string | null;
  fraud_flags: string[];
  status: string;
  created_at: string;
  restaurants: { name: string; city: string; neighborhood: string; address: string } | null;
}

const flagColors: Record<string, string> = {
  COMPETING_CLAIM_EXISTS: 'bg-red-100 text-red-700',
  PHONE_MISMATCH: 'bg-amber-100 text-amber-700',
  NO_DOCUMENT_PROVIDED: 'bg-yellow-100 text-yellow-700',
  ADDRESS_MISMATCH: 'bg-red-100 text-red-700',
};

export default function AdminClaimsPage() {
  const supabase = createClient();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function fetchClaims() {
    const { data } = await supabase
      .from('restaurant_claims')
      .select('*, restaurants(name, city, neighborhood, address)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    setClaims((data || []) as unknown as Claim[]);
    setLoading(false);
  }

  useEffect(() => { fetchClaims(); }, []);

  async function approve(claimId: string) {
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;

    // Transfer ownership
    const { data: claimData } = await supabase
      .from('restaurant_claims')
      .select('restaurant_id, claimant_id')
      .eq('id', claimId)
      .single();

    if (claimData) {
      await supabase.from('restaurants').update({ owner_id: claimData.claimant_id }).eq('id', claimData.restaurant_id);
      await supabase.from('profiles').update({ role: 'restaurant_owner' }).eq('id', claimData.claimant_id);
    }

    await supabase.from('restaurant_claims').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    }).eq('id', claimId);

    // Reject other pending claims for same restaurant
    if (claimData) {
      await supabase.from('restaurant_claims').update({
        status: 'rejected',
        admin_notes: 'Another claim was approved',
        reviewed_at: new Date().toISOString(),
      }).eq('restaurant_id', claimData.restaurant_id).eq('status', 'pending').neq('id', claimId);
    }

    fetchClaims();
  }

  async function reject(claimId: string) {
    await supabase.from('restaurant_claims').update({
      status: 'rejected',
      admin_notes: rejectReason,
      reviewed_at: new Date().toISOString(),
    }).eq('id', claimId);

    setRejectId(null);
    setRejectReason('');
    fetchClaims();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Restaurant Claims</h1>
      <p className="mt-1 text-sm text-gray-500">{claims.length} pending claim{claims.length !== 1 ? 's' : ''} to review</p>

      {claims.length === 0 ? (
        <div className="mt-12 text-center py-12"><p className="text-gray-400">No pending claims</p></div>
      ) : (
        <div className="mt-6 space-y-4">
          {claims.map((claim) => (
            <div key={claim.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{claim.restaurants?.name}</h3>
                  <p className="text-sm text-gray-500">{claim.restaurants?.neighborhood}, {claim.restaurants?.city?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{claim.restaurants?.address}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(claim.created_at).toLocaleDateString()}</span>
              </div>

              {/* Claimant info */}
              <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 text-sm">
                <div><span className="text-gray-500">Name:</span> <strong>{claim.claimant_name}</strong></div>
                <div><span className="text-gray-500">Role:</span> <strong className="capitalize">{claim.role_at_restaurant}</strong></div>
                <div><span className="text-gray-500">Email:</span> {claim.claimant_email}</div>
                <div><span className="text-gray-500">Phone:</span> {claim.claimant_phone}</div>
                {claim.verification_method && <div><span className="text-gray-500">Verification:</span> {claim.verification_method.replace(/_/g, ' ')}</div>}
                {claim.cac_registration_number && <div><span className="text-gray-500">CAC:</span> {claim.cac_registration_number}</div>}
              </div>

              {claim.proof_description && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Proof:</strong> {claim.proof_description}
                </div>
              )}

              {claim.address_on_proof && (
                <div className="mt-2 text-xs text-gray-500">
                  Address on document: <strong>{claim.address_on_proof}</strong>
                </div>
              )}

              {/* Fraud flags */}
              {claim.fraud_flags && claim.fraud_flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {claim.fraud_flags.map((flag) => (
                    <span key={flag} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${flagColors[flag] || 'bg-gray-100 text-gray-600'}`}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              {rejectId === claim.id ? (
                <div className="mt-4 flex gap-2">
                  <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand" />
                  <button onClick={() => reject(claim.id)} disabled={!rejectReason}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                  <button onClick={() => setRejectId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => approve(claim.id)}
                    className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">
                    Approve & Transfer
                  </button>
                  <button onClick={() => setRejectId(claim.id)}
                    className="rounded-lg border border-red-200 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
