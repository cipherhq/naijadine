import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatTime } from '@dineroot/shared';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PhotoGallery } from '@/components/PhotoGallery';
import { MapView } from '@/components/MapView';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { createClient: createBrowserClient } = await import('@supabase/supabase-js');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await supabase
    .from('restaurants')
    .select('slug')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .limit(100);
  return (data || []).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, description, cuisine_types, neighborhood, city, cover_photo_url')
    .eq('slug', slug)
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .single();

  if (!restaurant) {
    return { title: 'Restaurant Not Found' };
  }

  const cuisines = Array.isArray(restaurant.cuisine_types)
    ? restaurant.cuisine_types.slice(0, 3).join(', ')
    : '';

  const description =
    restaurant.description ||
    `Book a table at ${restaurant.name}. ${cuisines} restaurant in ${restaurant.neighborhood}, ${(restaurant.city as string).replace(/_/g, ' ')}.`;

  const url = `https://dineroot.com/restaurants/${slug}`;

  return {
    title: `${restaurant.name} — Book a Table | DineRoot`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `${restaurant.name} — Book a Table | DineRoot`,
      description,
      siteName: 'DineRoot',
      images: restaurant.cover_photo_url
        ? [{ url: restaurant.cover_photo_url, width: 1200, height: 630, alt: restaurant.name }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${restaurant.name} | DineRoot`,
      description,
      images: restaurant.cover_photo_url ? [restaurant.cover_photo_url] : [],
    },
  };
}

export const revalidate = 3600;

const priceLabels: Record<string, string> = {
  budget: 'Budget',
  moderate: 'Moderate',
  upscale: 'Upscale',
  fine_dining: 'Fine Dining',
};

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace')
    .is('deleted_at', null)
    .single();

  if (!restaurant) notFound();

  // Check if restaurant is claimed (has approved claim or owner is not the seed admin)
  const { data: approvedClaim } = await supabase
    .from('restaurant_claims')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'approved')
    .limit(1);

  const isUnclaimed = !(approvedClaim && approvedClaim.length > 0);

  // Fetch photos
  const { data: photos } = await supabase
    .from('restaurant_photos')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('moderation_status', 'approved')
    .order('sort_order');

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, text, created_at, profiles:user_id (first_name, avatar_url)')
    .eq('restaurant_id', restaurant.id)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch menu
  const { data: menuCategories } = await supabase
    .from('menu_categories')
    .select('id, name, description, menu_items(id, name, description, price, is_available)')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order');

  // Fetch active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .gte('valid_to', new Date().toISOString().split('T')[0]);

  const cuisines = Array.isArray(restaurant.cuisine_types)
    ? restaurant.cuisine_types
    : [];

  const operatingHours = restaurant.operating_hours as Record<
    string,
    { open: string; close: string }
  > | null;

  const daysOfWeek = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    description: restaurant.description || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      addressLocality: restaurant.neighborhood,
      addressRegion: (restaurant.city as string).replace(/_/g, ' '),
      addressCountry: 'NG',
    },
    telephone: restaurant.phone || undefined,
    servesCuisine: cuisines.map((c: string) => c.replace(/_/g, ' ')),
    priceRange: restaurant.pricing_tier === 'fine_dining' ? '$$$$' : restaurant.pricing_tier === 'upscale' ? '$$$' : '$$',
    image: restaurant.cover_photo_url || undefined,
    url: `https://dineroot.com/restaurants/${restaurant.slug}`,
    aggregateRating: restaurant.avg_rating > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: restaurant.avg_rating,
      reviewCount: restaurant.total_reviews || 0,
    } : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-100">
        {restaurant.cover_photo_url ? (
          <img
            src={restaurant.cover_photo_url}
            alt={restaurant.name}
            className="h-64 w-full object-cover sm:h-80"
          />
        ) : (
          <div className="flex h-64 items-center justify-center bg-brand-50 sm:h-80">
            <span className="text-8xl font-bold text-brand-200">
              {restaurant.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute right-4 top-4">
          <FavoriteButton restaurantId={restaurant.id} />
        </div>
      </div>

      {/* Claim banner for unclaimed restaurants */}
      {isUnclaimed && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="font-semibold text-amber-900">Is this your restaurant?</p>
            <p className="text-sm text-amber-700">Claim ownership to manage bookings, update your menu, and receive deposits.</p>
          </div>
          <Link
            href={`https://dashboard.dineroot.com/claim?restaurant=${restaurant.slug}`}
            className="flex-shrink-0 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Claim Restaurant
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Title + meta */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {restaurant.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {restaurant.rating_avg > 0
                  ? `${restaurant.rating_avg.toFixed(1)} (${restaurant.rating_count})`
                  : 'No reviews yet'}
              </span>
              <span>|</span>
              <span>
                {cuisines.map((c: string) => c.replace(/_/g, ' ')).join(', ')}
              </span>
              <span>|</span>
              <span>{priceLabels[restaurant.price_range] || 'Moderate'}</span>
              <span>|</span>
              <span>
                {restaurant.neighborhood},{' '}
                {(restaurant.city as string).replace(/_/g, ' ')}
              </span>
            </div>
            {restaurant.description && (
              <p className="mt-4 text-gray-600">{restaurant.description}</p>
            )}
          </div>

          {/* Photos */}
          {photos && photos.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Photos</h2>
              <div className="mt-3">
                <PhotoGallery photos={photos} />
              </div>
            </div>
          )}

          {/* Menu */}
          {menuCategories && menuCategories.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Menu</h2>
              <div className="mt-3 space-y-6">
                {menuCategories.map((cat) => {
                  const items = (cat.menu_items || []) as { id: string; name: string; description: string | null; price: number; is_available: boolean }[];
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{cat.name}</h3>
                      <div className="mt-2 divide-y divide-gray-50">
                        {items.filter(i => i.is_available).map((item) => (
                          <div key={item.id} className="flex items-start justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.description && <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>}
                            </div>
                            <span className="ml-4 flex-shrink-0 font-semibold text-gray-900">{formatNaira(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Menu PDF fallback */}
          {(!menuCategories || menuCategories.length === 0) && restaurant.menu_url && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Menu</h2>
              <a href={restaurant.menu_url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                📄 View Menu PDF
              </a>
            </div>
          )}

          {/* Deals */}
          {deals && deals.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Current Deals
              </h2>
              <div className="mt-3 space-y-3">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-gold-200 bg-gold-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">
                        {deal.title}
                      </h3>
                      <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-brand-800">
                        {deal.discount_pct}% OFF
                      </span>
                    </div>
                    {deal.description && (
                      <p className="mt-1 text-sm text-gray-600">
                        {deal.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Reviews</h2>
            {reviews && reviews.length > 0 ? (
              <div className="mt-3 space-y-4">
                {reviews.map((review) => {
                  const profile = review.profiles as { first_name?: string; avatar_url?: string } | null;
                  return (
                    <div
                      key={review.id}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-medium text-brand">
                          {profile?.first_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {profile?.first_name || 'Guest'}
                        </span>
                        <div className="flex items-center text-gold">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      {review.text && (
                        <p className="mt-2 text-sm text-gray-600">
                          {review.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">No reviews yet</p>
            )}
          </div>
        </div>

        {/* Sidebar — Booking CTA + Info */}
        <div className="space-y-6">
          <div className="sticky top-24 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">
              Reserve a Table
            </h3>
            {restaurant.deposit_per_guest > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Deposit: {formatNaira(restaurant.deposit_per_guest)} / guest
              </p>
            )}

            {/* Quick book form */}
            <form action={`/booking/${restaurant.slug}`} method="GET" className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
                <input
                  type="date"
                  name="date"
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                  <select name="time" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand">
                    {['12:00','12:30','13:00','13:30','14:00','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map((t) => (
                      <option key={t} value={t}>{t.split(':')[0]}:{t.split(':')[1]} {Number(t.split(':')[0]) >= 12 ? 'PM' : 'AM'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Guests</label>
                  <select name="party_size" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand">
                    {[1,2,3,4,5,6,7,8,10,12].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Find a Table
              </button>
            </form>

            {/* Info */}
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-900">Address</span>
                <p>{restaurant.address}</p>
              </div>
              {restaurant.phone && (
                <div>
                  <span className="font-medium text-gray-900">Phone</span>
                  <p>{restaurant.phone}</p>
                </div>
              )}
              {restaurant.avg_price_per_person && (
                <div>
                  <span className="font-medium text-gray-900">
                    Avg. per person
                  </span>
                  <p>{formatNaira(restaurant.avg_price_per_person)}</p>
                </div>
              )}
              {restaurant.instagram_handle && (
                <div>
                  <span className="font-medium text-gray-900">Instagram</span>
                  <p>@{restaurant.instagram_handle}</p>
                </div>
              )}
            </div>

            {/* Share */}
            <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out ${restaurant.name} on DineRoot! https://dineroot.com/restaurants/${restaurant.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                Share
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Dining at ${restaurant.name} — book on DineRoot!`)}&url=${encodeURIComponent(`https://dineroot.com/restaurants/${restaurant.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                🐦 Tweet
              </a>
            </div>

            {/* Map */}
            {restaurant.latitude && restaurant.longitude && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <span className="text-sm font-medium text-gray-900">Location</span>
                <div className="mt-2 h-48 overflow-hidden rounded-lg">
                  <MapView
                    restaurants={[{
                      id: restaurant.id,
                      name: restaurant.name,
                      slug: restaurant.slug,
                      latitude: restaurant.latitude,
                      longitude: restaurant.longitude,
                      city: restaurant.city,
                      neighborhood: restaurant.neighborhood,
                      rating_avg: restaurant.rating_avg || 0,
                      cover_photo_url: restaurant.cover_photo_url,
                    }]}
                    zoom={15}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                >
                  Open in Google Maps →
                </a>
              </div>
            )}

            {/* Operating Hours */}
            {operatingHours && Object.keys(operatingHours).length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <span className="text-sm font-medium text-gray-900">Hours</span>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {daysOfWeek.map((day) => {
                    const h = operatingHours[day];
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="capitalize">{day}</span>
                        <span>{h ? `${formatTime(h.open)} — ${formatTime(h.close)}` : 'Closed'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
