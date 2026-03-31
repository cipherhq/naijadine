'use client';

import { useState, useEffect } from 'react';

function getFavoriteIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('naijadine_favorites') || '[]');
  } catch {
    return [];
  }
}

export function FavoriteButton({ restaurantId }: { restaurantId: string }) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    setIsFav(getFavoriteIds().includes(restaurantId));
  }, [restaurantId]);

  function toggle() {
    const ids = getFavoriteIds();
    let updated: string[];
    if (ids.includes(restaurantId)) {
      updated = ids.filter((id) => id !== restaurantId);
    } else {
      updated = [...ids, restaurantId];
    }
    localStorage.setItem('naijadine_favorites', JSON.stringify(updated));
    setIsFav(!isFav);
  }

  return (
    <button
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur hover:bg-white transition"
      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={`h-5 w-5 ${isFav ? 'text-red-500' : 'text-gray-400'}`}
        fill={isFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
