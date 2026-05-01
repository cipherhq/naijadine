import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateSlug, generateBotCode, CITIES, BUSINESS_CATEGORY_KEYS, getDefaultGreeting } from '@dineroot/shared';

const VALID_PLANS = ['starter', 'professional'] as const;
const VALID_CITIES = Object.keys(CITIES);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name, city, neighborhood, address, phone, plan, bot_alias, bot_greeting,
      business_category, cuisine_types, pricing_tier, services_description,
    } = body;

    // Validate required fields
    if (!name || !city || !neighborhood || !address || !phone || !plan) {
      return NextResponse.json(
        { message: 'Missing required fields: name, city, neighborhood, address, phone, plan' },
        { status: 400 },
      );
    }

    // Validate business_category if provided
    if (business_category && !BUSINESS_CATEGORY_KEYS.includes(business_category)) {
      return NextResponse.json(
        { message: 'Invalid business category' },
        { status: 400 },
      );
    }

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { message: 'Invalid plan. Must be starter or professional.' },
        { status: 400 },
      );
    }

    if (!VALID_CITIES.includes(city)) {
      return NextResponse.json(
        { message: 'Invalid city' },
        { status: 400 },
      );
    }

    const service = createServiceClient();

    // Generate slug and bot_code
    const slug = generateSlug(name);
    let botCode = generateBotCode(name);

    // Handle bot_code collision
    const { data: existing } = await service
      .from('restaurants')
      .select('bot_code')
      .eq('bot_code', botCode)
      .maybeSingle();

    if (existing) {
      for (let i = 1; i <= 99; i++) {
        const candidate = `${botCode}-${String(i).padStart(2, '0')}`.slice(0, 30);
        const { data: collision } = await service
          .from('restaurants')
          .select('bot_code')
          .eq('bot_code', candidate)
          .maybeSingle();
        if (!collision) {
          botCode = candidate;
          break;
        }
      }
    }

    // Handle slug collision
    let finalSlug = slug;
    const { data: slugExists } = await service
      .from('restaurants')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (slugExists) {
      for (let i = 1; i <= 99; i++) {
        const candidate = `${slug}-${i}`;
        const { data: collision } = await service
          .from('restaurants')
          .select('slug')
          .eq('slug', candidate)
          .maybeSingle();
        if (!collision) {
          finalSlug = candidate;
          break;
        }
      }
    }

    // Build category-specific metadata
    const categoryMeta: Record<string, unknown> = {};
    if (cuisine_types) categoryMeta.cuisine_types = cuisine_types;
    if (pricing_tier) categoryMeta.pricing_tier = pricing_tier;
    if (services_description) categoryMeta.services_description = services_description;

    // Create restaurant
    const { data: restaurant, error: insertError } = await service
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name,
        slug: finalSlug,
        bot_code: botCode,
        city,
        neighborhood,
        address,
        phone,
        business_category: business_category || 'restaurant',
        product_type: 'whatsapp_standalone',
        whatsapp_plan: plan,
        is_whitelabel: plan === 'professional',
        status: 'pending',
        ...(Object.keys(categoryMeta).length > 0 ? { category_meta: categoryMeta } : {}),
      })
      .select('id, bot_code, slug')
      .single();

    if (insertError || !restaurant) {
      return NextResponse.json(
        { message: 'Failed to create restaurant', error: insertError?.message },
        { status: 500 },
      );
    }

    // Create whatsapp_config with category-appropriate defaults
    const defaultGreeting = getDefaultGreeting(business_category || 'restaurant', name);
    await service.from('whatsapp_config').insert({
      restaurant_id: restaurant.id,
      bot_greeting: bot_greeting || defaultGreeting,
      bot_alias: bot_alias || null,
      auto_confirm: true,
    });

    // Update profile role to restaurant_owner if currently diner
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'diner' || !profile?.role) {
      await service
        .from('profiles')
        .update({ role: 'restaurant_owner' })
        .eq('id', user.id);
    }

    return NextResponse.json({
      restaurant_id: restaurant.id,
      bot_code: restaurant.bot_code,
      slug: restaurant.slug,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
