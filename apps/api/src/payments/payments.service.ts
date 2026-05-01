import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { SupabaseService } from '../config/supabase.service';
import { PlatformConfigService } from '../common/services/platform-config.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { VerifyBankDto } from './dto/verify-bank.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackSecretKey: string;
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
  ) {
    this.paystackSecretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
  }

  // ── Initialize payment ─────────────────────────────────────
  async initialize(dto: InitializePaymentDto, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Get reservation with restaurant payment details
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name, payment_gateway, gateway_subaccount_code)')
      .eq('id', dto.reservation_id)
      .eq('user_id', userId)
      .single();

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.deposit_status === 'paid') {
      throw new BadRequestException('Deposit already paid');
    }

    if (reservation.deposit_amount <= 0) {
      throw new BadRequestException('No deposit required for this reservation');
    }

    // Get user email
    let email = dto.email;
    if (!email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, phone')
        .eq('id', userId)
        .single();
      email = profile?.email || `${profile?.phone?.replace('+', '')}@dineroot.com`;
    }

    // Generate idempotency key
    const idempotencyKey = randomUUID();

    // Amount in kobo (Naira * 100)
    const amountInKobo = reservation.deposit_amount * 100;

    const restaurantName = (reservation.restaurants as { name: string } | null)?.name || 'Restaurant';

    if (!this.paystackSecretKey) {
      // Dev mode — create mock payment record
      this.logger.warn('PAYSTACK_SECRET_KEY not set — using mock payment');

      const { data: payment } = await supabase
        .from('payments')
        .insert({
          reservation_id: dto.reservation_id,
          user_id: userId,
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

      return {
        authorization_url: `${dto.callback_url}?reference=mock_${idempotencyKey}&trxref=mock_${idempotencyKey}`,
        access_code: 'mock_access_code',
        reference: `mock_${idempotencyKey}`,
        payment_id: payment?.id,
      };
    }

    // Build Paystack payload with split payment if restaurant has subaccount
    const restaurant = reservation.restaurants as {
      name: string;
      payment_gateway: string | null;
      gateway_subaccount_code: string | null;
    } | null;

    const paystackPayload: Record<string, unknown> = {
      email,
      amount: amountInKobo,
      callback_url: dto.callback_url,
      metadata: {
        reservation_id: dto.reservation_id,
        user_id: userId,
        reservation_ref: reservation.reference_code,
        custom_fields: [
          {
            display_name: 'Restaurant',
            variable_name: 'restaurant',
            value: restaurantName,
          },
        ],
      },
    };

    // Split payment: restaurant gets 90%, DineRoot keeps 10% commission
    if (restaurant?.gateway_subaccount_code && restaurant.payment_gateway === 'paystack') {
      paystackPayload.subaccount = restaurant.gateway_subaccount_code;
      paystackPayload.bearer = 'account'; // DineRoot bears Paystack fees
      // Paystack splits: subaccount gets (amount - transaction_charge)
      // We set transaction_charge = our 10% commission
      paystackPayload.transaction_charge = Math.round(amountInKobo * this.platformConfig.commissionRate);
      this.logger.log(
        `Split payment: ${restaurant.gateway_subaccount_code} gets 90%, DineRoot gets 10% (${paystackPayload.transaction_charge} kobo)`,
      );
    }

    // Initialize Paystack transaction
    const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const data = await response.json();

    if (!data.status) {
      this.logger.error('Paystack initialize failed', data);
      throw new BadRequestException('Failed to initialize payment');
    }

    // Store payment record
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        reservation_id: dto.reservation_id,
        user_id: userId,
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
      .eq('id', dto.reservation_id);

    return {
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
      payment_id: payment?.id,
    };
  }

  // ── Verify webhook signature (HMAC-SHA512) ─────────────────
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.paystackSecretKey) return true; // Dev mode

    const hash = createHmac('sha512', this.paystackSecretKey)
      .update(rawBody)
      .digest('hex');

    return hash === signature;
  }

  // ── Process webhook event ──────────────────────────────────
  async processWebhook(event: string, data: Record<string, unknown>) {
    const supabase = this.supabaseService.getClient();
    const reference = data.reference as string;

    if (!reference) {
      this.logger.warn('Webhook missing reference');
      return;
    }

    // Idempotency: check if already processed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('gateway_reference', reference)
      .single();

    if (!existingPayment) {
      this.logger.warn(`Webhook for unknown reference: ${reference}`);
      return;
    }

    if (existingPayment.status === 'success') {
      this.logger.log(`Webhook duplicate for ${reference} — skipping`);
      return;
    }

    if (event === 'charge.success') {
      // Verify amount matches
      const webhookAmountKobo = data.amount as number;
      const { data: payment } = await supabase
        .from('payments')
        .select('amount, reservation_id')
        .eq('gateway_reference', reference)
        .single();

      if (!payment) return;

      const expectedKobo = payment.amount * 100;
      if (webhookAmountKobo !== expectedKobo) {
        this.logger.error(
          `Amount mismatch: webhook=${webhookAmountKobo}, expected=${expectedKobo}`,
        );
        await supabase
          .from('payments')
          .update({ status: 'failed', gateway_status: 'amount_mismatch' })
          .eq('gateway_reference', reference);
        return;
      }

      // Update payment status
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

      // Update reservation deposit status
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

      this.logger.log(`Payment succeeded: ${reference}`);
    } else if (event === 'charge.failed') {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          gateway_status: (data.gateway_response as string) || 'failed',
        })
        .eq('gateway_reference', reference);

      this.logger.log(`Payment failed: ${reference}`);
    }
  }

  // ── Verify payment status via API ──────────────────────────
  async verifyPayment(reference: string, userId?: string) {
    const supabase = this.supabaseService.getClient();

    // Ownership check — prevent IDOR
    if (userId) {
      const { data: ownerCheck } = await supabase
        .from('payments')
        .select('user_id')
        .eq('gateway_reference', reference)
        .single();

      if (ownerCheck && ownerCheck.user_id !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (!this.paystackSecretKey || reference.startsWith('mock_')) {
      // Dev mode — auto-succeed
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('gateway_reference', reference)
        .single();

      if (payment && payment.status === 'pending') {
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
      }

      return { status: 'success', reference };
    }

    const response = await fetch(
      `${this.paystackBaseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.paystackSecretKey}` },
      },
    );

    const data = await response.json();

    if (!data.status) {
      throw new BadRequestException('Payment verification failed');
    }

    // Process based on status
    if (data.data.status === 'success') {
      await this.processWebhook('charge.success', data.data);
    }

    return {
      status: data.data.status,
      reference: data.data.reference,
      amount: data.data.amount / 100,
      currency: data.data.currency,
    };
  }

  // ── Refund ─────────────────────────────────────────────────
  async refund(dto: RefundPaymentDto, userId: string, isAdmin = false) {
    const supabase = this.supabaseService.getClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*, reservations (id, user_id, restaurant_id, cancelled_by, cancelled_at, restaurants (cancellation_window_hours))')
      .eq('id', dto.payment_id)
      .single();

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'success') {
      throw new BadRequestException('Can only refund successful payments');
    }

    const reservation = payment.reservations as {
      id: string;
      user_id: string;
      restaurant_id: string;
      cancelled_by: string | null;
      cancelled_at: string | null;
      restaurants: { cancellation_window_hours: number } | null;
    } | null;

    // Verify ownership unless admin
    if (!isAdmin && reservation?.user_id !== userId) {
      throw new ForbiddenException('Not authorized to refund this payment');
    }

    const refundAmount = dto.amount || payment.amount;
    const refundAmountKobo = refundAmount * 100;

    // Determine refund type
    let refundType = dto.type || 'policy_exception';
    if (reservation?.cancelled_by === 'restaurant' || reservation?.cancelled_by === 'system') {
      refundType = 'restaurant_fault';
    }

    // Auto-approve check
    const needsApproval = refundType === 'dispute' || refundType === 'policy_exception';

    // Create refund record
    const { data: refundRecord, error: refundError } = await supabase
      .from('refunds')
      .insert({
        payment_id: dto.payment_id,
        reservation_id: reservation?.id,
        user_id: reservation?.user_id || userId,
        amount: refundAmount,
        type: refundType,
        reason: dto.reason || null,
        status: needsApproval && !isAdmin ? 'pending' : 'processing',
        approved_by: isAdmin ? userId : null,
        approved_at: isAdmin || !needsApproval ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (refundError) {
      throw new BadRequestException('Failed to create refund');
    }

    // If auto-approved, process via Paystack
    if (!needsApproval || isAdmin) {
      if (this.paystackSecretKey && !payment.gateway_reference.startsWith('mock_')) {
        try {
          const response = await fetch(`${this.paystackBaseUrl}/refund`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transaction: payment.gateway_reference,
              amount: refundAmountKobo,
            }),
          });

          const data = await response.json();

          if (data.status) {
            await supabase
              .from('refunds')
              .update({
                status: 'completed',
                gateway_refund_ref: data.data?.transaction?.reference,
                processed_at: new Date().toISOString(),
              })
              .eq('id', refundRecord.id);

            await supabase
              .from('payments')
              .update({ status: 'refunded' })
              .eq('id', dto.payment_id);

            if (reservation?.id) {
              await supabase
                .from('reservations')
                .update({ deposit_status: 'refunded' })
                .eq('id', reservation.id);
            }
          } else {
            this.logger.error('Paystack refund failed', data);
            await supabase
              .from('refunds')
              .update({ status: 'rejected', rejected_reason: 'Gateway refund failed' })
              .eq('id', refundRecord.id);
          }
        } catch (error) {
          this.logger.error('Refund API call failed', error);
        }
      } else {
        // Dev mode — auto-complete
        await supabase
          .from('refunds')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', refundRecord.id);

        await supabase
          .from('payments')
          .update({ status: 'refunded' })
          .eq('id', dto.payment_id);
      }
    }

    return refundRecord;
  }

  // ── Bank account verification via Paystack ─────────────────
  async verifyBankAccount(dto: VerifyBankDto) {
    if (!this.paystackSecretKey) {
      return {
        account_name: 'TEST ACCOUNT NAME',
        account_number: dto.account_number,
        bank_code: dto.bank_code,
      };
    }

    const response = await fetch(
      `${this.paystackBaseUrl}/bank/resolve?account_number=${dto.account_number}&bank_code=${dto.bank_code}`,
      {
        headers: { Authorization: `Bearer ${this.paystackSecretKey}` },
      },
    );

    const data = await response.json();

    if (!data.status) {
      throw new BadRequestException(
        'Could not verify account. Please check the account number and bank.',
      );
    }

    return {
      account_name: data.data.account_name,
      account_number: data.data.account_number,
      bank_code: dto.bank_code,
    };
  }

  // ── Create Paystack Transfer Recipient ─────────────────────
  async createTransferRecipient(
    restaurantId: string,
    bankAccountId: string,
    accountName: string,
    accountNumber: string,
    bankCode: string,
  ) {
    const supabase = this.supabaseService.getClient();

    if (!this.paystackSecretKey) {
      await supabase
        .from('bank_accounts')
        .update({
          paystack_recipient_code: `mock_rcp_${Date.now()}`,
          is_verified: true,
          status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .eq('id', bankAccountId);

      return { recipient_code: `mock_rcp_${Date.now()}` };
    }

    const response = await fetch(`${this.paystackBaseUrl}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new BadRequestException('Failed to create transfer recipient');
    }

    const recipientCode = data.data.recipient_code;

    // Update bank account with recipient code
    await supabase
      .from('bank_accounts')
      .update({
        paystack_recipient_code: recipientCode,
        is_verified: true,
        status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', bankAccountId);

    return { recipient_code: recipientCode };
  }

  // ── Payout Execution ───────────────────────────────────────

  async calculatePayout(
    restaurantId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Sum successful payments for the period
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'success')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .in(
        'reservation_id',
        (
          await supabase
            .from('reservations')
            .select('id')
            .eq('restaurant_id', restaurantId)
        ).data?.map((r) => r.id) || [],
      );

    // Sum refunds for the period
    const { data: refunds } = await supabase
      .from('refunds')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    const grossAmount = (payments || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const refundAmount = (refunds || []).reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );
    const commissionRate = this.platformConfig.commissionRate;
    const commissionAmount = Math.round(
      (grossAmount - refundAmount) * commissionRate,
    );
    const netAmount = grossAmount - refundAmount - commissionAmount;

    return {
      gross_amount: grossAmount,
      refund_amount: refundAmount,
      commission_amount: commissionAmount,
      net_amount: netAmount,
    };
  }

  async executePayout(payoutId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: payout } = await supabase
      .from('payouts')
      .select('*, bank_accounts(paystack_recipient_code)')
      .eq('id', payoutId)
      .eq('status', 'pending')
      .single();

    if (!payout) {
      throw new NotFoundException('Payout not found or not pending');
    }

    const recipientCode =
      payout.bank_accounts?.paystack_recipient_code;
    if (!recipientCode) {
      throw new BadRequestException(
        'Restaurant has no verified bank account',
      );
    }

    // Dev mode
    if (!this.paystackSecretKey) {
      this.logger.warn('Dev mode: Mocking payout execution');
      await supabase
        .from('payouts')
        .update({
          status: 'completed',
          gateway_reference: `mock_transfer_${Date.now()}`,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      return { success: true, reference: `mock_transfer_${Date.now()}` };
    }

    // Paystack Transfer API
    const response = await fetch(`${this.paystackBaseUrl}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: payout.net_amount * 100, // kobo
        recipient: recipientCode,
        reason: `DineRoot payout ${payout.period_start} to ${payout.period_end}`,
        reference: `payout_${payoutId}_${Date.now()}`,
      }),
    });

    const result = await response.json();

    if (!result.status) {
      this.logger.error(`Payout failed: ${JSON.stringify(result)}`);
      await supabase
        .from('payouts')
        .update({ status: 'failed' })
        .eq('id', payoutId);

      throw new BadRequestException(
        result.message || 'Payout transfer failed',
      );
    }

    await supabase
      .from('payouts')
      .update({
        status: 'processing',
        gateway_reference: result.data.transfer_code,
      })
      .eq('id', payoutId);

    return {
      success: true,
      reference: result.data.transfer_code,
    };
  }

  async processTransferWebhook(event: string, data: Record<string, unknown>) {
    const supabase = this.supabaseService.getClient();
    const transferCode = data.transfer_code as string;

    if (!transferCode) return;

    const statusMap: Record<string, string> = {
      'transfer.success': 'completed',
      'transfer.failed': 'failed',
      'transfer.reversed': 'failed',
    };

    const newStatus = statusMap[event];
    if (!newStatus) return;

    await supabase
      .from('payouts')
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
      })
      .eq('gateway_reference', transferCode);
  }

  // ── List banks ─────────────────────────────────────────────
  async listBanks() {
    if (!this.paystackSecretKey) {
      return [
        { name: 'Access Bank', code: '044' },
        { name: 'GTBank', code: '058' },
        { name: 'First Bank', code: '011' },
        { name: 'UBA', code: '033' },
        { name: 'Zenith Bank', code: '057' },
      ];
    }

    const response = await fetch(`${this.paystackBaseUrl}/bank?country=nigeria`, {
      headers: { Authorization: `Bearer ${this.paystackSecretKey}` },
    });

    const data = await response.json();
    return data.data || [];
  }
}
