import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createInAppNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json(
        { message: 'reference is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    // Get the payment record
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, amount, reservation_id, user_id')
      .eq('gateway_reference', reference)
      .single();

    if (!payment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 },
      );
    }

    // If already processed, return current status
    if (payment.status === 'success') {
      return NextResponse.json({
        status: 'success',
        reference,
        reservation_id: payment.reservation_id,
      });
    }

    if (!paystackKey || reference.startsWith('mock_')) {
      // Dev mode — auto-succeed
      await supabase
        .from('payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('gateway_reference', reference);

      if (payment.reservation_id) {
        await supabase
          .from('reservations')
          .update({
            deposit_status: 'paid',
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', payment.reservation_id);
      }

      // In-app notification
      if (payment.user_id) {
        await createInAppNotification(
          supabase, payment.user_id, 'payment',
          'Payment Received',
          `Your deposit of ₦${payment.amount.toLocaleString()} has been confirmed.`,
          { payment_id: payment.id, reservation_id: payment.reservation_id },
        );
      }

      return NextResponse.json({
        status: 'success',
        reference,
        reservation_id: payment.reservation_id,
      });
    }

    // Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackKey}` } },
    );

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json(
        { message: 'Payment verification failed' },
        { status: 502 },
      );
    }

    if (data.data.status === 'success') {
      // Verify amount
      const expectedKobo = payment.amount * 100;
      if (data.data.amount !== expectedKobo) {
        await supabase
          .from('payments')
          .update({ status: 'failed', gateway_status: 'amount_mismatch' })
          .eq('gateway_reference', reference);

        return NextResponse.json({ status: 'failed', reference });
      }

      const authorization = data.data.authorization || {};
      await supabase
        .from('payments')
        .update({
          status: 'success',
          gateway_status: 'success',
          payment_method: data.data.channel || 'card',
          card_last_four: authorization.last4 || null,
          card_brand: authorization.brand || null,
          paid_at: new Date().toISOString(),
        })
        .eq('gateway_reference', reference);

      if (payment.reservation_id) {
        await supabase
          .from('reservations')
          .update({
            deposit_status: 'paid',
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', payment.reservation_id);
      }

      // In-app notification
      if (payment.user_id) {
        await createInAppNotification(
          supabase, payment.user_id, 'payment',
          'Payment Received',
          `Your deposit of ₦${payment.amount.toLocaleString()} has been confirmed.`,
          { payment_id: payment.id, reservation_id: payment.reservation_id },
        );
      }

      return NextResponse.json({
        status: 'success',
        reference,
        reservation_id: payment.reservation_id,
      });
    }

    return NextResponse.json({
      status: data.data.status,
      reference,
      reservation_id: payment.reservation_id,
    });
  } catch {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
