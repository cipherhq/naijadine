import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRICING } from '@naijadine/shared';

const PLAN_CODES: Record<string, string | undefined> = {
  starter: process.env.PAYSTACK_STARTER_PLAN_CODE,
  professional: process.env.PAYSTACK_PROFESSIONAL_PLAN_CODE,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { restaurant_id, plan } = await request.json();

    if (!restaurant_id || !plan) {
      return NextResponse.json(
        { message: 'Missing restaurant_id or plan' },
        { status: 400 },
      );
    }

    if (plan !== 'starter' && plan !== 'professional') {
      return NextResponse.json(
        { message: 'Invalid plan' },
        { status: 400 },
      );
    }

    // Verify ownership
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, owner_id')
      .eq('id', restaurant_id)
      .single();

    if (!restaurant || restaurant.owner_id !== user.id) {
      return NextResponse.json(
        { message: 'Restaurant not found or not owned by you' },
        { status: 403 },
      );
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey) {
      return NextResponse.json(
        { message: 'Payment gateway not configured' },
        { status: 500 },
      );
    }

    // Get plan pricing
    const pricing = PRICING.whatsapp_standalone[plan as keyof typeof PRICING.whatsapp_standalone];
    const amount = (pricing.price as number) * 100; // kobo

    // Get user email for Paystack
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', user.id)
      .single();

    const email = profile?.email || `${(profile?.phone || user.id).replace('+', '')}@whatsapp.naijadine.com`;

    const paystackPlanCode = PLAN_CODES[plan];

    const payload: Record<string, unknown> = {
      email,
      amount,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://naijadine.com'}/whatsapp/get-started?step=success&restaurant_id=${restaurant_id}`,
      metadata: {
        restaurant_id,
        plan,
        type: 'whatsapp_subscription',
        user_id: user.id,
      },
    };

    // If a Paystack plan code exists, use subscription mode
    if (paystackPlanCode) {
      payload.plan = paystackPlanCode;
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json(
        { message: 'Failed to initialize payment', error: data.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 },
    );
  }
}
