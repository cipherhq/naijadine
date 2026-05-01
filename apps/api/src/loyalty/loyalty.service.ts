import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LOYALTY_TIERS } from '@dineroot/shared';

type TierKey = keyof typeof LOYALTY_TIERS;

const TIER_ORDER: TierKey[] = ['bronze', 'silver', 'gold', 'platinum'];

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Check and upgrade a user's loyalty tier after booking completion.
   * Call this from ReservationsService.complete()
   */
  async checkTierProgression(userId: string): Promise<{
    upgraded: boolean;
    previousTier: string;
    currentTier: string;
  }> {
    // Get current profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('loyalty_tier, loyalty_points')
      .eq('id', userId)
      .single();

    if (!profile) {
      return { upgraded: false, previousTier: 'bronze', currentTier: 'bronze' };
    }

    // Count completed bookings
    const { count } = await this.supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    const completedBookings = count || 0;
    const previousTier = (profile.loyalty_tier || 'bronze') as TierKey;

    // Determine new tier (highest qualifying)
    let newTier: TierKey = 'bronze';
    for (const tier of TIER_ORDER) {
      if (completedBookings >= LOYALTY_TIERS[tier].minBookings) {
        newTier = tier;
      }
    }

    // Check if upgraded
    const previousIndex = TIER_ORDER.indexOf(previousTier);
    const newIndex = TIER_ORDER.indexOf(newTier);

    if (newIndex > previousIndex) {
      // Upgrade!
      await this.supabase
        .from('profiles')
        .update({
          loyalty_tier: newTier,
          loyalty_points: (profile.loyalty_points || 0) + 10, // Bonus points for tier upgrade
        })
        .eq('id', userId);

      // Notify user
      try {
        const tierInfo = LOYALTY_TIERS[newTier];
        await this.notificationsService.dispatch({
          userId,
          type: 'loyalty_upgrade',
          channels: ['email', 'push', 'in_app'],
          title: `You've reached ${tierInfo.name} tier!`,
          body: `Congratulations! You've been upgraded to ${tierInfo.name} tier on DineRoot. You now enjoy ${tierInfo.discountPct}% off deposits on every booking.`,
          emailSubject: `You're now ${tierInfo.name} on DineRoot!`,
          emailHtml: `<p>Congratulations! You've been upgraded to <strong>${tierInfo.name}</strong> tier.</p><p>You now enjoy <strong>${tierInfo.discountPct}% off</strong> deposits on every booking.</p>`,
        });
      } catch (err) {
        this.logger.error(`Failed to send loyalty upgrade notification: ${err}`);
      }

      return { upgraded: true, previousTier, currentTier: newTier };
    }

    // Add a loyalty point for completing a booking (no tier change)
    await this.supabase
      .from('profiles')
      .update({
        loyalty_points: (profile.loyalty_points || 0) + 1,
      })
      .eq('id', userId);

    return { upgraded: false, previousTier, currentTier: previousTier };
  }

  /**
   * Calculate loyalty discount for a deposit amount
   */
  calculateDiscount(tier: string, amount: number): number {
    const tierKey = (tier || 'bronze') as TierKey;
    const tierInfo = LOYALTY_TIERS[tierKey];

    if (!tierInfo || tierInfo.discountPct === 0) return 0;

    return Math.round(amount * (tierInfo.discountPct / 100));
  }

  /**
   * Get loyalty status for a user
   */
  async getStatus(userId: string) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('loyalty_tier, loyalty_points')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    const currentTier = (profile.loyalty_tier || 'bronze') as TierKey;
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const nextTier =
      currentIndex < TIER_ORDER.length - 1
        ? TIER_ORDER[currentIndex + 1]
        : null;

    // Count completed bookings
    const { count } = await this.supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    const completedBookings = count || 0;
    const nextTierInfo = nextTier ? LOYALTY_TIERS[nextTier] : null;

    return {
      tier: currentTier,
      tier_name: LOYALTY_TIERS[currentTier].name,
      discount_pct: LOYALTY_TIERS[currentTier].discountPct,
      color: LOYALTY_TIERS[currentTier].color,
      points: profile.loyalty_points || 0,
      completed_bookings: completedBookings,
      next_tier: nextTier
        ? {
            name: nextTierInfo!.name,
            bookings_needed: nextTierInfo!.minBookings - completedBookings,
            discount_pct: nextTierInfo!.discountPct,
          }
        : null,
    };
  }
}
