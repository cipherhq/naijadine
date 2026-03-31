'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  cover_photo_url: string | null;
  neighborhood: string;
  city: string;
  cuisine_type: string[];
  pricing_tier: string;
  avg_rating: number;
}

function getFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('naijadine_favorites') || '[]');
  } catch {
    return [];
  }
}

function removeFavorite(id: string) {
  const ids = getFavoriteIds().filter((fid) => fid !== id);
  localStorage.setItem('naijadine_favorites', JSON.stringify(ids));
  return ids;
}

export default function FavoritesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const ids = getFavoriteIds();
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_type, pricing_tier, avg_rating')
        .in('id', ids);

      setRestaurants((data as Restaurant[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  function handleRemove(id: string) {
    removeFavorite(id);
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Saved Restaurants</h1>

      {restaurants.length === 0 ? (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="mt-4 text-gray-500">No saved restaurants yet</p>
          <p className="mt-1 text-sm text-gray-400">Tap the heart icon on any restaurant to save it here.</p>
          <Link href="/restaurants" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Browse Restaurants
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {restaurants.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4">
              <Link href={`/restaurants/${r.slug}`} className="flex flex-1 items-center gap-4">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-brand-50">
                  {r.cover_photo_url ? (
                    <img src={r.cover_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-lg font-bold text-brand-200">
                      {r.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{r.name}</h3>
                  <p className="text-sm text-gray-500">{r.neighborhood}, {r.city.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{r.cuisine_type?.join(', ')}</p>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(r.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500"
                aria-label="Remove"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
