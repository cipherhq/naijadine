'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  city: string;
  neighborhood: string;
  address: string;
  cover_photo_url: string | null;
}

interface Claim {
  id: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  restaurants: { name: string; city: string; neighborhood: string; cover_photo_url: string | null } | null;
}

export default function ClaimRestaurantPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'search' | 'form' | 'submitted'>('search');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('owner');
  const [proof, setProof] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [addressOnProof, setAddressOnProof] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if not authenticated
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
    }
    checkAuth();
    loadMyClaims();
  }, []);

  async function loadMyClaims() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('restaurant_claims')
      .select('id, status, created_at, admin_notes, restaurants(name, city, neighborhood, cover_photo_url)')
      .eq('claimant_id', user.id)
      .order('created_at', { ascending: false });

    setMyClaims((data || []) as unknown as Claim[]);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);

    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood, address, cover_photo_url')
      .in('status', ['active', 'approved'])
      .ilike('name', `%${search}%`)
      .order('name')
      .limit(20);

    setResults(data || []);
    setSearching(false);
  }

  async function handleSubmitClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in');
      setSubmitting(false);
      return;
    }

    const { error: claimError } = await supabase.from('restaurant_claims').insert({
      restaurant_id: selected.id,
      claimant_id: user.id,
      claimant_name: name,
      claimant_email: email,
      claimant_phone: phone,
      role_at_restaurant: role,
      proof_description: proof,
      verification_method: verificationMethod || null,
      cac_registration_number: cacNumber || null,
      address_on_proof: addressOnProof || null,
    });

    if (claimError) {
      setError(claimError.message.includes('duplicate')
        ? 'You already have a claim for this restaurant'
        : claimError.message);
      setSubmitting(false);
      return;
    }

    setStep('submitted');
    loadMyClaims();
    setSubmitting(false);
  }

  const cityLabel = (city: string) =>
    city.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Claim Your Restaurant</h1>
          <p className="mt-2 text-gray-500">
            Find your restaurant on DineRoot and claim ownership to manage it from the dashboard
          </p>
        </div>

        {/* Existing Claims */}
        {myClaims.length > 0 && (
          <div className="mb-8 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Your Claims</h3>
            {myClaims.map((claim) => (
              <div key={claim.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                {claim.restaurants?.cover_photo_url ? (
                  <img src={claim.restaurants.cover_photo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-lg font-bold text-brand">
                    {claim.restaurants?.name?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{claim.restaurants?.name}</p>
                  <p className="text-xs text-gray-500">{claim.restaurants?.neighborhood}, {cityLabel(claim.restaurants?.city || '')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  claim.status === 'approved' ? 'bg-green-100 text-green-700' :
                  claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {claim.status}
                </span>
              </div>
            ))}
            {myClaims.some((c) => c.status === 'approved') && (
              <button
                onClick={() => { router.push('/'); router.refresh(); }}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Go to Dashboard &rarr;
              </button>
            )}
          </div>
        )}

        {/* Step: Search */}
        {step === 'search' && (
          <>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for your restaurant name..."
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <button
                type="submit"
                disabled={searching || !search.trim()}
                className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {results.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-500">{results.length} restaurant{results.length !== 1 ? 's' : ''} found</p>
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setStep('form'); }}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-brand hover:shadow-sm"
                  >
                    {r.cover_photo_url ? (
                      <img src={r.cover_photo_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-xl font-bold text-brand">
                        {r.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{r.name}</p>
                      <p className="text-sm text-gray-500">{r.neighborhood}, {cityLabel(r.city)}</p>
                      <p className="text-xs text-gray-400">{r.address}</p>
                    </div>
                    <span className="text-sm font-medium text-brand">Claim &rarr;</span>
                  </button>
                ))}
              </div>
            )}

            {results.length === 0 && search && !searching && (
              <div className="mt-8 text-center">
                <p className="text-gray-500">No restaurants found matching &quot;{search}&quot;</p>
                <p className="mt-2 text-sm text-gray-400">
                  Can&apos;t find your restaurant?{' '}
                  <button
                    onClick={() => router.push('/onboarding')}
                    className="font-medium text-brand hover:underline"
                  >
                    Register a new restaurant
                  </button>
                </p>
              </div>
            )}
          </>
        )}

        {/* Step: Claim Form */}
        {step === 'form' && selected && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            {/* Selected restaurant */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4 mb-6">
              {selected.cover_photo_url ? (
                <img src={selected.cover_photo_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-50 text-2xl font-bold text-brand">
                  {selected.name.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.neighborhood}, {cityLabel(selected.city)}</p>
              </div>
              <button
                onClick={() => { setStep('search'); setSelected(null); }}
                className="ml-auto text-sm text-gray-400 hover:text-gray-600"
              >
                Change
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Your Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+234..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Your Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand">
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Verification Method</label>
                <select value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand">
                  <option value="">Select how to verify you...</option>
                  <option value="cac_certificate">CAC Registration Certificate</option>
                  <option value="utility_bill">Utility Bill (matching restaurant address)</option>
                  <option value="bank_statement">Business Bank Statement</option>
                  <option value="business_card">Business Card / Staff ID</option>
                  <option value="phone_callback">Phone Callback (we call the restaurant)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {verificationMethod === 'cac_certificate' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CAC Registration Number</label>
                  <input type="text" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)}
                    placeholder="e.g. RC-1234567"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
                </div>
              )}
              {['utility_bill', 'bank_statement'].includes(verificationMethod) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Address on Document</label>
                  <input type="text" value={addressOnProof} onChange={(e) => setAddressOnProof(e.target.value)}
                    placeholder="Address shown on the document"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
                  <p className="mt-1 text-xs text-gray-400">Must match the restaurant&apos;s address: {selected?.address}</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Additional Proof / Notes</label>
                <textarea value={proof} onChange={(e) => setProof(e.target.value)} rows={3}
                  placeholder="Describe how we can verify your ownership — years of operation, other contact details, etc."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> Your claim will be verified by our team. We may call the restaurant&apos;s
                  listed phone number or request additional documents. False claims will result in account suspension.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setStep('search'); setSelected(null); }}
                  className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button type="submit" disabled={submitting || !name || !email || !phone}
                  className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Submitted */}
        {step === 'submitted' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Claim Submitted!</h2>
            <p className="mt-2 text-gray-500">
              Our team will review your claim and verify your ownership. You&apos;ll receive an email once it&apos;s approved.
            </p>
            <p className="mt-1 text-sm text-gray-400">This usually takes 1-2 business days.</p>
            <button
              onClick={() => { setStep('search'); setSearch(''); setResults([]); setSelected(null); }}
              className="mt-6 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Claim Another Restaurant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
