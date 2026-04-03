import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNaira, formatTime } from '@naijadine/shared';
import { FavoriteButton } from '@/components/FavoriteButton';

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

  const url = `https://naijadine.com/restaurants/${slug}`;

  return {
    title: `${restaurant.name} — Book a Table | NaijaDine`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `${restaurant.name} — Book a Table | NaijaDine`,
      description,
      siteName: 'NaijaDine',
      images: restaurant.cover_photo_url
        ? [{ url: restaurant.cover_photo_url, width: 1200, height: 630, alt: restaurant.name }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${restaurant.name} | NaijaDine`,
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
    .is('deleted_at', null)
    .single();

  if (!restaurant) notFound();

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
    url: `https://naijadine.com/restaurants/${restaurant.slug}`,
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
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.slice(0, 6).map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt={photo.caption || restaurant.name}
                    className="aspect-square rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Menu */}
          {restaurant.menu_url && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Menu</h2>
              <div className="mt-3">
                {/\.(jpg|jpeg|png|webp)(\?|$)/i.test(restaurant.menu_url) ? (
                  <a href={restaurant.menu_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={restaurant.menu_url}
                      alt={`${restaurant.name} menu`}
                      className="w-full rounded-lg border border-gray-100 object-contain"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <iframe
                    src={restaurant.menu_url}
                    title={`${restaurant.name} menu`}
                    className="h-[600px] w-full rounded-lg border border-gray-200"
                  />
                )}
                <a
                  href={restaurant.menu_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                >
                  View Full Menu
                </a>
              </div>
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
            <Link
              href={`/booking/${restaurant.slug}`}
              className="mt-4 block w-full rounded-lg bg-brand py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Book Now
            </Link>

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
