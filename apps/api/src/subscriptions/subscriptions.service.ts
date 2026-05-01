import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import { PRICING } from '@dineroot/shared';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly paystackSecretKey: string;
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.paystackSecretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
  }

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Get subscription status for a restaurant
   */
  async getSubscription(restaurantId: string) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  /**
   * Initialize a subscription via Paystack
   */
  async createSubscription(
    restaurantId: string,
    plan: string,
    email: string,
  ) {
    const pricingTiers = {
      ...PRICING.marketplace,
      ...PRICING.whatsapp_standalone,
    } as Record<string, { price: number | null; name: string }>;

    const tierInfo = pricingTiers[plan];
    if (!tierInfo || !tierInfo.price) {
      throw new BadRequestException('Invalid plan or plan requires custom pricing');
    }

    if (!this.paystackSecretKey) {
      // Dev mode: create mock subscription
      const { data } = await this.supabase
        .from('subscriptions')
        .insert({
          restaurant_id: restaurantId,
          plan,
          status: 'active',
          amount: tierInfo.price,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .select()
        .single();

      return { subscription: data, authorization_url: null };
    }

    // Initialize Paystack transaction for subscription
    const response = await fetch(
      `${this.paystackBaseUrl}/transaction/initialize`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: tierInfo.price * 100, // kobo
          plan: this.configService.get(`PAYSTACK_${plan.toUpperCase()}_PLAN_CODE`),
          metadata: {
            restaurant_id: restaurantId,
            plan_name: plan,
          },
        }),
      },
    );

    const result = await response.json();

    if (!result.status) {
      throw new BadRequestException(
        result.message || 'Failed to initialize subscription',
      );
    }

    // Create pending subscription record
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .insert({
        restaurant_id: restaurantId,
        plan,
        status: 'pending',
        amount: tierInfo.price,
        paystack_reference: result.data.reference,
      })
      .select()
      .single();

    return {
      subscription,
      authorization_url: result.data.authorization_url,
    };
  }

  /**
   * Activate subscription after successful payment
   */
  async activateSubscription(reference: string) {
    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .eq('paystack_reference', reference)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update restaurant tier
    const plan = subscription.plan;
    const tier =
      plan === 'premium' ? 'premium' : plan === 'standard' ? 'standard' : 'free';

    await this.supabase
      .from('restaurants')
      .update({ tier })
      .eq('id', subscription.restaurant_id);

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(restaurantId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active')
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Active subscription not found');
    }

    // If Paystack subscription exists, cancel it
    if (data.paystack_subscription_code && this.paystackSecretKey) {
      try {
        await fetch(
          `${this.paystackBaseUrl}/subscription/disable`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: data.paystack_subscription_code,
              token: data.paystack_email_token,
            }),
          },
        );
      } catch (err) {
        this.logger.error(`Failed to cancel Paystack subscription: ${err}`);
      }
    }

    return data;
  }

  /**
   * Check if a restaurant's booking limit is reached (for tiered plans)
   */
  async checkBookingLimit(restaurantId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number | null;
  }> {
    const subscription = await this.getSubscription(restaurantId);
    const plan = subscription?.plan || 'free';

    const pricingTiers = {
      ...PRICING.marketplace,
      ...PRICING.whatsapp_standalone,
    } as Record<string, { maxBookings: number }>;

    const maxBookings = pricingTiers[plan]?.maxBookings ?? 50;

    if (maxBookings === Infinity) {
      return { allowed: true, current: 0, limit: null };
    }

    // Count this month's bookings
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', firstOfMonth.toISOString());

    const current = count || 0;

    return {
      allowed: current < maxBookings,
      current,
      limit: maxBookings,
    };
  }
}
