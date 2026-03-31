import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CITIES, CUISINE_TYPES, formatNaira } from '@naijadine/shared';

const cuisineEmoji: Record<string, string> = {
  nigerian: '🍛',
  continental: '🍽️',
  asian: '🥢',
  mediterranean: '🫒',
  fast_casual: '🍔',
  grill_bbq: '🔥',
  seafood: '🦐',
  italian: '🍝',
  chinese: '🥡',
  indian: '🍲',
  lebanese: '🧆',
  other: '🍴',
};

const cuisineLabels: Record<string, string> = {
  nigerian: 'Nigerian',
  continental: 'Continental',
  asian: 'Asian',
  mediterranean: 'Mediterranean',
  fast_casual: 'Fast Casual',
  grill_bbq: 'Grill & BBQ',
  seafood: 'Seafood',
  italian: 'Italian',
  chinese: 'Chinese',
  indian: 'Indian',
  lebanese: 'Lebanese',
  other: 'Other',
};

const priceLabels: Record<string, { label: string; icon: string }> = {
  budget: { label: 'Budget-Friendly', icon: '₦' },
  moderate: { label: 'Moderate', icon: '₦₦' },
  upscale: { label: 'Upscale', icon: '₦₦₦' },
  fine_dining: { label: 'Fine Dining', icon: '₦₦₦₦' },
};

export default async function Home() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch popular restaurants (correct column names)
  const { data: featured } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range, rating_avg, rating_count, total_bookings')
    .in('status', ['active', 'approved'])
    .order('rating_avg', { ascending: false })
    .limit(6);

  // Fetch trending (most booked)
  const { data: trending } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range, rating_avg, rating_count, total_bookings')
    .in('status', ['active', 'approved'])
    .order('total_bookings', { ascending: false })
    .limit(4);

  // Fetch active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, discount_pct, valid_to, restaurants (name, slug, cover_photo_url, neighborhood, city)')
    .eq('is_active', true)
    .gte('valid_to', today)
    .lte('valid_from', today)
    .order('discount_pct', { ascending: false })
    .limit(4);

  // Fetch newest restaurants
  const { data: newest } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range')
    .in('status', ['active', 'approved'])
    .order('created_at', { ascending: false })
    .limit(4);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand px-4 py-24 text-center">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-500/20" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-gold/10" />

        <div className="relative mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-300/40 bg-brand-500/30 px-4 py-1.5 text-sm text-brand-100">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
            1,000+ restaurants across Nigeria
          </div>

          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Discover. Reserve. <span className="text-gold">Dine.</span>
          </h1>
          <p className="mt-4 text-lg text-brand-200">
            Book the best restaurants across Lagos, Abuja &amp; Port Harcourt — instantly confirmed, zero hassle
          </p>

          {/* Search bar */}
          <form action="/restaurants" method="GET" className="mt-8 flex overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
            <input
              type="text"
              name="q"
              placeholder="Search restaurants, cuisines, neighborhoods..."
              className="flex-1 px-5 py-4 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="bg-brand px-8 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Search
            </button>
          </form>

          {/* City chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {Object.entries(CITIES).map(([key, city]) => (
              <Link
                key={key}
                href={`/restaurants?city=${key}`}
                className="rounded-full border border-brand-300/40 bg-brand-500/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-500/40"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Cuisine filters with emojis */}
      <section className="border-b border-gray-100 bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CUISINE_TYPES.map((type) => (
              <Link
                key={type}
                href={`/restaurants?cuisine=${type}`}
                className="flex flex-shrink-0 items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:border-brand hover:bg-brand-50 hover:text-brand"
              >
                <span className="text-lg">{cuisineEmoji[type] || '🍴'}</span>
                {cuisineLabels[type] || type}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now */}
      {trending && trending.length > 0 && (
        <section className="bg-white px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <h2 className="text-2xl font-bold text-gray-900">Trending Now</h2>
              <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-600 uppercase tracking-wide">Hot</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">The most booked restaurants this week</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trending.map((r, i) => {
                const cuisines = (r.cuisine_types as string[])?.slice(0, 2) || [];
                const price = priceLabels[r.price_range as string];
                return (
                  <Link
                    key={r.id}
                    href={`/restaurants/${r.slug}`}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {/* Rank badge */}
                    <div className="absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-brand shadow-sm backdrop-blur-sm">
                      #{i + 1}
                    </div>
                    <div className="h-36 bg-brand-50">
                      {r.cover_photo_url ? (
                        <img src={r.cover_photo_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-3xl font-bold text-brand/30">
                          {r.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand">{r.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{r.neighborhood}, {(r.city as string).replace(/_/g, ' ')}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {r.rating_avg > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-medium text-gold">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                              {Number(r.rating_avg).toFixed(1)}
                            </span>
                          )}
                          {r.rating_count > 0 && (
                            <span className="text-xs text-gray-400">({r.rating_count})</span>
                          )}
                        </div>
                        {r.total_bookings > 0 && (
                          <span className="text-xs text-gray-400">{r.total_bookings} bookings</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured Deals */}
      {deals && deals.length > 0 && (
        <section className="bg-gradient-to-b from-gold/5 to-white px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏷️</span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Today&apos;s Deals</h2>
                  <p className="text-sm text-gray-500">Save big at your favourite restaurants</p>
                </div>
              </div>
              <Link href="/deals" className="text-sm font-medium text-brand hover:underline">View all &rarr;</Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deals.map((deal) => {
                const restaurantRaw = deal.restaurants as unknown;
                const restaurant = (Array.isArray(restaurantRaw) ? restaurantRaw[0] : restaurantRaw) as { name: string; slug: string; cover_photo_url: string | null; neighborhood: string; city: string } | null;
                return (
                  <Link
                    key={deal.id}
                    href={`/restaurants/${restaurant?.slug}`}
                    className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="relative h-32 bg-brand-50">
                      {restaurant?.cover_photo_url ? (
                        <img src={restaurant.cover_photo_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gold/10 to-gold/5 text-2xl font-bold text-gold/30">
                          {restaurant?.name?.charAt(0)}
                        </div>
                      )}
                      <div className="absolute right-2 top-2 rounded-full bg-gold px-3 py-1 text-xs font-bold text-white shadow-sm">
                        {deal.discount_pct}% OFF
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand">{deal.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{restaurant?.name} &middot; {restaurant?.neighborhood}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Popular Restaurants - main section */}
      <section className="bg-gray-50 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Popular Restaurants</h2>
              <p className="mt-1 text-sm text-gray-500">Highly rated spots loved by diners</p>
            </div>
            <Link href="/restaurants" className="rounded-full border border-brand bg-white px-5 py-2 text-sm font-medium text-brand transition hover:bg-brand hover:text-white">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(featured || []).map((r) => {
              const cuisines = (r.cuisine_types as string[])?.slice(0, 2) || [];
              const price = priceLabels[r.price_range as string];
              return (
                <Link
                  key={r.id}
                  href={`/restaurants/${r.slug}`}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
                >
                  {/* Image */}
                  <div className="relative h-44 bg-brand-50 overflow-hidden">
                    {r.cover_photo_url ? (
                      <img src={r.cover_photo_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-4xl font-bold text-brand/20">
                        {r.name.charAt(0)}
                      </div>
                    )}

                    {/* Price badge */}
                    {price && (
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm backdrop-blur-sm">
                        {price.icon}
                      </div>
                    )}

                    {/* Rating badge */}
                    {r.rating_avg > 0 && (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm">
                        <svg className="h-3.5 w-3.5 text-gold" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <span className="text-gray-900">{Number(r.rating_avg).toFixed(1)}</span>
                        {r.rating_count > 0 && <span className="text-gray-400">({r.rating_count})</span>}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-brand">{r.name}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{r.neighborhood}, {(r.city as string).replace(/_/g, ' ')}</p>

                    {/* Tags row */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {cuisines.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand">
                          <span>{cuisineEmoji[c] || '🍴'}</span> {cuisineLabels[c] || c}
                        </span>
                      ))}
                      {price && (
                        <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold-700">
                          {price.label}
                        </span>
                      )}
                    </div>

                    {/* Bookings count */}
                    {r.total_bookings > 0 && (
                      <p className="mt-2.5 flex items-center gap-1 text-xs text-gray-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {r.total_bookings} bookings
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* New on NaijaDine */}
      {newest && newest.length > 0 && (
        <section className="bg-white px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New on NaijaDine</h2>
                <p className="text-sm text-gray-500">Recently added — be the first to try them</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {newest.map((r) => {
                const cuisines = (r.cuisine_types as string[])?.slice(0, 1) || [];
                return (
                  <Link
                    key={r.id}
                    href={`/restaurants/${r.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 transition hover:shadow-md hover:border-brand/20"
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-brand-50">
                      {r.cover_photo_url ? (
                        <img src={r.cover_photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-lg font-bold text-brand/30">
                          {r.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand">{r.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{r.neighborhood}, {(r.city as string).replace(/_/g, ' ')}</p>
                      {cuisines[0] && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
                          {cuisineEmoji[cuisines[0]]} {cuisineLabels[cuisines[0]]}
                        </span>
                      )}
                    </div>
                    <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600">
                      New
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Stats bar */}
      <section className="border-y border-gray-100 bg-brand-50/50 px-4 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { value: '1,000+', label: 'Restaurants', icon: '🍽️' },
            { value: '3', label: 'Major Cities', icon: '🏙️' },
            { value: '50+', label: 'Cuisines', icon: '🌍' },
            { value: '24/7', label: 'Instant Booking', icon: '⚡' },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-2xl">{stat.icon}</span>
              <p className="mt-1 text-2xl font-bold text-brand">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
          <p className="mt-2 text-sm text-gray-500">Three simple steps to your next great meal</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { emoji: '🔍', step: '1', title: 'Discover', desc: 'Browse restaurants by city, cuisine, or neighborhood' },
              { emoji: '📅', step: '2', title: 'Reserve', desc: 'Pick a date, time, and party size — instantly confirmed' },
              { emoji: '🎉', step: '3', title: 'Dine', desc: 'Show up, enjoy your meal, and earn loyalty rewards' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
                  {item.emoji}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand px-4 py-20 text-center">
        <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-gold/10" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-brand-500/30" />

        <div className="relative mx-auto max-w-lg">
          <h2 className="text-3xl font-bold text-white">Ready to Dine?</h2>
          <p className="mt-3 text-brand-200">Join thousands of diners discovering the best restaurants in Nigeria.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/restaurants" className="rounded-xl bg-gold px-8 py-3.5 text-sm font-semibold text-brand-800 shadow-lg transition hover:bg-gold-400 hover:shadow-xl">
              Browse Restaurants
            </Link>
            <Link href="/signup" className="rounded-xl border border-brand-300/50 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-500">
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
