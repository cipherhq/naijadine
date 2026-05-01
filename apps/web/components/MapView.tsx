'use client';

import { useEffect, useRef } from 'react';

interface MapRestaurant {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  city: string;
  neighborhood: string;
  rating_avg: number;
  cover_photo_url: string | null;
}

declare global {
  interface Window {
    L: any;
  }
}

export function MapView({
  restaurants,
  center,
  zoom = 12,
}: {
  restaurants: MapRestaurant[];
  center?: { lat: number; lng: number };
  zoom?: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }

    // Load Leaflet JS
    function initMap() {
      const L = window.L;
      if (!L || !mapRef.current) return;

      // Cleanup previous instance
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
      }

      const validRestaurants = restaurants.filter((r) => r.latitude && r.longitude);
      const defaultCenter = center || (validRestaurants.length > 0
        ? { lat: validRestaurants[0].latitude, lng: validRestaurants[0].longitude }
        : { lat: 6.5244, lng: 3.3792 }); // Lagos default

      const map = L.map(mapRef.current).setView(
        [defaultCenter.lat, defaultCenter.lng],
        zoom,
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Add markers
      validRestaurants.forEach((r) => {
        const marker = L.marker([r.latitude, r.longitude]).addTo(map);

        const popupHtml = `
          <div style="min-width:180px;font-family:system-ui,sans-serif">
            ${r.cover_photo_url ? `<img src="${r.cover_photo_url}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:8px" />` : ''}
            <strong style="font-size:14px">${r.name}</strong><br/>
            <span style="color:#666;font-size:12px">${r.neighborhood}, ${r.city.replace(/_/g, ' ')}</span><br/>
            ${r.rating_avg > 0 ? `<span style="color:#E8A817;font-size:12px">★ ${Number(r.rating_avg).toFixed(1)}</span><br/>` : ''}
            <a href="/restaurants/${r.slug}" style="display:inline-block;margin-top:6px;padding:4px 12px;background:#F04E37;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600">View & Book</a>
          </div>
        `;

        marker.bindPopup(popupHtml);
      });

      // Fit bounds if multiple markers
      if (validRestaurants.length > 1) {
        const bounds = L.latLngBounds(
          validRestaurants.map((r) => [r.latitude, r.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapInstance.current = map;
    }

    if (window.L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, [restaurants, center, zoom]);

  return (
    <div
      ref={mapRef}
      className="h-[500px] w-full rounded-xl border border-gray-200"
      style={{ zIndex: 1 }}
    />
  );
}
