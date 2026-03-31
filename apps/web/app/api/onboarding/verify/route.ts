import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json(
        { message: 'Missing payment reference' },
        { status: 400 },
      );
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey) {
      return NextResponse.json(
        { message: 'Payment gateway not configured' },
        { status: 500 },
      );
    }

    // Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackKey}` } },
    );

    const data = await response.json();

    if (data?.data?.status !== 'success') {
      return NextResponse.json(
        { message: 'Payment not yet confirmed', paystack_status: data?.data?.status },
        { status: 402 },
      );
    }

    const metadata = data.data.metadata as Record<string, string> | undefined;
    const restaurantId = metadata?.restaurant_id;
    const plan = metadata?.plan;

    if (!restaurantId || !plan) {
      return NextResponse.json(
        { message: 'Invalid payment metadata' },
        { status: 400 },
      );
    }

    const service = createServiceClient();

    // Create subscription record
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    await service.from('subscriptions').insert({
      restaurant_id: restaurantId,
      plan,
      status: 'active',
      amount: Math.round(data.data.amount / 100), // kobo → naira
      paystack_subscription_code: data.data.plan_object?.subscription_code || null,
      paystack_customer_code: data.data.customer?.customer_code || null,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    // Activate restaurant
    await service
      .from('restaurants')
      .update({ status: 'active' })
      .eq('id', restaurantId);

    // Get bot_code for the response
    const { data: restaurant } = await service
      .from('restaurants')
      .select('bot_code, slug')
      .eq('id', restaurantId)
      .single();

    return NextResponse.json({
      status: 'success',
      restaurant_id: restaurantId,
      bot_code: restaurant?.bot_code,
      slug: restaurant?.slug,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 },
    );
  }
}
