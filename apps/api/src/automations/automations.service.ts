import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Get automations for a restaurant
   */
  async getByRestaurant(restaurantId: string) {
    const { data } = await this.supabase
      .from('automations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at');

    return data || [];
  }

  /**
   * Create or seed default automations for a restaurant
   */
  async seedDefaults(restaurantId: string) {
    const { count } = await this.supabase
      .from('automations')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId);

    if ((count || 0) > 0) return; // Already has automations

    const defaults = [
      {
        name: 'Win Back Lapsed Guests',
        description: 'Re-engage guests who haven\'t visited in 60 days',
        trigger_type: 'no_visit_days',
        trigger_config: { days: 60 },
        action_channel: 'whatsapp',
        action_template: 'Hi {{guest_name}}! We miss you at {{restaurant_name}}. Come back and enjoy 10% off your next visit. Book now: {{booking_link}}',
      },
      {
        name: 'Post-Visit Thank You',
        description: 'Thank guests 2 hours after their visit',
        trigger_type: 'post_completion',
        trigger_config: { hours: 2 },
        action_channel: 'whatsapp',
        action_template: 'Thank you for dining at {{restaurant_name}}, {{guest_name}}! We hope you enjoyed your meal. See you again soon!',
      },
      {
        name: 'Review Nudge',
        description: 'Ask for a review 24 hours after visit if none submitted',
        trigger_type: 'no_review',
        trigger_config: { hours: 24 },
        action_channel: 'email',
        action_template: 'Hi {{guest_name}}, how was your experience at {{restaurant_name}}? We\'d love your feedback. Leave a review: {{review_link}}',
      },
      {
        name: 'VIP Guest Alert',
        description: 'Notify staff when a VIP guest makes a booking',
        trigger_type: 'vip_booking',
        trigger_config: {},
        action_channel: 'in_app',
        action_template: 'VIP guest {{guest_name}} has booked for {{date}} at {{time}} ({{party_size}} guests). Prepare a special welcome!',
      },
      {
        name: 'Re-engagement Campaign',
        description: 'Reach out to guests inactive for 90 days',
        trigger_type: 'no_visit_days',
        trigger_config: { days: 90 },
        action_channel: 'email',
        action_template: 'It\'s been a while, {{guest_name}}! We\'ve updated our menu at {{restaurant_name}} and we\'d love for you to try it. Book a table: {{booking_link}}',
      },
    ];

    await this.supabase.from('automations').insert(
      defaults.map((d) => ({ ...d, restaurant_id: restaurantId, is_active: false })),
    );
  }

  /**
   * Toggle automation active state
   */
  async toggle(automationId: string, isActive: boolean) {
    const { data } = await this.supabase
      .from('automations')
      .update({ is_active: isActive })
      .eq('id', automationId)
      .select()
      .single();

    return data;
  }

  /**
   * Execute pending automations (called by cron)
   */
  async executePending() {
    const { data: automations } = await this.supabase
      .from('automations')
      .select('*, restaurants(name, slug)')
      .eq('is_active', true);

    if (!automations?.length) return;

    let totalSent = 0;

    for (const auto of automations) {
      try {
        const config = auto.trigger_config as Record<string, number>;
        let usersToNotify: { id: string; first_name: string }[] = [];

        if (auto.trigger_type === 'no_visit_days') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (config.days || 60));

          // Find users who booked at this restaurant but haven't visited since cutoff
          const { data: lapsed } = await this.supabase
            .from('reservations')
            .select('user_id, profiles!inner(id, first_name)')
            .eq('restaurant_id', auto.restaurant_id)
            .eq('status', 'completed')
            .lt('date', cutoff.toISOString().split('T')[0])
            .limit(20);

          usersToNotify = (lapsed || []).map((r) => ({
            id: r.user_id,
            first_name: (r.profiles as unknown as { first_name: string }).first_name,
          }));

          // Filter out users who already received this automation recently
          const { data: recentLogs } = await this.supabase
            .from('automation_logs')
            .select('user_id')
            .eq('automation_id', auto.id)
            .gte('created_at', cutoff.toISOString());

          const recentUserIds = new Set((recentLogs || []).map((l) => l.user_id));
          usersToNotify = usersToNotify.filter((u) => !recentUserIds.has(u.id));
        }

        if (auto.trigger_type === 'post_completion') {
          const hours = config.hours || 2;
          const windowStart = new Date(Date.now() - (hours + 0.5) * 60 * 60 * 1000);
          const windowEnd = new Date(Date.now() - (hours - 0.5) * 60 * 60 * 1000);

          const { data: completed } = await this.supabase
            .from('reservations')
            .select('user_id, profiles!inner(id, first_name)')
            .eq('restaurant_id', auto.restaurant_id)
            .eq('status', 'completed')
            .gte('completed_at', windowStart.toISOString())
            .lte('completed_at', windowEnd.toISOString());

          usersToNotify = (completed || []).map((r) => ({
            id: r.user_id,
            first_name: (r.profiles as unknown as { first_name: string }).first_name,
          }));
        }

        // Send notifications
        const restaurantName = (auto.restaurants as { name: string })?.name || '';
        const slug = (auto.restaurants as { slug: string })?.slug || '';

        for (const user of usersToNotify.slice(0, 50)) {
          const message = auto.action_template
            .replace(/\{\{guest_name\}\}/g, user.first_name)
            .replace(/\{\{restaurant_name\}\}/g, restaurantName)
            .replace(/\{\{booking_link\}\}/g, `https://dineroot.com/restaurants/${slug}`)
            .replace(/\{\{review_link\}\}/g, `https://dineroot.com/restaurants/${slug}#reviews`);

          try {
            await this.notificationsService.dispatch({
              userId: user.id,
              type: 'broadcast',
              channels: [auto.action_channel],
              title: auto.name,
              body: message,
            });

            await this.supabase.from('automation_logs').insert({
              automation_id: auto.id,
              user_id: user.id,
              channel: auto.action_channel,
              status: 'sent',
            });

            totalSent++;
          } catch (err) {
            this.logger.error(`Automation send failed: ${err}`);
          }
        }

        // Update sent count
        await this.supabase
          .from('automations')
          .update({
            sent_count: auto.sent_count + usersToNotify.length,
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', auto.id);
      } catch (err) {
        this.logger.error(`Automation ${auto.name} failed: ${err}`);
      }
    }

    if (totalSent > 0) {
      this.logger.log(`Sent ${totalSent} automation messages`);
    }
  }
}
