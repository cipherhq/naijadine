'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface ReviewItem {
  id: string;
  type: 'review' | 'photo';
  text?: string;
  rating?: number;
  url?: string;
  caption?: string;
  user_email: string;
  restaurant_name: string;
  status: string;
  created_at: string;
}

export default function ModerationPage() {
  const { verified } = useAdminGuard();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  async function fetchItems() {
    setLoading(true);
    const supabase = createClient();

    // Fetch reviews pending moderation
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, text, rating, moderation_status, created_at, profiles:user_id (email), restaurants:restaurant_id (name)')
      .eq('moderation_status', tab === 'pending' ? 'pending' : tab === 'approved' ? 'approved' : 'rejected')
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch photos pending moderation
    const { data: photos } = await supabase
      .from('restaurant_photos')
      .select('id, url, caption, moderation_status, created_at, restaurants:restaurant_id (name)')
      .eq('moderation_status', tab === 'pending' ? 'pending' : tab === 'approved' ? 'approved' : 'rejected')
      .order('created_at', { ascending: false })
      .limit(50);

    const reviewItems: ReviewItem[] = (reviews || []).map((r) => {
      const profileRaw = r.profiles as unknown;
      const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { email?: string } | null;
      const restRaw = r.restaurants as unknown;
      const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name?: string } | null;
      return {
        id: r.id,
        type: 'review' as const,
        text: r.text,
        rating: r.rating,
        user_email: profile?.email || '—',
        restaurant_name: rest?.name || '—',
        status: r.moderation_status,
        created_at: r.created_at,
      };
    });

    const photoItems: ReviewItem[] = (photos || []).map((p) => {
      const restRaw = p.restaurants as unknown;
      const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name?: string } | null;
      return {
        id: p.id,
        type: 'photo' as const,
        url: p.url,
        caption: p.caption,
        user_email: '—',
        restaurant_name: rest?.name || '—',
        status: p.moderation_status,
        created_at: p.created_at,
      };
    });

    const combined = [...reviewItems, ...photoItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    setItems(combined);
    setLoading(false);
  }

  useEffect(() => {
    if (verified) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, verified]);

  async function moderate(item: ReviewItem, decision: 'approved' | 'rejected') {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const table = item.type === 'review' ? 'reviews' : 'restaurant_photos';
    await supabase
      .from(table)
      .update({ moderation_status: decision })
      .eq('id', item.id);

    await supabase.from('audit_logs').insert({
      action: `${item.type}_${decision}`,
      entity_type: item.type,
      entity_id: item.id,
      user_id: user.id,
      details: { decision },
    });

    fetchItems();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>

      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!verified || loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">
            {tab === 'pending' ? 'No items awaiting moderation' : `No ${tab} items`}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    item.type === 'review' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{item.restaurant_name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              {item.type === 'review' && (
                <div className="mt-3">
                  <div className="flex items-center gap-1 text-gold">
                    {Array.from({ length: item.rating || 0 }).map((_, i) => (
                      <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{item.text}</p>
                  <p className="mt-1 text-xs text-gray-400">By: {item.user_email}</p>
                </div>
              )}

              {item.type === 'photo' && item.url && (
                <div className="mt-3">
                  <img
                    src={item.url}
                    alt={item.caption || 'Restaurant photo'}
                    className="h-40 w-60 rounded-lg object-cover"
                  />
                  {item.caption && <p className="mt-1 text-xs text-gray-500">{item.caption}</p>}
                </div>
              )}

              {tab === 'pending' && (
                <div className="mt-4 flex gap-2 border-t border-gray-50 pt-3">
                  <button
                    onClick={() => moderate(item, 'approved')}
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => moderate(item, 'rejected')}
                    className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
