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

    const { reservation_id, callback_url } = await request.json();

    if (!reservation_id || !callback_url) {
      return NextResponse.json(
        { message: 'reservation_id and callback_url are required' },
        { status: 400 },
      );
    }

    // Get reservation
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name, payment_gateway, gateway_subaccount_code)')
      .eq('id', reservation_id)
      .eq('user_id', user.id)
      .single();

    if (!reservation) {
      return NextResponse.json(
        { message: 'Reservation not found' },
        { status: 404 },
      );
    }

    if (reservation.deposit_status === 'paid') {
      return NextResponse.json(
        { message: 'Deposit already paid' },
        { status: 400 },
      );
    }

    if (reservation.deposit_amount <= 0) {
      return NextResponse.json(
        { message: 'No deposit required' },
        { status: 400 },
      );
    }

    // Get user email for Paystack
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', user.id)
      .single();

    const email =
      profile?.email || `${(profile?.phone as string)?.replace('+', '')}@naijadine.com`;

    const idempotencyKey = randomUUID();
    const amountInKobo = reservation.deposit_amount * 100;
    const restaurantData = reservation.restaurants as {
      name: string;
      payment_gateway: string | null;
      gateway_subaccount_code: string | null;
    } | null;
    const restaurantName = restaurantData?.name || 'Restaurant';

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey) {
      // Dev mode — create mock payment and return mock URL
      const { data: payment } = await supabase
        .from('payments')
        .insert({
          reservation_id,
          user_id: user.id,
          amount: reservation.deposit_amount,
          currency: 'NGN',
          gateway: 'paystack',
          gateway_reference: `mock_${idempotencyKey}`,
          status: 'pending',
          idempotency_key: idempotencyKey,
          metadata: { reservation_ref: reservation.reference_code },
        })
        .select()
        .single();

      return NextResponse.json({
        authorization_url: `${callback_url}?reference=mock_${idempotencyKey}&trxref=mock_${idempotencyKey}`,
        access_code: 'mock_access_code',
        reference: `mock_${idempotencyKey}`,
        payment_id: payment?.id,
      });
    }

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        callback_url,
        // Pass subaccount for automatic payment splitting
        ...(restaurantData?.payment_gateway === 'paystack' &&
          restaurantData.gateway_subaccount_code && {
            subaccount: restaurantData.gateway_subaccount_code,
          }),
        metadata: {
          reservation_id,
          user_id: user.id,
          reservation_ref: reservation.reference_code,
          custom_fields: [
            {
              display_name: 'Restaurant',
              variable_name: 'restaurant',
              value: restaurantName,
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json(
        { message: 'Failed to initialize payment' },
        { status: 502 },
      );
    }

    // Store payment record
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        reservation_id,
        user_id: user.id,
        amount: reservation.deposit_amount,
        currency: 'NGN',
        gateway: 'paystack',
        gateway_reference: data.data.reference,
        status: 'pending',
        idempotency_key: idempotencyKey,
        metadata: {
          access_code: data.data.access_code,
          reservation_ref: reservation.reference_code,
        },
      })
      .select()
      .single();

    // Link payment to reservation
    await supabase
      .from('reservations')
      .update({ payment_id: payment?.id })
      .eq('id', reservation_id);

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
      payment_id: payment?.id,
    });
  } catch {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
