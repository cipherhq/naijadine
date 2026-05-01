'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CITIES, CUISINE_TYPES } from '@dineroot/shared';

type Step = 1 | 2 | 3 | 4 | 5;

const steps = [
  'Product Type',
  'Restaurant Details',
  'Documents',
  'Bank Account',
  'Review & Submit',
];

const cityOptions = Object.entries(CITIES).map(([key, city]) => ({
  value: key,
  label: city.name,
  neighborhoods: city.neighborhoods,
}));

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [productType, setProductType] = useState<'marketplace' | 'whatsapp_standalone'>('marketplace');

  // Step 2
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cuisineTypes, setCuisineTypes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState('moderate');

  // Step 3 - documents (file refs)
  const [cacFile, setCacFile] = useState<File | null>(null);
  const [photosFiles, setPhotosFiles] = useState<File[]>([]);

  // Step 4 - bank
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const selectedCity = cityOptions.find((c) => c.value === city);
  const neighborhoods = selectedCity?.neighborhoods || [];

  function toggleCuisine(c: string) {
    setCuisineTypes((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in first');
        return;
      }

      // Generate slug
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      // Create restaurant
      const { data: restaurant, error: createError } = await supabase
        .from('restaurants')
        .insert({
          owner_id: user.id,
          name,
          slug,
          description: description || null,
          cuisine_types: cuisineTypes,
          address,
          city,
          neighborhood,
          phone,
          email: email || null,
          product_type: productType,
          price_range: priceRange,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) {
        setError('Failed to create restaurant. Please try again.');
        return;
      }

      // Upload CAC document if provided
      if (cacFile && restaurant) {
        const ext = cacFile.name.split('.').pop();
        const path = `${restaurant.id}/cac.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('restaurant-documents')
          .upload(path, cacFile);

        if (!uploadError) {
          await supabase.from('restaurant_documents').insert({
            restaurant_id: restaurant.id,
            type: 'cac_certificate',
            file_url: path,
            file_name: cacFile.name,
            file_size: cacFile.size,
          });
        }
      }

      // Upload photos
      if (photosFiles.length > 0 && restaurant) {
        for (let i = 0; i < photosFiles.length; i++) {
          const file = photosFiles[i];
          const ext = file.name.split('.').pop();
          const path = `${restaurant.id}/photo_${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('restaurant-photos')
            .upload(path, file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('restaurant-photos')
              .getPublicUrl(path);

            await supabase.from('restaurant_photos').insert({
              restaurant_id: restaurant.id,
              uploaded_by: user.id,
              url: urlData.publicUrl,
              type: 'interior',
              sort_order: i,
            });
          }
        }
      }

      // Save bank account if provided
      if (bankName && accountNumber && restaurant) {
        await supabase.from('bank_accounts').insert({
          restaurant_id: restaurant.id,
          bank_name: bankName,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          is_primary: true,
          status: 'pending',
        });
      }

      // Update user role
      await supabase
        .from('profiles')
        .update({ role: 'restaurant_owner' })
        .eq('id', user.id);

      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 <= step
                  ? 'bg-brand text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 ${
                  i + 1 < step ? 'bg-brand' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        {/* Step 1: Product Type */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold">Choose Your Product</h2>
            <p className="mt-1 text-sm text-gray-500">
              Select how you want to use DineRoot
            </p>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setProductType('marketplace')}
                className={`w-full rounded-lg border-2 p-4 text-left transition ${
                  productType === 'marketplace'
                    ? 'border-brand bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-semibold">DineRoot Marketplace</span>
                <p className="mt-1 text-sm text-gray-500">
                  Get listed on DineRoot. Diners discover and book your restaurant via app, web, and WhatsApp.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setProductType('whatsapp_standalone')}
                className={`w-full rounded-lg border-2 p-4 text-left transition ${
                  productType === 'whatsapp_standalone'
                    ? 'border-brand bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-semibold">WhatsApp Standalone</span>
                <p className="mt-1 text-sm text-gray-500">
                  Your own WhatsApp booking bot + dashboard. Not listed on DineRoot marketplace.
                </p>
              </button>
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Restaurant Details */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold">Restaurant Details</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Address *</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">City *</label>
                  <select value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(''); }} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand">
                    <option value="">Select city</option>
                    {cityOptions.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Neighborhood *</label>
                  <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand" disabled={!city}>
                    <option value="">Select area</option>
                    {neighborhoods.map((n) => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Cuisine Types *</label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_TYPES.map((c) => (
                    <button key={c} type="button" onClick={() => toggleCuisine(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${cuisineTypes.includes(c) ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {c.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Price Range</label>
                <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand">
                  <option value="budget">Budget ($)</option>
                  <option value="moderate">Moderate ($$)</option>
                  <option value="upscale">Upscale ($$$)</option>
                  <option value="fine_dining">Fine Dining ($$$$)</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(3)} disabled={!name || !address || !city || !neighborhood || !phone || cuisineTypes.length === 0} className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold">Upload Documents</h2>
            <p className="mt-1 text-sm text-gray-500">Upload your business documents and photos</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">CAC Certificate (PDF/Image)</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCacFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Restaurant Photos</label>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={(e) => setPhotosFiles(Array.from(e.target.files || []))} className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-100" />
                {photosFiles.length > 0 && (
                  <p className="mt-1 text-xs text-gray-400">{photosFiles.length} file(s) selected</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(4)} className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500">Continue</button>
            </div>
          </div>
        )}

        {/* Step 4: Bank Account */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold">Bank Account</h2>
            <p className="mt-1 text-sm text-gray-500">Where should we send your payouts?</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bank Name</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. GTBank" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bank Code</label>
                <input type="text" value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="e.g. 058" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Number</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Name</label>
                <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="As shown on your bank statement" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
              <button onClick={() => setStep(5)} className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500">Continue</button>
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold">Review & Submit</h2>
            <p className="mt-1 text-sm text-gray-500">Please review your details before submitting</p>
            <div className="mt-6 space-y-4 text-sm">
              <div className="rounded-lg bg-gray-50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="font-medium">{productType === 'marketplace' ? 'Marketplace' : 'WhatsApp Standalone'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{selectedCity?.label}, {neighborhood}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">{phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Cuisine</span><span className="font-medium">{cuisineTypes.map((c) => c.replace(/_/g, ' ')).join(', ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Documents</span><span className="font-medium">{cacFile ? '1 CAC' : 'None'}, {photosFiles.length} photos</span></div>
                {bankName && (
                  <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">{bankName} - {accountNumber}</span></div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(4)} className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
                {loading ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
