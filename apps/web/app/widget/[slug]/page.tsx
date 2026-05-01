import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { WidgetBookingForm } from './WidgetBookingForm';

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, deposit_per_guest, operating_hours, max_party_size, advance_booking_days')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!restaurant) notFound();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Book a Table — {restaurant.name}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #111; }
        `}</style>
      </head>
      <body>
        <WidgetBookingForm restaurant={restaurant} />
      </body>
    </html>
  );
}
