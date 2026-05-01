import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { PRICING } from '@dineroot/shared';

export interface TierCheckResult {
  allowed: boolean;
  plan: string;
  monthlyBookings: number;
  monthlyLimit: number;
  isWhitelabel: boolean;
}

export interface BotTemplates {
  greeting: string;
  confirmation: string;
  reminder: string;
}

@Injectable()
export class StandaloneService {
  private readonly logger = new Logger(StandaloneService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Check if restaurant is within their WhatsApp booking tier limits.
   * Returns tier info and whether a new booking is allowed.
   */
  async checkTierLimits(restaurantId: string): Promise<TierCheckResult> {
    const supabase = this.supabaseService.getClient();

    // Get restaurant plan
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('whatsapp_plan, is_whitelabel')
      .eq('id', restaurantId)
      .single();

    const plan = (restaurant?.whatsapp_plan as string) || 'starter';
    const tierKey = plan as keyof typeof PRICING.whatsapp_standalone;
    const tier = PRICING.whatsapp_standalone[tierKey] || PRICING.whatsapp_standalone.starter;

    // If unlimited, skip counting
    if (tier.maxBookings === Infinity) {
      return {
        allowed: true,
        plan,
        monthlyBookings: 0,
        monthlyLimit: Infinity,
        isWhitelabel: tier.whitelabel,
      };
    }

    // Count this month's WhatsApp bookings
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('channel', 'whatsapp')
      .gte('created_at', monthStart.toISOString());

    const monthlyBookings = count || 0;

    return {
      allowed: monthlyBookings < tier.maxBookings,
      plan,
      monthlyBookings,
      monthlyLimit: tier.maxBookings,
      isWhitelabel: tier.whitelabel,
    };
  }

  /**
   * Get custom bot templates for a restaurant.
   * Falls back to defaults if not configured.
   */
  async getBotTemplates(restaurantId: string): Promise<BotTemplates> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('whatsapp_config')
      .select('bot_greeting, bot_confirmation_template, bot_reminder_template')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    return {
      greeting: data?.bot_greeting || 'Welcome! Let\'s book you a table.',
      confirmation: data?.bot_confirmation_template ||
        '✅ *Booking Confirmed!*\n\n🍽️ {restaurant_name}\n📅 {date}\n🕐 {time}\n👥 {party_size} guests\n🔑 Ref: *{reference_code}*\n\nEnjoy your meal! 🎉',
      reminder: data?.bot_reminder_template ||
        '⏰ *Reminder*\n\nYour reservation at {restaurant_name} is tomorrow at {time} for {party_size} guests.\n\nRef: {reference_code}\n\nSee you there! 🍽️',
    };
  }

  /**
   * Get the bot alias (persona name) for a restaurant, if configured.
   */
  async getBotAlias(restaurantId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('whatsapp_config')
      .select('bot_alias')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    return data?.bot_alias || null;
  }

  /**
   * Fill template variables with actual booking data.
   */
  fillTemplate(
    template: string,
    vars: Record<string, string | number>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }
}
