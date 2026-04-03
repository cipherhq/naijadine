import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { restaurant_id, gateway, bank_code, account_number, account_name, bank_name } =
      await request.json();

    if (!restaurant_id || !gateway || !bank_code || !account_number || !account_name || !bank_name) {
      return NextResponse.json(
        { message: 'All fields are required: restaurant_id, gateway, bank_code, account_number, account_name, bank_name' },
        { status: 400 },
      );
    }

    if (!['paystack', 'flutterwave'].includes(gateway)) {
      return NextResponse.json(
        { message: 'gateway must be paystack or flutterwave' },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(account_number)) {
      return NextResponse.json(
        { message: 'account_number must be exactly 10 digits' },
        { status: 400 },
      );
    }

    // Verify user owns this restaurant or is admin
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, owner_id')
      .eq('id', restaurant_id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ message: 'Restaurant not found' }, { status: 404 });
    }

    // Check ownership or admin role
    if (restaurant.owner_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    // Read commission from platform_config
    const { data: configRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'platform_commission_pct')
      .single();

    const commissionPct = parseFloat(configRow?.value || '10');

    let subaccountCode: string;

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;

    // Mock mode
    if ((gateway === 'paystack' && !paystackKey) || (gateway === 'flutterwave' && !flutterwaveKey)) {
      subaccountCode = `mock_sub_${randomUUID().slice(0, 8)}`;
    } else if (gateway === 'paystack') {
      const res = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: restaurant.name,
          settlement_bank: bank_code,
          account_number,
          percentage_charge: commissionPct,
        }),
      });

      const data = await res.json();

      if (!data.status) {
        return NextResponse.json(
          { message: data.message || 'Failed to create Paystack subaccount' },
          { status: 502 },
        );
      }

      subaccountCode = data.data.subaccount_code;
    } else {
      // Flutterwave
      const res = await fetch('https://api.flutterwave.com/v3/subaccounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: bank_code,
          account_number,
          business_name: restaurant.name,
          split_type: 'percentage',
          split_value: commissionPct,
        }),
      });

      const data = await res.json();

      if (data.status !== 'success') {
        return NextResponse.json(
          { message: data.message || 'Failed to create Flutterwave subaccount' },
          { status: 502 },
        );
      }

      subaccountCode = data.data.subaccount_id;
    }

    // Store subaccount on restaurant
    await supabase
      .from('restaurants')
      .update({
        payment_gateway: gateway,
        gateway_subaccount_code: subaccountCode,
      })
      .eq('id', restaurant_id);

    // Upsert bank_accounts row
    await supabase.from('bank_accounts').upsert(
      {
        restaurant_id,
        bank_name,
        bank_code,
        account_number,
        account_name,
        is_verified: true,
      },
      { onConflict: 'restaurant_id' },
    );

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'payment_subaccount_created',
      entity_type: 'restaurant',
      entity_id: restaurant_id,
      user_id: user.id,
      details: {
        gateway,
        subaccount_code: subaccountCode,
        bank_name,
        commission_pct: commissionPct,
      },
    });

    return NextResponse.json({
      subaccount_code: subaccountCode,
      gateway,
      commission_pct: commissionPct,
    });
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
