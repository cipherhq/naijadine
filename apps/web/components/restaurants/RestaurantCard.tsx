import Link from 'next/link';
import { formatNaira } from '@naijadine/shared';

interface RestaurantCardProps {
  restaurant: {
    slug: string;
    name: string;
    cover_photo_url: string | null;
    cuisine_types: string[];
    neighborhood: string;
    city: string;
    price_range: string;
    rating_avg: number;
    rating_count: number;
    avg_price_per_person: number | null;
  };
}

const priceLabels: Record<string, string> = {
  budget: '$',
  moderate: '$$',
  upscale: '$$$',
  fine_dining: '$$$$',
};

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const cuisines = Array.isArray(restaurant.cuisine_types)
    ? restaurant.cuisine_types
    : [];

  return (
    <Link
      href={`/restaurants/${restaurant.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-[16/10] bg-gray-100">
        {restaurant.cover_photo_url ? (
          <img
            src={restaurant.cover_photo_url}
            alt={restaurant.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-50">
            <span className="text-4xl font-bold text-brand-200">
              {restaurant.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-gray-700 backdrop-blur">
          {priceLabels[restaurant.price_range] || '$$'}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-brand">
          {restaurant.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {cuisines
            .slice(0, 2)
            .map((c: string) => c.replace(/_/g, ' '))
            .join(', ')}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {restaurant.neighborhood}, {restaurant.city.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-1">
            <svg className="h-4 w-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {restaurant.rating_avg > 0 ? restaurant.rating_avg.toFixed(1) : 'New'}
            </span>
            {restaurant.rating_count > 0 && (
              <span className="text-xs text-gray-400">
                ({restaurant.rating_count})
              </span>
            )}
          </div>
        </div>
        {restaurant.avg_price_per_person && (
          <p className="mt-1 text-xs text-gray-400">
            ~{formatNaira(restaurant.avg_price_per_person)} / person
          </p>
        )}
      </div>
    </Link>
  );
}
