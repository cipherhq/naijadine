import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: 'https://dineroot.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://dineroot.com/restaurants', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://dineroot.com/deals', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://dineroot.com/about', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://dineroot.com/pricing', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://dineroot.com/contact', changeFrequency: 'monthly', priority: 0.4 },
    { url: 'https://dineroot.com/terms', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://dineroot.com/privacy', changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Restaurant pages
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('slug, updated_at')
    .in('status', ['active', 'approved'])
    .eq('product_type', 'marketplace');

  const restaurantPages: MetadataRoute.Sitemap = (restaurants || []).map((r) => ({
    url: `https://dineroot.com/restaurants/${r.slug}`,
    lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...restaurantPages];
}
