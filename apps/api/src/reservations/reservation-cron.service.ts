import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../config/supabase.service';
import { GupshupService } from '../notifications/channels/gupshup.service';

@Injectable()
export class ReservationCronService {
  private readonly logger = new Logger(ReservationCronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly gupshupService: GupshupService,
  ) {}

  @Cron('0 */30 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Running reservation cron jobs...');
    await Promise.all([
      this.send24hReminders(),
      this.send4hReminders(),
      this.sendMenuBeforeDining(),
      this.sendReviewRequests(),
    ]);
    this.logger.log('Reservation cron jobs complete.');
  }

  // ── 24h Reminder (Feature 5) ──────────────────────────

  private async send24hReminders(): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const now = new Date();
      const from23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const to25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, date, time, party_size, user_id, restaurant_id, restaurants (name), profiles:user_id (first_name, phone)')
        .in('status', ['confirmed', 'pending'])
        .eq('reminder_24h_sent', false)
        .gte('date', from23h.toISOString().split('T')[0])
        .lte('date', to25h.toISOString().split('T')[0]);

      if (!reservations || reservations.length === 0) return;

      for (const r of reservations) {
        const rest = r.restaurants as unknown as { name: string } | null;
        const profile = r.profiles as unknown as { first_name: string; phone: string } | null;

        if (!profile?.phone) continue;

        // Check exact time is within 23-25h window
        const reservationDateTime = new Date(`${r.date}T${r.time}`);
        const hoursUntil = (reservationDateTime.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursUntil < 23 || hoursUntil > 25) continue;

        const dateLabel = new Date(r.date + 'T00:00').toLocaleDateString('en-NG', {
          weekday: 'long', day: 'numeric', month: 'long',
        });

        await this.gupshupService.sendText({
          to: profile.phone,
          text: [
            `Hey ${profile.first_name || 'there'}! 🎉🍽️`,
            ``,
            `Your table at *${rest?.name}* is TOMORROW!`,
            `📅 ${dateLabel} at ${r.time}`,
            `👥 ${r.party_size} guest${r.party_size > 1 ? 's' : ''}`,
            ``,
            `We can't wait to see you! Get ready for an amazing dining experience! 🤩`,
          ].join('\n'),
        });

        await supabase
          .from('reservations')
          .update({ reminder_24h_sent: true })
          .eq('id', r.id);

        this.logger.log(`24h reminder sent for reservation ${r.id}`);
      }
    } catch (error) {
      this.logger.error('24h reminder error:', (error as Error).message);
    }
  }

  // ── 4h Reminder (Feature 5) ───────────────────────────

  private async send4hReminders(): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, date, time, party_size, user_id, restaurant_id, restaurants (name, latitude, longitude, address), profiles:user_id (first_name, phone)')
        .in('status', ['confirmed', 'pending'])
        .eq('reminder_2h_sent', false)
        .eq('date', today);

      if (!reservations || reservations.length === 0) return;

      for (const r of reservations) {
        const rest = r.restaurants as unknown as { name: string; latitude: number; longitude: number; address: string } | null;
        const profile = r.profiles as unknown as { first_name: string; phone: string } | null;

        if (!profile?.phone) continue;

        // Check exact time is within 3.5-4.5h window
        const reservationDateTime = new Date(`${r.date}T${r.time}`);
        const hoursUntil = (reservationDateTime.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursUntil < 3.5 || hoursUntil > 4.5) continue;

        const lines = [
          `Almost time! ⏰`,
          ``,
          `Your reservation at *${rest?.name}* is in about ${Math.round(hoursUntil)} hours.`,
          `🕐 ${r.time} today`,
          `👥 ${r.party_size} guest${r.party_size > 1 ? 's' : ''}`,
        ];

        if (rest?.latitude && rest?.longitude) {
          const mapsUrl = `https://www.google.com/maps?q=${rest.latitude},${rest.longitude}`;
          lines.push(``, `📍 ${rest.address || 'Get directions'}`, mapsUrl);
        }

        lines.push(``, `Safe travels! See you soon 🚗`);

        await this.gupshupService.sendText({
          to: profile.phone,
          text: lines.join('\n'),
        });

        await supabase
          .from('reservations')
          .update({ reminder_2h_sent: true })
          .eq('id', r.id);

        this.logger.log(`4h reminder sent for reservation ${r.id}`);
      }
    } catch (error) {
      this.logger.error('4h reminder error:', (error as Error).message);
    }
  }

  // ── Menu 2h Before (Feature 6) ────────────────────────

  private async sendMenuBeforeDining(): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, date, time, user_id, restaurant_id, restaurants (name, menu_url), profiles:user_id (phone)')
        .in('status', ['confirmed'])
        .eq('date', today);

      if (!reservations || reservations.length === 0) return;

      for (const r of reservations) {
        const rest = r.restaurants as unknown as { name: string; menu_url: string } | null;
        const profile = r.profiles as unknown as { phone: string } | null;

        if (!profile?.phone || !rest?.menu_url) continue;

        // Check exact time is within 1.5-2.5h window
        const reservationDateTime = new Date(`${r.date}T${r.time}`);
        const hoursUntil = (reservationDateTime.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursUntil < 1.5 || hoursUntil > 2.5) continue;

        // Check if we already sent menu for this reservation (via notifications table)
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'menu_preview')
          .eq('metadata->>reservation_id', r.id)
          .single();

        if (existingNotif) continue;

        const menuUrl = rest.menu_url;
        const isPdf = menuUrl.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          await this.gupshupService.sendDocument({
            to: profile.phone,
            documentUrl: menuUrl,
            filename: `${rest.name} Menu.pdf`,
            caption: `📖 Here's the menu for *${rest.name}* — browse before you arrive!`,
          });
        } else {
          await this.gupshupService.sendText({
            to: profile.phone,
            text: `📖 Here's the menu for *${rest.name}* — browse before you arrive!\n\n${menuUrl}`,
          });
        }

        // Track that we sent the menu
        await supabase.from('notifications').insert({
          user_id: r.user_id,
          type: 'menu_preview',
          channel: 'whatsapp',
          title: `Menu for ${rest.name}`,
          body: `Menu sent 2h before dining`,
          metadata: { reservation_id: r.id, restaurant_id: r.restaurant_id },
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });

        this.logger.log(`Menu sent for reservation ${r.id} at ${rest.name}`);
      }
    } catch (error) {
      this.logger.error('Menu send error:', (error as Error).message);
    }
  }

  // ── Review Request (Feature 4) ────────────────────────

  private async sendReviewRequests(): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Find completed reservations 2-48h ago that haven't been asked for feedback
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, date, time, user_id, restaurant_id, restaurants (name), profiles:user_id (first_name, phone)')
        .eq('status', 'completed')
        .eq('feedback_requested', false)
        .gte('date', fortyEightHoursAgo.toISOString().split('T')[0])
        .lte('date', twoHoursAgo.toISOString().split('T')[0]);

      if (!reservations || reservations.length === 0) return;

      for (const r of reservations) {
        const rest = r.restaurants as unknown as { name: string } | null;
        const profile = r.profiles as unknown as { first_name: string; phone: string } | null;

        if (!profile?.phone) continue;

        // More precise time check
        const reservationDateTime = new Date(`${r.date}T${r.time}`);
        const hoursSince = (now.getTime() - reservationDateTime.getTime()) / (60 * 60 * 1000);
        if (hoursSince < 2 || hoursSince > 48) continue;

        // Skip if review already exists
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('reservation_id', r.id)
          .single();

        if (existingReview) {
          await supabase.from('reservations').update({ feedback_requested: true }).eq('id', r.id);
          continue;
        }

        await this.gupshupService.sendText({
          to: profile.phone,
          text: `Hi ${profile.first_name || 'there'}! 🍽️\n\nHow was your meal at *${rest?.name}*?\n\nTap a rating below or type a number 1-5:`,
        });

        await this.gupshupService.sendButtons({
          to: profile.phone,
          body: 'Rate your experience:',
          buttons: [
            { id: `rate_${r.id}_5`, title: '⭐⭐⭐⭐⭐' },
            { id: `rate_${r.id}_3`, title: '⭐⭐⭐' },
            { id: `rate_${r.id}_1`, title: '⭐' },
          ],
        });

        await supabase
          .from('reservations')
          .update({ feedback_requested: true })
          .eq('id', r.id);

        this.logger.log(`Review request sent for reservation ${r.id}`);
      }
    } catch (error) {
      this.logger.error('Review request error:', (error as Error).message);
    }
  }
}
