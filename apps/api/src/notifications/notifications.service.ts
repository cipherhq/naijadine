import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { GupshupService } from './channels/gupshup.service';
import { ResendEmailService } from './channels/resend.service';
import { TermiiSmsService } from './channels/termii.service';
import { FirebasePushService } from './channels/firebase.service';
import {
  bookingConfirmationEmail,
  reminder24hEmail,
  welcomeEmail,
  paymentReceiptEmail,
  cancellationEmail,
  refundEmail,
  noShowWarningEmail,
  restaurantApprovedEmail,
  payoutEmail,
  type BookingEmailData,
  type PaymentEmailData,
} from './templates/email-templates';

type NotificationType =
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'post_dining'
  | 'deal'
  | 'broadcast'
  | 'system'
  | 'payment'
  | 'payout'
  | 'welcome'
  | 'no_show_warning'
  | 'account_suspended'
  | 'review_request'
  | 'loyalty_upgrade'
  | 'referral_reward';

type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';

interface NotificationPrefs {
  whatsapp?: boolean;
  sms?: boolean;
  email?: boolean;
  push?: boolean;
}

interface DispatchOptions {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  emailHtml?: string;
  emailSubject?: string;
  whatsappTemplateId?: string;
  whatsappParams?: string[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly gupshupService: GupshupService,
    private readonly resendService: ResendEmailService,
    private readonly termiiService: TermiiSmsService,
    private readonly firebaseService: FirebasePushService,
  ) {}

  async dispatch(options: DispatchOptions): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get user profile with notification preferences and contact info
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, notification_prefs, fcm_token')
      .eq('id', options.userId)
      .single();

    if (!profile) {
      this.logger.warn(`User ${options.userId} not found for notification`);
      return;
    }

    const prefs = (profile.notification_prefs || {}) as NotificationPrefs;

    for (const channel of options.channels) {
      // Skip if user opted out (in_app always delivered)
      if (channel !== 'in_app' && prefs[channel] === false) {
        this.logger.log(`Skipping ${channel} for user ${options.userId} (opted out)`);
        continue;
      }

      // Create notification record
      const { data: notification } = await supabase
        .from('notifications')
        .insert({
          user_id: options.userId,
          type: options.type,
          channel,
          title: options.title,
          body: options.body,
          metadata: options.metadata || {},
          status: channel === 'in_app' ? 'delivered' : 'queued',
          delivered_at: channel === 'in_app' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (!notification) continue;

      // Dispatch to channel
      if (channel === 'in_app') {
        // Already inserted — Supabase Realtime will handle delivery
        continue;
      }

      let result: { success: boolean; messageId?: string } = { success: false };

      try {
        switch (channel) {
          case 'whatsapp':
            if (profile.phone) {
              if (options.whatsappTemplateId) {
                result = await this.gupshupService.sendTemplate({
                  to: profile.phone as string,
                  templateId: options.whatsappTemplateId,
                  templateParams: options.whatsappParams,
                });
              } else {
                result = await this.gupshupService.sendText({
                  to: profile.phone as string,
                  text: options.body,
                });
              }
            }
            break;

          case 'email':
            if (profile.email) {
              result = await this.resendService.send({
                to: profile.email as string,
                subject: options.emailSubject || options.title,
                html: options.emailHtml || `<p>${options.body}</p>`,
              });
            }
            break;

          case 'sms':
            if (profile.phone) {
              result = await this.termiiService.send({
                to: profile.phone as string,
                text: options.body,
              });
            }
            break;

          case 'push':
            if (profile.fcm_token) {
              result = await this.firebaseService.send({
                token: profile.fcm_token as string,
                title: options.title,
                body: options.body,
                data: { type: options.type, ...(options.metadata ? { id: String(options.metadata.id || '') } : {}) },
              });
            }
            break;
        }

        // Update notification record
        await supabase
          .from('notifications')
          .update({
            status: result.success ? 'sent' : 'failed',
            gateway_message_id: result.messageId || null,
            sent_at: result.success ? new Date().toISOString() : null,
            failure_reason: result.success ? null : 'Channel delivery failed',
          })
          .eq('id', notification.id);
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, error);
        await supabase
          .from('notifications')
          .update({
            status: 'failed',
            failure_reason: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', notification.id);
      }
    }
  }

  // ── Convenience methods for common notification events ──

  async sendBookingConfirmation(reservationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name, address, neighborhood, city), profiles:user_id (full_name, email, phone)')
      .eq('id', reservationId)
      .single();

    if (!reservation) return;

    const restaurant = reservation.restaurants as { name: string; address: string; neighborhood: string; city: string } | null;
    const userProfile = reservation.profiles as { full_name: string; email: string; phone: string } | null;
    const guestName = userProfile?.full_name || 'Guest';

    const bookingDate = new Date(reservation.date + 'T00:00').toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const emailData: BookingEmailData = {
      guestName,
      restaurantName: restaurant?.name || 'Restaurant',
      date: bookingDate,
      time: reservation.time,
      partySize: reservation.party_size,
      referenceCode: reservation.reference_code,
      depositAmount: reservation.deposit_amount > 0 ? reservation.deposit_amount : undefined,
      address: restaurant ? `${restaurant.address}, ${restaurant.neighborhood}` : undefined,
    };

    const email = bookingConfirmationEmail(emailData);

    await this.dispatch({
      userId: reservation.user_id,
      type: 'booking_confirmation',
      channels: ['whatsapp', 'email', 'push', 'in_app'],
      title: 'Booking Confirmed',
      body: `Your reservation at ${restaurant?.name} on ${bookingDate} at ${reservation.time} for ${reservation.party_size} guests is confirmed. Ref: ${reservation.reference_code}`,
      emailHtml: email.html,
      emailSubject: email.subject,
      whatsappTemplateId: 'booking_confirmation',
      whatsappParams: [guestName, restaurant?.name || '', bookingDate, reservation.time, String(reservation.party_size), reservation.reference_code],
      metadata: { reservation_id: reservationId, reference_code: reservation.reference_code },
    });
  }

  async sendReminder24h(reservationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name, address, neighborhood, city), profiles:user_id (full_name)')
      .eq('id', reservationId)
      .single();

    if (!reservation) return;

    const restaurant = reservation.restaurants as { name: string; address: string; neighborhood: string; city: string } | null;
    const userProfile = reservation.profiles as { full_name: string } | null;
    const guestName = userProfile?.full_name || 'Guest';

    const bookingDate = new Date(reservation.date + 'T00:00').toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    const emailData: BookingEmailData = {
      guestName,
      restaurantName: restaurant?.name || 'Restaurant',
      date: bookingDate,
      time: reservation.time,
      partySize: reservation.party_size,
      referenceCode: reservation.reference_code,
      address: restaurant ? `${restaurant.address}, ${restaurant.neighborhood}` : undefined,
    };

    const email = reminder24hEmail(emailData);

    await this.dispatch({
      userId: reservation.user_id,
      type: 'reminder_24h',
      channels: ['whatsapp', 'email', 'push', 'in_app'],
      title: 'Reminder: Dining Tomorrow',
      body: `Don't forget — ${restaurant?.name} tomorrow at ${reservation.time}. Ref: ${reservation.reference_code}`,
      emailHtml: email.html,
      emailSubject: email.subject,
      whatsappTemplateId: 'reminder_24h',
      whatsappParams: [guestName, restaurant?.name || '', bookingDate, reservation.time],
      metadata: { reservation_id: reservationId },
    });
  }

  async sendReminder2h(reservationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name, address, neighborhood, city, google_maps_url)')
      .eq('id', reservationId)
      .single();

    if (!reservation) return;

    const restaurant = reservation.restaurants as { name: string; address: string; neighborhood: string; city: string; google_maps_url?: string } | null;
    const address = restaurant ? `${restaurant.address}, ${restaurant.neighborhood}` : '';

    await this.dispatch({
      userId: reservation.user_id,
      type: 'reminder_2h',
      channels: ['whatsapp', 'push', 'in_app'],
      title: 'See you soon!',
      body: `Your reservation at ${restaurant?.name} is in 2 hours at ${reservation.time}. ${address}`,
      whatsappTemplateId: 'reminder_2h',
      whatsappParams: [restaurant?.name || '', reservation.time, address],
      metadata: { reservation_id: reservationId },
    });
  }

  async sendPaymentReceipt(paymentId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: payment } = await supabase
      .from('payments')
      .select('*, reservations (reference_code, date, restaurants (name)), profiles:user_id (full_name)')
      .eq('id', paymentId)
      .single();

    if (!payment) return;

    const reservation = payment.reservations as { reference_code: string; date: string; restaurants: { name: string } | null } | null;
    const userProfile = payment.profiles as { full_name: string } | null;
    const guestName = userProfile?.full_name || 'Guest';

    const bookingDate = reservation?.date
      ? new Date(reservation.date + 'T00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const emailData: PaymentEmailData = {
      guestName,
      restaurantName: reservation?.restaurants?.name || 'Restaurant',
      amount: payment.amount,
      referenceCode: reservation?.reference_code || '',
      date: bookingDate,
    };

    const email = paymentReceiptEmail(emailData);

    await this.dispatch({
      userId: payment.user_id,
      type: 'payment',
      channels: ['email', 'push', 'in_app'],
      title: 'Payment Received',
      body: `Your deposit of ₦${payment.amount.toLocaleString()} for ${reservation?.restaurants?.name} has been received.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      metadata: { payment_id: paymentId },
    });
  }

  async sendCancellationNotice(reservationId: string, cancelledBy: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, restaurants (name), profiles:user_id (full_name)')
      .eq('id', reservationId)
      .single();

    if (!reservation) return;

    const restaurant = reservation.restaurants as { name: string } | null;
    const userProfile = reservation.profiles as { full_name: string } | null;

    const bookingDate = new Date(reservation.date + 'T00:00').toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    const email = cancellationEmail({
      guestName: userProfile?.full_name || 'Guest',
      restaurantName: restaurant?.name || 'Restaurant',
      date: bookingDate,
      time: reservation.time,
      partySize: reservation.party_size,
      referenceCode: reservation.reference_code,
      depositAmount: reservation.deposit_amount > 0 ? reservation.deposit_amount : undefined,
      cancelledBy,
    });

    await this.dispatch({
      userId: reservation.user_id,
      type: 'booking_confirmation',
      channels: ['whatsapp', 'email', 'push', 'in_app'],
      title: 'Booking Cancelled',
      body: `Your reservation at ${restaurant?.name} on ${bookingDate} has been cancelled.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      metadata: { reservation_id: reservationId, cancelled_by: cancelledBy },
    });
  }

  async sendNoShowWarning(userId: string, restaurantName: string, strikeCount: number, maxStrikes: number): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const email = noShowWarningEmail({
      guestName: profile?.full_name || 'Guest',
      restaurantName,
      strikeCount,
      maxStrikes,
    });

    await this.dispatch({
      userId,
      type: 'no_show_warning',
      channels: ['whatsapp', 'email', 'push', 'in_app'],
      title: 'No-Show Warning',
      body: `You were marked as a no-show at ${restaurantName}. Strike ${strikeCount} of ${maxStrikes}.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      metadata: { strike_count: strikeCount, max_strikes: maxStrikes },
    });
  }

  async sendWelcome(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const name = profile?.full_name || 'there';
    const email = welcomeEmail(name);

    await this.dispatch({
      userId,
      type: 'welcome',
      channels: ['whatsapp', 'email', 'in_app'],
      title: 'Welcome to NaijaDine!',
      body: `Hi ${name}! Welcome to NaijaDine. Discover the best dining experiences across Nigeria.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      whatsappTemplateId: 'welcome',
      whatsappParams: [name],
    });
  }

  async sendRefundNotice(refundId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: refundRecord } = await supabase
      .from('refunds')
      .select('*, payments (reservations (reference_code, restaurants (name))), profiles:user_id (full_name)')
      .eq('id', refundId)
      .single();

    if (!refundRecord) return;

    const payments = refundRecord.payments as { reservations: { reference_code: string; restaurants: { name: string } | null } | null } | null;
    const userProfile = refundRecord.profiles as { full_name: string } | null;

    const email = refundEmail({
      guestName: userProfile?.full_name || 'Guest',
      amount: refundRecord.amount,
      restaurantName: payments?.reservations?.restaurants?.name || 'Restaurant',
      referenceCode: payments?.reservations?.reference_code || '',
    });

    await this.dispatch({
      userId: refundRecord.user_id,
      type: 'payment',
      channels: ['email', 'push', 'in_app'],
      title: 'Refund Processed',
      body: `Your refund of ₦${refundRecord.amount.toLocaleString()} has been processed.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      metadata: { refund_id: refundId },
    });
  }

  async sendRestaurantApproved(userId: string, restaurantName: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const email = restaurantApprovedEmail({
      ownerName: profile?.full_name || 'Owner',
      restaurantName,
    });

    await this.dispatch({
      userId,
      type: 'system',
      channels: ['whatsapp', 'email'],
      title: 'Restaurant Approved!',
      body: `Congratulations! ${restaurantName} is now live on NaijaDine.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      whatsappTemplateId: 'restaurant_approved',
      whatsappParams: [profile?.full_name || 'Owner', restaurantName],
    });
  }

  async sendPayoutNotice(userId: string, amount: number, restaurantName: string, period: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const email = payoutEmail({
      ownerName: profile?.full_name || 'Owner',
      amount,
      restaurantName,
      period,
    });

    await this.dispatch({
      userId,
      type: 'payout',
      channels: ['whatsapp', 'email', 'in_app'],
      title: 'Payout Processed',
      body: `Your payout of ₦${amount.toLocaleString()} for ${restaurantName} has been sent.`,
      emailHtml: email.html,
      emailSubject: email.subject,
      whatsappTemplateId: 'payout_processed',
      whatsappParams: [profile?.full_name || 'Owner', `₦${amount.toLocaleString()}`, restaurantName],
    });
  }

  // ── Notification queries ─────────────────────────────────

  async getUserNotifications(userId: string, limit = 20, offset = 0) {
    const supabase = this.supabaseService.getClient();
    const { data, count } = await supabase
      .from('notifications')
      .select('id, type, channel, title, body, metadata, status, read_at, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { notifications: data || [], total: count || 0 };
  }

  async markAsRead(notificationId: string, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();
    return data;
  }

  async markAllAsRead(userId: string) {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .is('read_at', null);
    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .is('read_at', null);
    return count || 0;
  }

  async updatePreferences(userId: string, prefs: Partial<NotificationPrefs>) {
    const supabase = this.supabaseService.getClient();

    // Merge with existing preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .single();

    const existing = (profile?.notification_prefs || {}) as NotificationPrefs;
    const merged = { ...existing, ...prefs };

    await supabase
      .from('profiles')
      .update({ notification_prefs: merged })
      .eq('id', userId);

    return merged;
  }
}
