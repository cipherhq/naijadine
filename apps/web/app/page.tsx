import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { CITIES, CUISINE_TYPES, formatNaira } from '@dineroot/shared';
import { TrustBadges } from '@/components/TrustBadges';

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
    .eq('product_type', 'marketplace')
    .order('rating_avg', { ascending: false })
    .limit(6);

  // Fetch trending (most booked)
  const { data: trending } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range, rating_avg, rating_count, total_bookings')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .order('total_bookings', { ascending: false })
    .limit(4);

  // Fetch active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, discount_pct, valid_to, restaurants!inner (name, slug, cover_photo_url, neighborhood, city, product_type)')
    .eq('is_active', true)
    .eq('restaurants.product_type', 'marketplace')
    .gte('valid_to', today)
    .lte('valid_from', today)
    .order('discount_pct', { ascending: false })
    .limit(4);

  // Fetch newest restaurants
  const { data: newest } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .order('created_at', { ascending: false })
    .limit(4);

  // Live platform stats
  const { count: restaurantCount } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace');

  const { data: cityData } = await supabase
    .from('restaurants')
    .select('city')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace');

  const uniqueCities = new Set((cityData || []).map((r) => r.city)).size;

  const { count: bookingCount } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true });

  // Fetch all active restaurants grouped by city
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range, rating_avg, rating_count, total_bookings')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .order('rating_avg', { ascending: false });

  // Group by country then city
  const cityToCountry: Record<string, string> = {};
  for (const [key, city] of Object.entries(CITIES)) {
    cityToCountry[key] = (city as { country: string }).country;
  }

  const countryNames: Record<string, { name: string; flag: string }> = {
    NG: { name: 'Nigeria', flag: '🇳🇬' },
    GH: { name: 'Ghana', flag: '🇬🇭' },
    KE: { name: 'Kenya', flag: '🇰🇪' },
    ZA: { name: 'South Africa', flag: '🇿🇦' },
    TZ: { name: 'Tanzania', flag: '🇹🇿' },
    RW: { name: 'Rwanda', flag: '🇷🇼' },
  };

  const byCountry: Record<string, Record<string, NonNullable<typeof allRestaurants>>> = {};
  for (const r of allRestaurants || []) {
    const city = r.city as string;
    const country = cityToCountry[city] || 'NG';
    if (!byCountry[country]) byCountry[country] = {};
    if (!byCountry[country][city]) byCountry[country][city] = [];
    byCountry[country][city].push(r);
  }

  // Sort countries: NG first (default), then by restaurant count
  const sortedCountries = Object.entries(byCountry).sort((a, b) => {
    if (a[0] === 'NG') return -1;
    if (b[0] === 'NG') return 1;
    const aCount = Object.values(a[1]).reduce((s, arr) => s + arr.length, 0);
    const bCount = Object.values(b[1]).reduce((s, arr) => s + arr.length, 0);
    return bCount - aCount;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero banner */}
      <section className="relative overflow-hidden bg-gray-900">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&h=600&fit=crop"
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 to-gray-900/40" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Find your table for any occasion
          </h1>
          <p className="mt-3 max-w-lg text-lg text-gray-300">
            Book the best restaurants across Africa — instantly confirmed, zero hassle
          </p>
        </div>
      </section>

      {/* Booking bar — overlaps hero */}
      <section className="relative z-10 border-b border-gray-100 bg-white px-4 py-5 shadow-sm sm:-mt-8 sm:mx-auto sm:max-w-5xl sm:rounded-2xl">
        <div className="mx-auto max-w-5xl">
          {/* Booking bar */}
          <form action="/restaurants" method="GET" className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="flex-1 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="w-[130px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <select name="time" className="flex-1 bg-transparent text-sm outline-none">
                  {['12:00','13:00','14:00','17:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(t => (
                    <option key={t} value={t}>{parseInt(t) > 12 ? `${parseInt(t) - 12}:${t.split(':')[1]} PM` : `${t} PM`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-[120px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Guests</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <select name="party_size" className="flex-1 bg-transparent text-sm outline-none">
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Location, Restaurant, or Cuisine</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" name="q" placeholder="Search..." className="flex-1 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <button type="submit" className="rounded-xl bg-brand px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Let&apos;s go
            </button>
          </form>

          {/* Location hint */}
          <p className="mt-3 text-center text-sm text-gray-400">
            Showing restaurants in <span className="font-medium text-gray-600">Lagos, Nigeria</span> &middot;{' '}
            <Link href="/restaurants" className="font-medium text-brand hover:underline">Change location</Link>
          </p>
        </div>
      </section>

      {/* Available for dinner now */}
      {trending && trending.length > 0 && (
        <section className="bg-white px-4 pt-8 pb-2">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Available for dinner tonight</h2>
                <p className="text-sm text-gray-500">{(restaurantCount || 0).toLocaleString()}+ restaurants across Africa</p>
              </div>
              <Link href="/restaurants" className="text-sm font-medium text-brand hover:underline">View all &rarr;</Link>
            </div>
          </div>
        </section>
      )}

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

      {/* Available for dinner — OpenTable-style cards with time slots */}
      {trending && trending.length > 0 && (
        <section className="bg-white px-4 py-8">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {trending.map((r) => {
                const cuisines = (r.cuisine_types as string[])?.slice(0, 1) || [];
                const price = priceLabels[r.price_range as string];
                // Generate sample available times around now
                const hour = new Date().getHours();
                const baseHour = Math.max(12, Math.min(hour, 20));
                const slots = [`${baseHour}:00`, `${baseHour}:30`, `${baseHour + 1}:00`];
                return (
                  <div key={r.id} className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition hover:shadow-lg">
                    <Link href={`/restaurants/${r.slug}`}>
                      <OptimizedImage
                        src={r.cover_photo_url}
                        alt={r.name}
                        fallbackChar={r.name.charAt(0)}
                        className="h-36 w-full"
                      />
                    </Link>
                    <div className="p-3">
                      <Link href={`/restaurants/${r.slug}`}>
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand">{r.name}</h3>
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {r.rating_avg > 0 && (
                          <span className="flex items-center gap-0.5 font-medium text-gray-900">
                            <svg className="h-3 w-3 text-gold" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {Number(r.rating_avg).toFixed(1)}
                          </span>
                        )}
                        {r.rating_count > 0 && <span>({r.rating_count.toLocaleString()} reviews)</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {cuisines[0]?.replace(/_/g, ' ')} &middot; {price?.label || ''} &middot; {r.neighborhood}
                      </p>
                      {r.total_bookings > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                          Booked {r.total_bookings.toLocaleString()} times
                        </p>
                      )}
                      {/* Time slot buttons */}
                      <div className="mt-2 flex gap-1.5">
                        {slots.map((slot) => (
                          <Link
                            key={slot}
                            href={`/booking/${r.slug}?time=${slot}&date=${new Date().toISOString().split('T')[0]}`}
                            className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-600"
                          >
                            {parseInt(slot) > 12 ? `${parseInt(slot) - 12}:${slot.split(':')[1]} PM` : `${slot} AM`}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Holiday/Festivity recommendation */}
      <section className="bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {new Date().getMonth() === 11 ? '🎄 Great for Christmas Dinner' :
                 new Date().getMonth() === 4 ? '👩 Great for Mother\'s Day Brunch' :
                 new Date().getDay() === 5 ? '🎉 Perfect for Friday Night Out' :
                 new Date().getDay() === 6 ? '☀️ Weekend Brunch Spots' :
                 '✨ Popular This Week'}
              </h2>
              <p className="text-sm text-gray-500">Restaurants available for special occasions</p>
            </div>
            <Link href="/restaurants" className="text-sm font-medium text-brand hover:underline">View all &rarr;</Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
            {(featured || []).slice(0, 4).map((r) => {
              const price = priceLabels[r.price_range as string];
              const slots = ['12:00', '12:30', '13:00'];
              return (
                <div key={r.id} className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition hover:shadow-lg">
                  <Link href={`/restaurants/${r.slug}`}>
                    <OptimizedImage src={r.cover_photo_url} alt={r.name} fallbackChar={r.name.charAt(0)} className="h-32 w-full" />
                  </Link>
                  <div className="p-3">
                    <Link href={`/restaurants/${r.slug}`}>
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand">{r.name}</h3>
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">{price?.label || ''} &middot; {r.neighborhood}</p>
                    <div className="mt-2 flex gap-1.5">
                      {slots.map((slot) => (
                        <Link key={slot} href={`/booking/${r.slug}?time=${slot}&date=${new Date().toISOString().split('T')[0]}`}
                          className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-600">
                          {parseInt(slot) > 12 ? `${parseInt(slot) - 12}:${slot.split(':')[1]} PM` : `${slot} PM`}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {deals.map((deal) => {
                const restaurantRaw = deal.restaurants as unknown;
                const restaurant = (Array.isArray(restaurantRaw) ? restaurantRaw[0] : restaurantRaw) as { name: string; slug: string; cover_photo_url: string | null; neighborhood: string; city: string } | null;
                return (
                  <Link
                    key={deal.id}
                    href={`/restaurants/${restaurant?.slug}`}
                    className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="relative h-32">
                      <OptimizedImage
                        src={restaurant?.cover_photo_url}
                        alt={restaurant?.name || 'Deal'}
                        fallbackChar={restaurant?.name?.charAt(0)}
                        className="h-32 w-full"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
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

      {/* Restaurants by Country → City */}
      {sortedCountries.map(([countryCode, cities]) => {
        const country = countryNames[countryCode] || { name: countryCode, flag: '' };
        const totalInCountry = Object.values(cities).reduce((s, arr) => s + arr.length, 0);
        const sortedCitiesInCountry = Object.entries(cities).sort((a, b) => b[1].length - a[1].length);

        return (
        <section key={countryCode} className="bg-gray-50 px-4 py-14 even:bg-white">
          <div className="mx-auto max-w-5xl">
            {/* Country header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{country.flag} {country.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{totalInCountry} restaurant{totalInCountry !== 1 ? 's' : ''} across {sortedCitiesInCountry.length} cit{sortedCitiesInCountry.length !== 1 ? 'ies' : 'y'}</p>
              </div>
            </div>

            {/* Cities within country */}
            {sortedCitiesInCountry.map(([city, restaurants]) => (
            <div key={city} className="mb-10 last:mb-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">{city.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
                <Link href={`/restaurants?city=${city}`} className="text-sm font-medium text-brand hover:underline">
                  View all &rarr;
                </Link>
              </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {(restaurants || []).slice(0, 6).map((r) => {
              const cuisines = (r.cuisine_types as string[])?.slice(0, 2) || [];
              const price = priceLabels[r.price_range as string];
              return (
                <Link
                  key={r.id}
                  href={`/restaurants/${r.slug}`}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
                >
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden">
                    <OptimizedImage
                      src={r.cover_photo_url}
                      alt={r.name}
                      fallbackChar={r.name.charAt(0)}
                      className="h-44 w-full transition duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />

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
            ))}
          </div>
        </section>
        );
      })}

      {/* New on DineRoot */}
      {newest && newest.length > 0 && (
        <section className="bg-white px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New on DineRoot</h2>
                <p className="text-sm text-gray-500">Recently added — be the first to try them</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {newest.map((r) => {
                const cuisines = (r.cuisine_types as string[])?.slice(0, 1) || [];
                return (
                  <Link
                    key={r.id}
                    href={`/restaurants/${r.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 transition hover:shadow-md hover:border-brand/20"
                  >
                    <OptimizedImage
                      src={r.cover_photo_url}
                      alt={r.name}
                      fallbackChar={r.name.charAt(0)}
                      className="h-16 w-16 flex-shrink-0 rounded-xl"
                      sizes="64px"
                    />
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
            { value: `${(restaurantCount || 0).toLocaleString()}+`, label: 'Restaurants', icon: '🍽️' },
            { value: String(uniqueCities), label: 'Cities', icon: '🏙️' },
            { value: `${(bookingCount || 0).toLocaleString()}+`, label: 'Bookings', icon: '📅' },
            { value: '24/7', label: 'Instant Booking', icon: '⚡' },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-2xl">{stat.icon}</span>
              <p className="mt-1 text-2xl font-bold text-brand">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <TrustBadges />
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

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden">
        <Link
          href="/restaurants"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Find a Table
        </Link>
      </div>
    </div>
  );
}
