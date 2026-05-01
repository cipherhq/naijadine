import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateSlug, generateBotCode } from '@dineroot/shared';

const ADMIN_ROLES = ['admin', 'super_admin'];

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      city,
      neighborhood,
      address,
      phone,
      business_category,
      product_type,
      whatsapp_plan,
      owner_email,
      auto_approve,
      payment_gateway,
      bank_code,
      account_number,
      account_name,
      bank_name,
    } = body;

    if (!name || !city || !neighborhood) {
      return NextResponse.json(
        { message: 'Missing required fields: name, city, neighborhood' },
        { status: 400 },
      );
    }

    const service = createServiceClient();

    // Generate slug with collision handling
    const slug = generateSlug(name);
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

    // Generate bot_code with collision handling
    let botCode = generateBotCode(name);
    const { data: existingBot } = await service
      .from('restaurants')
      .select('bot_code')
      .eq('bot_code', botCode)
      .maybeSingle();

    if (existingBot) {
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

    // Resolve owner if email provided
    let ownerId: string | null = null;
    if (owner_email) {
      const { data: ownerProfile } = await service
        .from('profiles')
        .select('id, role')
        .eq('email', owner_email.trim().toLowerCase())
        .maybeSingle();

      if (ownerProfile) {
        ownerId = ownerProfile.id;
        // Upgrade role to restaurant_owner if currently diner
        if (ownerProfile.role === 'diner' || !ownerProfile.role) {
          await service
            .from('profiles')
            .update({ role: 'restaurant_owner' })
            .eq('id', ownerProfile.id);
        }
      }
    }

    // Insert restaurant
    const status = auto_approve ? 'approved' : 'pending_review';
    const { data: restaurant, error: insertError } = await service
      .from('restaurants')
      .insert({
        ...(ownerId && { owner_id: ownerId }),
        name,
        slug: finalSlug,
        bot_code: botCode,
        city,
        neighborhood,
        address: address || null,
        phone: phone || null,
        business_category: business_category || 'restaurant',
        product_type: product_type || 'whatsapp_standalone',
        whatsapp_plan: whatsapp_plan || 'starter',
        status,
      })
      .select('id, bot_code, slug')
      .single();

    if (insertError || !restaurant) {
      return NextResponse.json(
        { message: 'Failed to create business', error: insertError?.message },
        { status: 500 },
      );
    }

    // Create whatsapp_config with defaults
    await service.from('whatsapp_config').insert({
      restaurant_id: restaurant.id,
      bot_greeting: `Welcome to ${name}! How can we help you today?`,
      auto_confirm: true,
    });

    // Optional: set up payment subaccount if bank details provided
    let subaccountCode: string | null = null;
    if (payment_gateway && bank_code && account_number && account_name && bank_name) {
      // Read commission from config
      const { data: configRow } = await service
        .from('platform_config')
        .select('value')
        .eq('key', 'platform_commission_pct')
        .single();
      const commissionPct = parseFloat(configRow?.value || '10');

      const paystackKey = process.env.PAYSTACK_SECRET_KEY;
      const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;

      if (
        (payment_gateway === 'paystack' && !paystackKey) ||
        (payment_gateway === 'flutterwave' && !flutterwaveKey)
      ) {
        // Mock mode
        const { randomUUID } = await import('crypto');
        subaccountCode = `mock_sub_${randomUUID().slice(0, 8)}`;
      } else if (payment_gateway === 'paystack' && paystackKey) {
        const res = await fetch('https://api.paystack.co/subaccount', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            business_name: name,
            settlement_bank: bank_code,
            account_number,
            percentage_charge: commissionPct,
          }),
        });
        const data = await res.json();
        if (data.status) subaccountCode = data.data.subaccount_code;
      } else if (payment_gateway === 'flutterwave' && flutterwaveKey) {
        const res = await fetch('https://api.flutterwave.com/v3/subaccounts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flutterwaveKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_bank: bank_code,
            account_number,
            business_name: name,
            split_type: 'percentage',
            split_value: commissionPct,
          }),
        });
        const data = await res.json();
        if (data.status === 'success') subaccountCode = data.data.subaccount_id;
      }

      if (subaccountCode) {
        await service
          .from('restaurants')
          .update({ payment_gateway, gateway_subaccount_code: subaccountCode })
          .eq('id', restaurant.id);

        await service.from('bank_accounts').upsert(
          {
            restaurant_id: restaurant.id,
            bank_name,
            bank_code,
            account_number,
            account_name,
            is_verified: true,
          },
          { onConflict: 'restaurant_id' },
        );
      }
    }

    // Audit log
    await service.from('audit_logs').insert({
      action: 'admin_onboard_business',
      entity_type: 'restaurant',
      entity_id: restaurant.id,
      user_id: user.id,
      details: {
        name,
        city,
        neighborhood,
        business_category: business_category || 'restaurant',
        product_type: product_type || 'whatsapp_standalone',
        owner_email: owner_email || null,
        auto_approve: !!auto_approve,
        ...(subaccountCode && { payment_gateway, subaccount_code: subaccountCode }),
      },
    });

    return NextResponse.json({
      restaurant_id: restaurant.id,
      bot_code: restaurant.bot_code,
      slug: restaurant.slug,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 },
    );
  }
}
