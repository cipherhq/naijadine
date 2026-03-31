import { NextResponse, type NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    // Verify signature
    if (paystackKey) {
      const hash = createHmac('sha512', paystackKey)
        .update(rawBody)
        .digest('hex');

      if (hash !== signature) {
        return NextResponse.json(
          { message: 'Invalid signature' },
          { status: 400 },
        );
      }
    }

    const body = JSON.parse(rawBody);
    const event = body.event as string;
    const data = body.data as Record<string, unknown>;
    const reference = data.reference as string;

    if (!reference) {
      return NextResponse.json({ received: true });
    }

    const supabase = await createClient();

    // Idempotency check
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status, amount, reservation_id')
      .eq('gateway_reference', reference)
      .single();

    if (!existingPayment) {
      return NextResponse.json({ received: true });
    }

    if (existingPayment.status === 'success') {
      return NextResponse.json({ received: true });
    }

    if (event === 'charge.success') {
      // Verify amount
      const webhookAmountKobo = data.amount as number;
      const expectedKobo = existingPayment.amount * 100;

      if (webhookAmountKobo !== expectedKobo) {
        await supabase
          .from('payments')
          .update({ status: 'failed', gateway_status: 'amount_mismatch' })
          .eq('gateway_reference', reference);
        return NextResponse.json({ received: true });
      }

      const authorization = data.authorization as Record<string, string> | undefined;
      await supabase
        .from('payments')
        .update({
          status: 'success',
          gateway_status: 'success',
          payment_method: (data.channel as string) || 'card',
          card_last_four: authorization?.last4 || null,
          card_brand: authorization?.brand || null,
          paid_at: new Date().toISOString(),
        })
        .eq('gateway_reference', reference);

      if (existingPayment.reservation_id) {
        await supabase
          .from('reservations')
          .update({
            deposit_status: 'paid',
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.reservation_id);
      }
    } else if (event === 'charge.failed') {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          gateway_status: (data.gateway_response as string) || 'failed',
        })
        .eq('gateway_reference', reference);
    }

    // ── Subscription events (WhatsApp bot plans) ──
    const metadata = data.metadata as Record<string, string> | undefined;
    const isWhatsAppSub = metadata?.type === 'whatsapp_subscription';

    if (event === 'subscription.create' && isWhatsAppSub && metadata?.restaurant_id) {
      const subCode = (data as Record<string, unknown>).subscription_code as string | undefined;
      const custCode = ((data as Record<string, unknown>).customer as Record<string, string> | undefined)?.customer_code;

      if (subCode) {
        await supabase
          .from('subscriptions')
          .update({
            paystack_subscription_code: subCode,
            paystack_customer_code: custCode || null,
            updated_at: new Date().toISOString(),
          })
          .eq('restaurant_id', metadata.restaurant_id)
          .eq('status', 'active');
      }
    }

    if (event === 'invoice.payment_failed' && isWhatsAppSub && metadata?.restaurant_id) {
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('restaurant_id', metadata.restaurant_id)
        .eq('status', 'active');
    }

    if (event === 'subscription.not_renew' && isWhatsAppSub && metadata?.restaurant_id) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', metadata.restaurant_id)
        .eq('status', 'active');

      // Suspend restaurant
      await supabase
        .from('restaurants')
        .update({ status: 'suspended' })
        .eq('id', metadata.restaurant_id);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
