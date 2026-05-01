import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, price_range, deposit_per_guest, operating_hours, max_party_size, advance_booking_days')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  // Allow CORS for embedding on any domain
  return NextResponse.json(restaurant, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
