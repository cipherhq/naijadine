'use client';

import { useEffect, useState, useRef } from 'react';
import { useRestaurant, useDashboard } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Photo {
  id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  photo_type: string;
  sort_order: number;
  created_at: string;
}

const PHOTO_TYPES = ['food', 'interior', 'exterior', 'ambiance', 'menu', 'other'];

export default function PhotosPage() {
  const restaurant = useRestaurant();
  const { userId } = useDashboard();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('food');

  async function fetchPhotos() {
    const { data } = await supabase
      .from('restaurant_photos')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order')
      .order('created_at', { ascending: false });

    setPhotos(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchPhotos(); }, [restaurant.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${restaurant.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('restaurant-photos')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('restaurant-photos')
        .getPublicUrl(path);

      // Insert record
      await supabase.from('restaurant_photos').insert({
        restaurant_id: restaurant.id,
        uploaded_by: userId,
        url: urlData.publicUrl,
        photo_type: uploadType,
        sort_order: photos.length,
      });
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    fetchPhotos();
  }

  async function deletePhoto(id: string) {
    await supabase.from('restaurant_photos').delete().eq('id', id);
    fetchPhotos();
  }

  async function setCover(url: string) {
    await supabase
      .from('restaurants')
      .update({ cover_photo_url: url })
      .eq('id', restaurant.id);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Photos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {photos.length} photos &middot; Restaurants with 5+ photos get 3x more bookings
          </p>
        </div>
      </div>

      {/* Upload section */}
      <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Photo Type</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {PHOTO_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Select Photos</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleUpload}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-600"
            />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-gray-400">No photos uploaded yet</p>
          <p className="mt-1 text-sm text-gray-300">Upload photos of your food, interior, and ambiance</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
              <img src={photo.url} alt={photo.caption || ''} className="h-full w-full object-cover" />

              {/* Type badge */}
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white capitalize backdrop-blur-sm">
                {photo.photo_type}
              </span>

              {/* Hover actions */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition group-hover:opacity-100">
                <div className="flex w-full gap-2 p-3">
                  <button
                    onClick={() => setCover(photo.url)}
                    className="flex-1 rounded-lg bg-white/90 py-1.5 text-xs font-medium text-gray-900 hover:bg-white"
                  >
                    Set as Cover
                  </button>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
