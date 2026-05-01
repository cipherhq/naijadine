import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { RestaurantCard } from '@/components/restaurants/RestaurantCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CITIES, CUISINE_TYPES } from '@dineroot/shared';

export const metadata: Metadata = {
  title: 'Browse Restaurants',
  description:
    'Find the best restaurants across Africa. Filter by city, cuisine, neighborhood, and price range.',
};

interface SearchParams {
  city?: string;
  cuisine?: string;
  price_range?: string;
  q?: string;
  neighborhood?: string;
  dietary?: string;
}

const DIETARY_OPTIONS = [
  { value: 'halal', label: 'Halal' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten Free' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'pescatarian', label: 'Pescatarian' },
];

async function RestaurantList({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('restaurants')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
    .eq('product_type', 'marketplace')
    .order('rating_avg', { ascending: false })
    .limit(40);

  if (searchParams.city) {
    query = query.eq('city', searchParams.city);
  }
  if (searchParams.neighborhood) {
    query = query.eq('neighborhood', searchParams.neighborhood);
  }
  if (searchParams.cuisine) {
    query = query.contains('cuisine_types', [searchParams.cuisine]);
  }
  if (searchParams.price_range) {
    query = query.eq('price_range', searchParams.price_range);
  }
  if (searchParams.dietary) {
    query = query.contains('dietary_tags', [searchParams.dietary]);
  }
  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }

  const { data: restaurants } = await query;

  if (!restaurants || restaurants.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No restaurants found"
        description="Try adjusting your filters, changing your city, or searching for a different cuisine."
        action={{ label: 'Browse all restaurants', href: '/restaurants' }}
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {restaurants.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </div>
  );
}

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const cityOptions = Object.entries(CITIES).map(([key, city]) => ({
    value: key,
    label: city.name,
  }));

  const selectedCity = params.city as keyof typeof CITIES | undefined;
  const neighborhoods = selectedCity ? CITIES[selectedCity]?.neighborhoods || [] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Browse Restaurants</h1>
      <p className="mt-1 text-gray-500">
        Discover the best dining experiences across Nigeria
      </p>

      {/* Filters */}
      <form className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search restaurants..."
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <select
          name="city"
          defaultValue={params.city}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">All Cities</option>
          {cityOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {neighborhoods.length > 0 && (
          <select
            name="neighborhood"
            defaultValue={params.neighborhood}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">All Areas</option>
            {neighborhoods.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
        <select
          name="cuisine"
          defaultValue={params.cuisine}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">All Cuisines</option>
          {CUISINE_TYPES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          name="price_range"
          defaultValue={params.price_range}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">Any Price</option>
          <option value="budget">Budget ($)</option>
          <option value="moderate">Moderate ($$)</option>
          <option value="upscale">Upscale ($$$)</option>
          <option value="fine_dining">Fine Dining ($$$$)</option>
        </select>
        <select
          name="dietary"
          defaultValue={params.dietary}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">Dietary</option>
          {DIETARY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Search
        </button>
      </form>

      {/* Active filter pills */}
      {(params.city || params.cuisine || params.price_range || params.q || params.neighborhood) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">Filters:</span>
          {params.q && (
            <a href={`/restaurants?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== 'q' && v))).toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-100">
              &quot;{params.q}&quot;
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </a>
          )}
          {params.city && (
            <a href={`/restaurants?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== 'city' && k !== 'neighborhood' && v))).toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-100">
              {cityOptions.find(c => c.value === params.city)?.label || params.city}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </a>
          )}
          {params.neighborhood && (
            <a href={`/restaurants?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== 'neighborhood' && v))).toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-100">
              {params.neighborhood}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </a>
          )}
          {params.cuisine && (
            <a href={`/restaurants?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== 'cuisine' && v))).toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-100">
              {params.cuisine.replace(/_/g, ' ')}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </a>
          )}
          {params.price_range && (
            <a href={`/restaurants?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== 'price_range' && v))).toString()}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand hover:bg-brand-100">
              {params.price_range.replace(/_/g, ' ')}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </a>
          )}
          <a href="/restaurants" className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</a>
        </div>
      )}

      {/* Results */}
      <div className="mt-8">
        <Suspense
          fallback={
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-gray-100"
                >
                  <div className="aspect-[16/10] bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <RestaurantList searchParams={params} />
        </Suspense>
      </div>
    </div>
  );
}
