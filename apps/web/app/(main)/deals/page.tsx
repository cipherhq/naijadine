import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deals & Promotions — NaijaDine',
  description: 'Discover the best restaurant deals and discounts across Lagos, Abuja, and Port Harcourt.',
};

interface Deal {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number;
  valid_from: string;
  valid_to: string;
  time_slots: Array<{ start: string; end: string }>;
  restaurants: {
    name: string;
    slug: string;
    cover_photo_url: string | null;
    neighborhood: string;
    city: string;
  } | null;
}

export default async function DealsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, description, discount_pct, valid_from, valid_to, time_slots, restaurants (name, slug, cover_photo_url, neighborhood, city)')
    .eq('is_active', true)
    .gte('valid_to', today)
    .lte('valid_from', today)
    .order('discount_pct', { ascending: false })
    .limit(30);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Deals & Promotions</h1>
        <p className="mt-2 text-gray-500">Save on your next dining experience</p>
      </div>

      {(!deals || deals.length === 0) ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <span className="text-3xl">🏷️</span>
          </div>
          <p className="mt-4 text-gray-500">No active deals right now</p>
          <p className="mt-1 text-sm text-gray-400">Check back soon for exclusive offers!</p>
          <Link href="/restaurants" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Browse Restaurants
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(deals as unknown as Deal[]).map((deal) => {
            const restaurantRaw = deal.restaurants as unknown;
            const restaurant = (Array.isArray(restaurantRaw) ? restaurantRaw[0] : restaurantRaw) as Deal['restaurants'];
            const validTo = new Date(deal.valid_to + 'T00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
            const timeLabel = deal.time_slots?.length > 0
              ? deal.time_slots.map((s) => `${s.start}–${s.end}`).join(', ')
              : 'All day';

            return (
              <Link
                key={deal.id}
                href={`/restaurants/${restaurant?.slug}`}
                className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition hover:border-brand-100 hover:shadow-md"
              >
                {/* Image */}
                <div className="relative h-40 bg-brand-50">
                  {restaurant?.cover_photo_url ? (
                    <img src={restaurant.cover_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl font-bold text-brand-100">
                      {restaurant?.name?.charAt(0)}
                    </div>
                  )}
                  {/* Discount badge */}
                  <div className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-sm font-bold text-white shadow">
                    {deal.discount_pct}% OFF
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand">{deal.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{restaurant?.name}</p>
                  {deal.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{deal.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span>{timeLabel}</span>
                    <span>Until {validTo}</span>
                    <span>{restaurant?.neighborhood}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
