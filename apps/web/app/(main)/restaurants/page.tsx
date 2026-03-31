import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { RestaurantCard } from '@/components/restaurants/RestaurantCard';
import { CITIES, CUISINE_TYPES } from '@naijadine/shared';

export const metadata: Metadata = {
  title: 'Browse Restaurants',
  description:
    'Find the best restaurants in Lagos, Abuja, and Port Harcourt. Filter by cuisine, neighborhood, and price range.',
};

interface SearchParams {
  city?: string;
  cuisine?: string;
  price_range?: string;
  q?: string;
  neighborhood?: string;
}

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
  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }

  const { data: restaurants } = await query;

  if (!restaurants || restaurants.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium text-gray-500">
          No restaurants found
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Try adjusting your filters or search term
        </p>
      </div>
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
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Search
        </button>
      </form>

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
