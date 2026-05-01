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

    const body = await request.json();
    const { reference, restaurant_id: bodyRestaurantId, plan: bodyPlan } = body;

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    let restaurantId: string | undefined;
    let plan: string | undefined;
    let amountKobo = 0;

    if (reference && paystackKey) {
      // Standard flow: verify transaction via Paystack API
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
      restaurantId = metadata?.restaurant_id || bodyRestaurantId;
      plan = metadata?.plan || bodyPlan;
      amountKobo = data.data.amount || 0;
    } else if (bodyRestaurantId && bodyPlan) {
      // Payment page flow: Paystack payment page handles the charge,
      // we just activate the restaurant based on the callback params
      restaurantId = bodyRestaurantId;
      plan = bodyPlan;
    }

    if (!restaurantId || !plan) {
      return NextResponse.json(
        { message: 'Missing restaurant_id, plan, or payment reference' },
        { status: 400 },
      );
    }

    // Verify the user owns this restaurant
    const { data: ownerCheck } = await supabase
      .from('restaurants')
      .select('owner_id')
      .eq('id', restaurantId)
      .single();

    if (!ownerCheck || ownerCheck.owner_id !== user.id) {
      return NextResponse.json(
        { message: 'Restaurant not found or not owned by you' },
        { status: 403 },
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
      amount: amountKobo ? Math.round(amountKobo / 100) : (plan === 'professional' ? 35000 : 15000),
      paystack_subscription_code: null,
      paystack_customer_code: null,
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
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
