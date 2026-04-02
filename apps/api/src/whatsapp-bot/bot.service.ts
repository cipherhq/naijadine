import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import { GupshupService } from '../notifications/channels/gupshup.service';
import { ResendEmailService } from '../notifications/channels/resend.service';
import { StandaloneService } from './standalone.service';
import { BotIntelligenceService, BusinessCategory, AbuseResult } from './bot-intelligence.service';
import { CITIES, CUISINE_TYPES, BOOKING_DEFAULTS, ORDER_DEFAULTS, generateTimeSlots, formatNaira } from '@naijadine/shared';
import { randomUUID } from 'crypto';

type BotStep =
  | 'greeting'
  | 'quick_rebook'
  | 'city_selection'
  | 'neighborhood_selection'
  | 'restaurant_selection'
  | 'service_selection'
  | 'date_selection'
  | 'time_selection'
  | 'party_size'
  | 'confirmation'
  | 'special_requests'
  | 'book_for_other'
  | 'collect_other_name'
  | 'collect_other_phone'
  | 'collect_name'
  | 'collect_email'
  | 'payment'
  | 'my_bookings'
  | 'modify_booking'
  | 'review_text'
  | 'complete'
  // Food ordering steps
  | 'order_city_selection'
  | 'order_restaurant_selection'
  | 'order_menu_categories'
  | 'order_menu_items'
  | 'order_item_quantity'
  | 'order_add_more'
  | 'order_cart_review'
  | 'order_type_selection'
  | 'order_delivery_address'
  | 'order_special_instructions'
  | 'order_confirm'
  | 'order_collect_name'
  | 'order_collect_email'
  | 'order_payment'
  | 'order_complete';

interface SessionData {
  city?: string;
  neighborhood?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  restaurant_slug?: string;
  business_category?: BusinessCategory;
  date?: string;
  time?: string;
  party_size?: number;
  reservation_id?: string;
  reference_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  deposit_amount?: number;
  payment_reference?: string;
  selected_service_name?: string;
  selected_service_price?: number;
  last_party_size?: number;
  is_quick_rebook?: boolean;
  special_requests?: string;
  book_for_other?: boolean;
  other_name?: string;
  other_phone?: string;
  selected_booking_id?: string;
  review_reservation_id?: string;
  review_restaurant_name?: string;
  review_rating?: number;
  // Food ordering fields
  order_flow?: boolean;
  order_restaurant_id?: string;
  order_restaurant_name?: string;
  order_delivery_fee?: number | null;
  order_selected_category_id?: string;
  order_selected_category_name?: string;
  order_selected_item_id?: string;
  order_selected_item_name?: string;
  order_selected_item_price?: number;
  cart?: Array<{ item_id: string; name: string; price: number; quantity: number }>;
  order_type?: 'pickup' | 'delivery';
  delivery_address?: string;
  order_special_instructions?: string;
  order_id?: string;
  order_reference_code?: string;
  order_subtotal?: number;
  order_total?: number;
  order_payment_reference?: string;
}

interface BotSession {
  id: string;
  whatsapp_number: string;
  user_id: string | null;
  restaurant_id: string | null;
  current_step: string;
  session_data: SessionData;
  is_active: boolean;
  expires_at: string;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  private readonly paystackSecretKey: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly gupshupService: GupshupService,
    private readonly resendService: ResendEmailService,
    private readonly standaloneService: StandaloneService,
    private readonly configService: ConfigService,
    private readonly intelligence: BotIntelligenceService,
  ) {
    this.paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
  }

  async handleMessage(
    from: string,
    messageText: string,
    messageType: string,
    destinationPhone?: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const text = messageText.trim();

    // Detect review rating callback (rate_{reservationId}_{rating})
    const rateMatch = /^rate_([a-f0-9-]+)_(\d)$/i.exec(text);
    if (rateMatch) {
      await this.handleReviewRating(from, rateMatch[1], parseInt(rateMatch[2], 10));
      return;
    }

    // Pre-check 1: Timeout — if user is in cooldown, send remaining time message
    const timeoutCheck = this.intelligence.isTimedOut(from);
    if (timeoutCheck.timedOut) {
      await this.sendText(from, `You can message again in ${timeoutCheck.remaining} minute${timeoutCheck.remaining !== 1 ? 's' : ''}. 🙏`);
      return;
    }

    // Pre-check 2: Profanity — record strike, optionally block
    if (this.intelligence.containsProfanity(text)) {
      // Resolve category from existing session for category-aware response
      const existingSession = await this.getActiveSession(from);
      const category = existingSession ? this.getSessionCategory(existingSession) : 'restaurant';
      const abuse = this.intelligence.recordProfanity(from, category);
      if (abuse.timeout && existingSession) {
        await this.deactivateSession(existingSession.id);
      }
      await this.sendText(from, abuse.message);
      return;
    }

    // Detect "my bookings" / "bookings" / "reservations" keywords (even with active session)
    const isBookingsQuery = /^(my bookings|bookings|reservations|my reservations)$/i.test(text);

    // Find or create session
    let session = await this.getActiveSession(from);

    if (isBookingsQuery) {
      // Deactivate current session if any, start bookings flow
      if (session) {
        await supabase.from('bot_sessions').update({ is_active: false }).eq('id', session.id);
      }
      const phone = from.startsWith('+') ? from : `+${from}`;
      const { data: profile } = await supabase.from('profiles').select('id').eq('phone', phone).single();
      if (!profile?.id) {
        await this.sendText(from, "I don't have an account for this number yet. Send *Hi* to make your first booking!");
        return;
      }
      const { data: newSession } = await supabase.from('bot_sessions').insert({
        whatsapp_number: from, user_id: profile.id, restaurant_id: null,
        current_step: 'my_bookings', session_data: {}, is_active: true,
      }).select().single();
      if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
      session = newSession as BotSession;
      await this.handleMyBookings(session, from, '');
      return;
    }

    // Check for order entry keywords (before restart check)
    const isOrderQuery = /^(order|order food|place an order|i want to order|buy food|get food)$/i.test(text);
    const isAlreadyOrdering = session?.current_step?.startsWith('order_') || false;
    if (isOrderQuery && !isAlreadyOrdering) {
      // Deactivate existing session if any
      if (session) {
        await supabase.from('bot_sessions').update({ is_active: false }).eq('id', session.id);
      }
      const phone = from.startsWith('+') ? from : `+${from}`;
      const { data: profile } = await supabase.from('profiles').select('id').eq('phone', phone).single();

      const orderSessionData: SessionData = { order_flow: true, cart: [] };
      const standaloneRestaurantId = session?.restaurant_id || null;

      // Standalone bot — skip city/restaurant selection
      if (standaloneRestaurantId) {
        const { data: rest } = await supabase
          .from('restaurants')
          .select('name, delivery_fee')
          .eq('id', standaloneRestaurantId)
          .single();
        orderSessionData.order_restaurant_id = standaloneRestaurantId;
        orderSessionData.order_restaurant_name = rest?.name || 'Restaurant';
        orderSessionData.order_delivery_fee = rest?.delivery_fee ?? null;

        const { data: newSession } = await supabase.from('bot_sessions').insert({
          whatsapp_number: from, user_id: profile?.id || null,
          restaurant_id: standaloneRestaurantId,
          current_step: 'order_menu_categories', session_data: orderSessionData, is_active: true,
        }).select().single();
        if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
        await this.sendText(from, `🍽️ Let's get your order started at *${orderSessionData.order_restaurant_name}*!`);
        await this.handleOrderMenuCategories(newSession as BotSession, from, '');
        return;
      }

      // Marketplace — start at city selection for order
      const { data: newSession } = await supabase.from('bot_sessions').insert({
        whatsapp_number: from, user_id: profile?.id || null,
        restaurant_id: null,
        current_step: 'order_city_selection', session_data: orderSessionData, is_active: true,
      }).select().single();
      if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
      await this.sendText(from, '🍽️ Let\'s order some food! First, pick your city:');
      await this.handleOrderCitySelection(newSession as BotSession, from, '');
      return;
    }

    // Check for bot_code mid-session — if user types a bot code while in another flow, switch
    if (session) {
      const botCodeRestaurantId = await this.lookupBotCode(text);
      if (botCodeRestaurantId && botCodeRestaurantId !== session.restaurant_id) {
        await supabase.from('bot_sessions').update({ is_active: false }).eq('id', session.id);
        session = null; // Fall through to new session creation which will pick up the code
      }
    }

    // Check for restart keywords (fixed: use word boundary to avoid matching "history", "help" etc.)
    // Skip restart detection on free-text steps so "Hi" can be typed as a name
    const currentStep = session?.current_step || '';
    const isFreeTextStep = ['collect_name', 'collect_other_name', 'collect_email', 'special_requests', 'review_text',
      'order_delivery_address', 'order_collect_name', 'order_collect_email', 'order_special_instructions'].includes(currentStep);
    const sessionCategory = session ? this.getSessionCategory(session) : 'restaurant';
    const isRestart = !isFreeTextStep && (
      /^(start|restart)$/i.test(text) ||
      (this.intelligence.detectIntent(text, 'greeting', sessionCategory)?.intent === 'greeting')
    );

    if (!session || isRestart) {
      // Deactivate old session if restarting
      if (session) {
        await supabase
          .from('bot_sessions')
          .update({ is_active: false })
          .eq('id', session.id);
      }

      // Determine if this is a standalone restaurant bot
      let restaurantId: string | null = null;
      if (destinationPhone) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('whatsapp_phone_number_id', destinationPhone)
          .single();
        restaurantId = restaurant?.id || null;
      }

      // Keyword routing: check if message contains a restaurant bot_code
      if (!restaurantId) {
        restaurantId = await this.lookupBotCode(text);
      }

      // Link to existing user by phone
      const phone = from.startsWith('+') ? from : `+${from}`;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .single();

      // Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from('bot_sessions')
        .insert({
          whatsapp_number: from,
          user_id: profile?.id || null,
          restaurant_id: restaurantId,
          current_step: restaurantId ? 'pending_category_route' : 'greeting',
          session_data: restaurantId ? { restaurant_id: restaurantId } : {},
          is_active: true,
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        this.logger.error('Failed to create bot session', { error: sessionError, from, restaurantId });
        await this.sendText(from, 'Sorry, something went wrong. Please try again.');
        return;
      }

      session = newSession as BotSession;

      if (restaurantId) {
        // Standalone bot — load restaurant name, category, and route by business type
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, slug, business_category, delivery_fee')
          .eq('id', restaurantId)
          .single();

        const category = (restaurant?.business_category as BusinessCategory) || 'restaurant';

        if (restaurant) {
          session.session_data.restaurant_name = restaurant.name;
          session.session_data.restaurant_slug = restaurant.slug;
          session.session_data.business_category = category;
        }

        // Determine entry step based on category
        const PURCHASE_CATEGORIES = ['church', 'cinema', 'events', 'shop', 'beauty', 'laundry', 'catering', 'tailor', 'printing', 'logistics', 'bakery'];
        const SERVICE_CATEGORIES = ['spa', 'gym', 'barber', 'salon', 'car_wash', 'mechanic', 'hotel', 'clinic', 'tutor', 'photography', 'cleaning', 'coworking'];

        let entryStep: string;
        if (PURCHASE_CATEGORIES.includes(category)) {
          entryStep = 'order_menu_categories';
          // Set up order flow session data for purchase categories
          session.session_data.order_flow = true;
          session.session_data.cart = [];
          session.session_data.order_restaurant_id = restaurantId;
          session.session_data.order_restaurant_name = restaurant?.name || 'Business';
          session.session_data.order_delivery_fee = restaurant?.delivery_fee ?? null;
        } else if (SERVICE_CATEGORIES.includes(category)) {
          entryStep = 'service_selection';
        } else {
          entryStep = 'date_selection'; // restaurant, other
        }

        await supabase
          .from('bot_sessions')
          .update({ current_step: entryStep, session_data: session.session_data })
          .eq('id', session.id);

        // Use custom greeting template (white-label support) with optional alias persona
        const templates = await this.standaloneService.getBotTemplates(restaurantId);
        const tierInfo = await this.standaloneService.checkTierLimits(restaurantId);
        const botAlias = await this.standaloneService.getBotAlias(restaurantId);

        let greeting: string;
        if (botAlias) {
          greeting = this.intelligence.getPersonaGreeting(botAlias, restaurant?.name || 'our restaurant', category);
        } else {
          greeting = this.standaloneService.fillTemplate(templates.greeting, {
            restaurant_name: restaurant?.name || 'our restaurant',
          });
        }

        // Add NaijaDine branding for non-whitelabel (Starter plan)
        if (!tierInfo.isWhitelabel) {
          greeting += '\n\n_Powered by NaijaDine_';
        }

        // Check tier limits before proceeding
        if (!tierInfo.allowed) {
          await this.sendText(from, `Thank you for contacting ${restaurant?.name || 'us'}! We're currently unable to accept new WhatsApp bookings. Please call us directly to reserve a table.`);
          await this.deactivateSession(session.id);
          return;
        }

        await this.sendText(from, greeting);

        // Route to the correct handler based on category
        if (entryStep === 'order_menu_categories') {
          await this.handleOrderMenuCategories(session, from, '');
        } else if (entryStep === 'service_selection') {
          await this.handleServiceSelection(session, from, '');
        } else {
          await this.handleDateSelection(session, from, '');
        }
        return;
      }

      // Marketplace greeting — personalize for returning users
      const phoneForLookup = from.startsWith('+') ? from : `+${from}`;
      const { data: returningProfile } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('phone', phoneForLookup)
        .single();

      if (returningProfile?.first_name && returningProfile.id) {
        // Returning user — check past reservations for quick rebook
        const { data: pastBookings } = await supabase
          .from('reservations')
          .select('restaurant_id, party_size, restaurants (name, slug, city, neighborhood)')
          .eq('user_id', returningProfile.id)
          .in('status', ['confirmed', 'completed', 'seated'])
          .order('created_at', { ascending: false })
          .limit(5);

        // Deduplicate by restaurant
        const seenRestaurants = new Set<string>();
        const uniqueBookings = (pastBookings || []).filter((b: Record<string, unknown>) => {
          const rid = b.restaurant_id as string;
          if (seenRestaurants.has(rid)) return false;
          seenRestaurants.add(rid);
          return true;
        }).slice(0, 3);

        if (uniqueBookings.length > 0) {
          await this.sendText(from, `Welcome back, ${returningProfile.first_name}! 🍽️\n\nGreat to see you again!`);

          // Store past bookings in session for quick rebook
          const quickOptions = uniqueBookings.map((b: Record<string, unknown>) => {
            const r = b.restaurants as { name: string; slug: string; city: string; neighborhood: string } | null;
            return {
              title: r?.name || 'Restaurant',
              description: `${r?.neighborhood || ''}, ${(r?.city || '').charAt(0).toUpperCase() + (r?.city || '').slice(1)}`,
              postbackText: `quick_${r?.slug || b.restaurant_id}`,
            };
          });

          // Save the most recent party size for prefill
          session.session_data.last_party_size = (uniqueBookings[0] as Record<string, unknown>).party_size as number;
          await this.updateSession(session.id, 'quick_rebook', session.session_data);

          quickOptions.push({
            title: '🔍 Browse New',
            description: 'Explore other restaurants',
            postbackText: 'browse_new',
          });

          await this.gupshupService.sendList({
            to: from,
            title: 'Quick Rebook',
            body: `Rebook a favourite or browse new restaurants:`,
            buttonLabel: 'Choose',
            items: quickOptions,
          });
          return;
        }

        // Returning user but no past bookings
        await this.sendText(from, `Welcome back, ${returningProfile.first_name}! 🍽️\n\nLet's find you a table!`);
        await this.handleCitySelection(session, from, '');
        return;
      }

      // New user
      await this.sendText(from, `Welcome to NaijaDine! 🍽️\n\nDiscover and book the best restaurants in Nigeria.\n\nLet's find you a table!`);
      await this.handleCitySelection(session, from, '');
      return;
    }

    // Check session expiry
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('bot_sessions')
        .update({ is_active: false })
        .eq('id', session.id);
      await this.sendText(from, 'Your session has expired. Send "Hi" to start again.');
      return;
    }

    // Intent detection — catch free-text commands before the step switch
    const step = session.current_step as BotStep;
    const category = this.getSessionCategory(session);
    const detectedIntent = this.intelligence.detectIntent(text, step, category);

    if (detectedIntent) {
      this.intelligence.resetAbuse(from);

      // Note: 'restart' (greeting) intent is already caught by isRestart above,
      // so it won't reach here. No need to handle it in this block.

      if (detectedIntent.action === 'bookings') {
        await supabase.from('bot_sessions').update({ is_active: false }).eq('id', session.id);
        const phone = from.startsWith('+') ? from : `+${from}`;
        const { data: profile } = await supabase.from('profiles').select('id').eq('phone', phone).single();
        if (!profile?.id) {
          await this.sendText(from, "I don't have an account for this number yet. Send *Hi* to make your first booking!");
          return;
        }
        const { data: newSession } = await supabase.from('bot_sessions').insert({
          whatsapp_number: from, user_id: profile.id, restaurant_id: null,
          current_step: 'my_bookings', session_data: {}, is_active: true,
        }).select().single();
        if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
        await this.handleMyBookings(newSession as BotSession, from, '');
        return;
      }

      if (detectedIntent.action === 'city_selection') {
        if (detectedIntent.response) await this.sendText(from, detectedIntent.response);
        await this.updateStep(session.id, 'city_selection');
        await this.handleCitySelection(session, from, '');
        return;
      }

      if (detectedIntent.action === 'help') {
        const isStandalone = !!session.restaurant_id;
        const restaurantName = session.session_data.restaurant_name;
        let alias: string | null = null;
        if (isStandalone && session.restaurant_id) {
          alias = await this.standaloneService.getBotAlias(session.restaurant_id);
        }
        await this.sendText(from, this.intelligence.getHelpText(isStandalone, restaurantName, alias || undefined, category));
        // Also remind them where they are
        const helpNudge = this.intelligence.getContextualHelp(step);
        await this.sendText(from, `📍 You're currently at: *${step.replace(/_/g, ' ')}*\n${helpNudge}`);
        return;
      }

      if (detectedIntent.action === 'acknowledge') {
        await this.sendText(from, detectedIntent.response!);
        return;
      }

      if (detectedIntent.action === 'start_order') {
        // Route to food ordering flow
        await supabase.from('bot_sessions').update({ is_active: false }).eq('id', session.id);
        const phone = from.startsWith('+') ? from : `+${from}`;
        const { data: profile } = await supabase.from('profiles').select('id').eq('phone', phone).single();
        const orderSessionData: SessionData = { order_flow: true, cart: [] };

        if (session.restaurant_id) {
          const { data: rest } = await supabase
            .from('restaurants')
            .select('name, delivery_fee')
            .eq('id', session.restaurant_id)
            .single();
          orderSessionData.order_restaurant_id = session.restaurant_id;
          orderSessionData.order_restaurant_name = rest?.name || 'Restaurant';
          orderSessionData.order_delivery_fee = rest?.delivery_fee ?? null;

          const { data: newSession } = await supabase.from('bot_sessions').insert({
            whatsapp_number: from, user_id: profile?.id || null,
            restaurant_id: session.restaurant_id,
            current_step: 'order_menu_categories', session_data: orderSessionData, is_active: true,
          }).select().single();
          if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
          await this.sendText(from, `🍽️ Let's get your order started at *${orderSessionData.order_restaurant_name}*!`);
          await this.handleOrderMenuCategories(newSession as BotSession, from, '');
          return;
        }

        const { data: newSession } = await supabase.from('bot_sessions').insert({
          whatsapp_number: from, user_id: profile?.id || null,
          restaurant_id: null,
          current_step: 'order_city_selection', session_data: orderSessionData, is_active: true,
        }).select().single();
        if (!newSession) { await this.sendText(from, 'Something went wrong. Try again.'); return; }
        await this.sendText(from, '🍽️ Let\'s order some food! First, pick your city:');
        await this.handleOrderCitySelection(newSession as BotSession, from, '');
        return;
      }

      // Info-only intents (menu, pricing, hours, location) — respond + contextual nudge
      if (detectedIntent.action === null && detectedIntent.response) {
        await this.sendText(from, detectedIntent.response);
        const nudge = this.intelligence.getContextualHelp(step);
        await this.sendText(from, nudge);
        return;
      }
    }

    // Route to current state handler
    switch (step) {
      case 'greeting':
        await this.handleCitySelection(session, from, '');
        break;
      case 'quick_rebook':
        await this.handleQuickRebook(session, from, text);
        break;
      case 'city_selection':
        await this.handleCitySelection(session, from, text);
        break;
      case 'neighborhood_selection':
        await this.handleNeighborhoodSelection(session, from, text);
        break;
      case 'restaurant_selection':
        await this.handleRestaurantSelection(session, from, text);
        break;
      case 'service_selection':
        await this.handleServiceSelection(session, from, text);
        break;
      case 'date_selection':
        await this.handleDateSelection(session, from, text);
        break;
      case 'time_selection':
        await this.handleTimeSelection(session, from, text);
        break;
      case 'party_size':
        await this.handlePartySize(session, from, text);
        break;
      case 'confirmation':
        await this.handleConfirmation(session, from, text);
        break;
      case 'special_requests':
        await this.handleSpecialRequests(session, from, text);
        break;
      case 'book_for_other':
        await this.handleBookForOther(session, from, text);
        break;
      case 'collect_other_name':
        await this.handleCollectOtherName(session, from, text);
        break;
      case 'collect_other_phone':
        await this.handleCollectOtherPhone(session, from, text);
        break;
      case 'collect_name':
        await this.handleCollectName(session, from, text);
        break;
      case 'collect_email':
        await this.handleCollectEmail(session, from, text);
        break;
      case 'payment':
        await this.handlePaymentCheck(session, from, text);
        break;
      case 'my_bookings':
        await this.handleMyBookings(session, from, text);
        break;
      case 'modify_booking':
        await this.handleModifyBooking(session, from, text);
        break;
      case 'review_text':
        await this.handleReviewText(session, from, text);
        break;
      // Food ordering steps
      case 'order_city_selection':
        await this.handleOrderCitySelection(session, from, text);
        break;
      case 'order_restaurant_selection':
        await this.handleOrderRestaurantSelection(session, from, text);
        break;
      case 'order_menu_categories':
        await this.handleOrderMenuCategories(session, from, text);
        break;
      case 'order_menu_items':
        await this.handleOrderMenuItems(session, from, text);
        break;
      case 'order_item_quantity':
        await this.handleOrderItemQuantity(session, from, text);
        break;
      case 'order_add_more':
        await this.handleOrderAddMore(session, from, text);
        break;
      case 'order_cart_review':
        await this.handleOrderCartReview(session, from, text);
        break;
      case 'order_type_selection':
        await this.handleOrderTypeSelection(session, from, text);
        break;
      case 'order_delivery_address':
        await this.handleOrderDeliveryAddress(session, from, text);
        break;
      case 'order_special_instructions':
        await this.handleOrderSpecialInstructions(session, from, text);
        break;
      case 'order_confirm':
        await this.handleOrderConfirm(session, from, text);
        break;
      case 'order_collect_name':
        await this.handleOrderCollectName(session, from, text);
        break;
      case 'order_collect_email':
        await this.handleOrderCollectEmail(session, from, text);
        break;
      case 'order_payment':
        await this.handleOrderPaymentCheck(session, from, text);
        break;
      default:
        await this.sendText(from, 'Send "Hi" to start a new booking.');
    }
  }

  // ── State Handlers ──────────────────────────────────────

  private async handleQuickRebook(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) return;

    // User chose "Browse New"
    if (input === 'browse_new') {
      await this.updateStep(session.id, 'city_selection');
      await this.handleCitySelection(session, from, '');
      return;
    }

    // Quick rebook — slug is after "quick_" prefix
    const slug = input.replace('quick_', '');
    const supabase = this.supabaseService.getClient();

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood')
      .eq('slug', slug)
      .single();

    if (!restaurant) {
      await this.sendText(from, "That restaurant isn't available right now. Let's browse others.");
      await this.updateStep(session.id, 'city_selection');
      await this.handleCitySelection(session, from, '');
      return;
    }

    // Pre-fill all choices from past booking
    session.session_data.city = restaurant.city;
    session.session_data.neighborhood = restaurant.neighborhood;
    session.session_data.restaurant_id = restaurant.id;
    session.session_data.restaurant_name = restaurant.name;
    session.session_data.restaurant_slug = restaurant.slug;
    session.session_data.is_quick_rebook = true;

    await this.updateSession(session.id, 'date_selection', session.session_data);

    await this.sendText(from, `Great choice! 🎉 Rebooking *${restaurant.name}*\n📍 ${restaurant.neighborhood}, ${restaurant.city.charAt(0).toUpperCase() + restaurant.city.slice(1)}`);
    await this.handleDateSelection(session, from, '');
  }

  private async handleCitySelection(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      // Show city list
      const cityKeys = Object.keys(CITIES) as Array<keyof typeof CITIES>;
      await this.gupshupService.sendList({
        to: from,
        title: 'Select a City',
        body: 'Where would you like to dine?',
        buttonLabel: 'Choose City',
        items: cityKeys.map((key) => ({
          title: CITIES[key].name,
          postbackText: key,
        })),
      });
      await this.updateStep(session.id, 'city_selection');
      return;
    }

    // Validate city
    const cityKeys = Object.keys(CITIES) as Array<keyof typeof CITIES>;
    const matchedCity = cityKeys.find(
      (key) => key === input.toLowerCase() || CITIES[key].name.toLowerCase() === input.toLowerCase(),
    );

    if (!matchedCity) {
      const cityAbuse = await this.handleValidationFailure(from, 'city_selection', session);
      if (cityAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, cityAbuse.message); return; }
      await this.sendText(from, cityAbuse.warn ? cityAbuse.message : "I didn't catch that. Please tap one of the city options.");
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.city = matchedCity;

    // Feature 9: Skip neighborhood if few restaurants in city
    const supabase = this.supabaseService.getClient();
    const { count: restaurantCount } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('city', matchedCity)
      .in('status', ['active', 'approved']);

    if ((restaurantCount || 0) <= 5) {
      session.session_data.neighborhood = '__all__';
      await this.updateSession(session.id, 'restaurant_selection', session.session_data);
      await this.handleRestaurantSelection(session, from, '');
      return;
    }

    await this.updateSession(session.id, 'neighborhood_selection', session.session_data);
    await this.handleNeighborhoodSelection(session, from, '');
  }

  private async handleNeighborhoodSelection(session: BotSession, from: string, input: string): Promise<void> {
    const cityKey = session.session_data.city as keyof typeof CITIES;
    if (!cityKey || !CITIES[cityKey]) {
      await this.handleCitySelection(session, from, '');
      return;
    }

    const neighborhoods = CITIES[cityKey].neighborhoods;

    if (!input) {
      // Show top neighborhoods (WhatsApp list max 10 items)
      const items = neighborhoods.slice(0, 10).map((n) => ({
        title: n,
        postbackText: n,
      }));

      await this.gupshupService.sendList({
        to: from,
        title: 'Select Area',
        body: `Choose a neighborhood in ${CITIES[cityKey].name}:`,
        buttonLabel: 'Choose Area',
        items,
      });
      return;
    }

    // Validate neighborhood
    const matched = neighborhoods.find((n) => n.toLowerCase() === input.toLowerCase());
    if (!matched) {
      const areaAbuse = await this.handleValidationFailure(from, 'neighborhood_selection', session);
      if (areaAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, areaAbuse.message); return; }
      await this.sendText(from, areaAbuse.warn ? areaAbuse.message : "I didn't catch that. Please tap one of the area options.");
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.neighborhood = matched;
    await this.updateSession(session.id, 'restaurant_selection', session.session_data);
    await this.handleRestaurantSelection(session, from, '');
  }

  private async handleRestaurantSelection(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    if (!input) {
      // Fetch restaurants — skip neighborhood filter if __all__
      let query = supabase
        .from('restaurants')
        .select('id, name, slug, cuisine_types, price_range')
        .eq('city', session.session_data.city!)
        .in('status', ['active', 'approved'])
        .limit(10);

      if (session.session_data.neighborhood !== '__all__') {
        query = query.eq('neighborhood', session.session_data.neighborhood!);
      }

      const { data: restaurants } = await query;

      if (!restaurants || restaurants.length === 0) {
        await this.sendText(from, `No restaurants found in ${session.session_data.neighborhood === '__all__' ? 'this city' : session.session_data.neighborhood}. Let's try another area.`);
        await this.updateStep(session.id, 'neighborhood_selection');
        await this.handleNeighborhoodSelection(session, from, '');
        return;
      }

      const pricingLabel = (tier: string) => {
        switch (tier) {
          case 'fine_dining': return '$$$$';
          case 'upscale': return '$$$';
          case 'moderate': return '$$';
          default: return '$';
        }
      };

      const areaLabel = session.session_data.neighborhood === '__all__'
        ? CITIES[session.session_data.city as keyof typeof CITIES]?.name || 'your city'
        : session.session_data.neighborhood;
      await this.gupshupService.sendList({
        to: from,
        title: 'Select Restaurant',
        body: `Restaurants in ${areaLabel}:`,
        buttonLabel: 'Choose Restaurant',
        items: restaurants.map((r) => ({
          title: r.name,
          description: `${(r.cuisine_types as string[])?.join(', ') || 'Various'} • ${pricingLabel(r.price_range)}`,
          postbackText: r.slug,
        })),
      });
      return;
    }

    // Look up by slug
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, cover_photo_url, business_category')
      .eq('slug', input.toLowerCase().replace(/\s+/g, '-'))
      .single();

    if (!restaurant) {
      // Try matching by name
      const { data: byName } = await supabase
        .from('restaurants')
        .select('id, name, slug, cover_photo_url, business_category')
        .ilike('name', `%${input}%`)
        .eq('city', session.session_data.city!)
        .in('status', ['active', 'approved'])
        .limit(1)
        .single();

      if (!byName) {
        const restAbuse = await this.handleValidationFailure(from, 'restaurant_selection', session);
        if (restAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, restAbuse.message); return; }
        await this.sendText(from, restAbuse.warn ? restAbuse.message : "I didn't catch that. Please tap one of the restaurant options.");
        return;
      }

      session.session_data.restaurant_id = byName.id;
      session.session_data.restaurant_name = byName.name;
      session.session_data.restaurant_slug = byName.slug;
      session.session_data.business_category = (byName.business_category as BusinessCategory) || 'restaurant';

      // Feature 1: Send restaurant photo
      if (byName.cover_photo_url) {
        await this.gupshupService.sendImage({
          to: from,
          imageUrl: byName.cover_photo_url,
          caption: `🍽️ ${byName.name}`,
        });
      }
    } else {
      session.session_data.restaurant_id = restaurant.id;
      session.session_data.restaurant_name = restaurant.name;
      session.session_data.restaurant_slug = restaurant.slug;
      session.session_data.business_category = (restaurant.business_category as BusinessCategory) || 'restaurant';

      // Feature 1: Send restaurant photo
      if (restaurant.cover_photo_url) {
        await this.gupshupService.sendImage({
          to: from,
          imageUrl: restaurant.cover_photo_url,
          caption: `🍽️ ${restaurant.name}`,
        });
      }
    }

    this.intelligence.resetAbuse(from);
    await this.updateSession(session.id, 'date_selection', session.session_data);
    await this.sendText(from, `Great choice! 🎉 ${session.session_data.restaurant_name}`);
    await this.handleDateSelection(session, from, '');
  }

  // ── Service Selection Handler (spa/gym) ─────────────────

  private async handleServiceSelection(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const restaurantId = session.restaurant_id;
    const category = this.getSessionCategory(session);

    if (!restaurantId) {
      await this.sendText(from, 'Something went wrong. Send *Hi* to start again.');
      await this.deactivateSession(session.id);
      return;
    }

    // Service category labels for UI text
    const serviceLabels: Record<string, { browse: string; body: string; selectTitle: string }> = {
      spa: { browse: 'Browse Treatments', body: 'Choose a treatment type:', selectTitle: 'Select Treatment' },
      gym: { browse: 'Browse Classes', body: 'Choose a class type:', selectTitle: 'Select Class' },
      barber: { browse: 'Browse Services', body: 'Choose a service:', selectTitle: 'Select Service' },
      salon: { browse: 'Browse Services', body: 'Choose a service:', selectTitle: 'Select Service' },
      car_wash: { browse: 'Browse Packages', body: 'Choose a wash package:', selectTitle: 'Select Package' },
      mechanic: { browse: 'Browse Services', body: 'What do you need?', selectTitle: 'Select Service' },
      hotel: { browse: 'Browse Rooms', body: 'Choose a room type:', selectTitle: 'Select Room' },
      clinic: { browse: 'Browse Services', body: 'Choose a service:', selectTitle: 'Select Service' },
      tutor: { browse: 'Browse Subjects', body: 'Choose a subject:', selectTitle: 'Select Session' },
      photography: { browse: 'Browse Packages', body: 'Choose a package:', selectTitle: 'Select Package' },
      cleaning: { browse: 'Browse Services', body: 'Choose a cleaning type:', selectTitle: 'Select Service' },
      coworking: { browse: 'Browse Spaces', body: 'Choose a space type:', selectTitle: 'Select Space' },
    };
    const svcLabels = serviceLabels[category] || { browse: 'Browse Services', body: 'Choose a service:', selectTitle: 'Select' };

    // Phase 1: Show service categories or items within a category
    if (!input || input.startsWith('cat_')) {
      if (!input) {
        // Show service categories
        const { data: categories } = await supabase
          .from('menu_categories')
          .select('id, name, description')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .limit(10);

        if (!categories?.length) {
          await this.sendText(from, 'No services available right now. Send *Hi* to try again.');
          await this.deactivateSession(session.id);
          return;
        }

        await this.gupshupService.sendList({
          to: from,
          title: svcLabels.browse,
          body: svcLabels.body,
          buttonLabel: svcLabels.browse,
          items: categories.map(c => ({
            title: c.name,
            description: c.description || '',
            postbackText: `cat_${c.id}`,
          })),
        });
        return;
      }

      // Category selected — show items in that category
      const categoryId = input.replace('cat_', '');
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, description, price')
        .eq('category_id', categoryId)
        .eq('is_available', true)
        .order('sort_order', { ascending: true })
        .limit(10);

      if (!items?.length) {
        await this.sendText(from, 'No options available in this category.');
        await this.handleServiceSelection(session, from, '');
        return;
      }

      session.session_data.order_selected_category_id = categoryId;
      await this.updateSession(session.id, 'service_selection', session.session_data);

      await this.gupshupService.sendList({
        to: from,
        title: svcLabels.selectTitle,
        body: `Pick an option:`,
        buttonLabel: 'Select',
        items: items.map(i => ({
          title: i.name,
          description: `₦${i.price.toLocaleString()}${i.description ? ' • ' + i.description : ''}`,
          postbackText: `svc_${i.id}`,
        })),
      });
      return;
    }

    // Phase 2: Service selected — store it and move to date selection
    if (input.startsWith('svc_')) {
      const itemId = input.replace('svc_', '');
      const { data: item } = await supabase
        .from('menu_items')
        .select('id, name, price')
        .eq('id', itemId)
        .single();

      if (!item) {
        await this.handleServiceSelection(session, from, '');
        return;
      }

      session.session_data.selected_service_name = item.name;
      session.session_data.selected_service_price = item.price;
      session.session_data.deposit_amount = item.price;

      await this.updateSession(session.id, 'date_selection', session.session_data);
      await this.sendText(from, `Great choice! *${item.name}* — ₦${item.price.toLocaleString()}\n\nNow let's pick a date:`);
      await this.handleDateSelection(session, from, '');
      return;
    }

    // Invalid input
    const abuse = await this.handleValidationFailure(from, 'service_selection', session);
    if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
    await this.sendText(from, abuse.warn ? abuse.message : 'Please select from the list.');
  }

  private async handleDateSelection(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      // Offer next 7 days as buttons (WhatsApp max 3 buttons, so we use a list)
      const dates: Array<{ title: string; postbackText: string }> = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const label = d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
        dates.push({ title: label, postbackText: d.toISOString().split('T')[0] });
      }

      await this.gupshupService.sendList({
        to: from,
        title: 'Select Date',
        body: 'When would you like to dine?',
        buttonLabel: 'Choose Date',
        items: dates,
      });
      return;
    }

    // Validate date format YYYY-MM-DD or attempt parse
    let dateStr = input;
    const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(input);
    if (!isoMatch) {
      // Try parsing natural input
      const parsed = new Date(input);
      if (isNaN(parsed.getTime())) {
        const dateAbuse = await this.handleValidationFailure(from, 'date_selection', session);
        if (dateAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, dateAbuse.message); return; }
        await this.sendText(from, dateAbuse.warn ? dateAbuse.message : "I didn't catch that. Please tap one of the date options.");
        return;
      }
      dateStr = parsed.toISOString().split('T')[0];
    }

    // Validate date is in the future
    const selectedDate = new Date(dateStr + 'T00:00');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (selectedDate < tomorrow) {
      await this.sendText(from, 'Please select a future date.');
      return;
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (BOOKING_DEFAULTS.maxAdvanceDays || 30));
    if (selectedDate > maxDate) {
      await this.sendText(from, `Bookings can only be made up to ${BOOKING_DEFAULTS.maxAdvanceDays} days in advance.`);
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.date = dateStr;
    await this.updateSession(session.id, 'time_selection', session.session_data);
    await this.handleTimeSelection(session, from, '');
  }

  private async handleTimeSelection(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      // Show time slots (lunch + dinner blocks)
      const slots = generateTimeSlots('12:00', '22:00', 60);
      await this.gupshupService.sendList({
        to: from,
        title: 'Select Time',
        body: `Available times for ${new Date(session.session_data.date! + 'T00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' })}:`,
        buttonLabel: 'Choose Time',
        items: slots.map((t) => ({
          title: t,
          postbackText: t,
        })),
      });
      return;
    }

    // Validate time format
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(input);
    if (!timeMatch) {
      const timeAbuse = await this.handleValidationFailure(from, 'time_selection', session);
      if (timeAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, timeAbuse.message); return; }
      await this.sendText(from, timeAbuse.warn ? timeAbuse.message : "I didn't catch that. Please tap one of the time options.");
      return;
    }

    const hour = parseInt(timeMatch[1], 10);
    if (hour < 12 || hour > 21) {
      await this.sendText(from, 'Available times are between 12:00 and 21:00.');
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.time = input;
    await this.updateSession(session.id, 'party_size', session.session_data);
    await this.handlePartySize(session, from, '');
  }

  private async handlePartySize(session: BotSession, from: string, input: string): Promise<void> {
    // Auto-skip party size for service categories — always 1 person
    const category = this.getSessionCategory(session);
    const SERVICE_CATS = ['spa', 'gym', 'barber', 'salon', 'car_wash', 'mechanic', 'hotel', 'clinic', 'tutor', 'photography', 'cleaning', 'coworking'];
    if (SERVICE_CATS.includes(category)) {
      session.session_data.party_size = 1;
      await this.updateSession(session.id, 'confirmation', session.session_data);
      await this.handleConfirmation(session, from, '');
      return;
    }

    if (!input) {
      const lastSize = session.session_data.last_party_size;
      const isQuick = session.session_data.is_quick_rebook;

      if (isQuick && lastSize && lastSize >= 1 && lastSize <= BOOKING_DEFAULTS.maxPartySize) {
        // Offer last party size as quick option
        const buttons: Array<{ id: string; title: string }> = [
          { id: String(lastSize), title: `${lastSize} (same as last)` },
        ];
        if (lastSize !== 2) buttons.push({ id: '2', title: '2 guests' });
        if (lastSize !== 4 && buttons.length < 3) buttons.push({ id: '4', title: '4 guests' });
        if (buttons.length < 3) buttons.push({ id: '6', title: '6 guests' });

        await this.gupshupService.sendButtons({
          to: from,
          body: `How many guests? (Last time: ${lastSize})`,
          buttons: buttons.slice(0, 3),
        });
      } else {
        await this.gupshupService.sendButtons({
          to: from,
          body: 'How many guests?',
          buttons: [
            { id: '2', title: '2 guests' },
            { id: '4', title: '4 guests' },
            { id: '6', title: '6 guests' },
          ],
        });
      }
      await this.sendText(from, `Or type a number (1-${BOOKING_DEFAULTS.maxPartySize}).`);
      return;
    }

    const size = parseInt(input, 10);
    if (isNaN(size) || size < 1 || size > BOOKING_DEFAULTS.maxPartySize) {
      await this.sendText(from, `Please enter a number between 1 and ${BOOKING_DEFAULTS.maxPartySize}.`);
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.party_size = size;
    await this.updateSession(session.id, 'confirmation', session.session_data);
    await this.handleConfirmation(session, from, '');
  }

  private async handleConfirmation(session: BotSession, from: string, input: string): Promise<void> {
    const d = session.session_data;
    const confirmCategory = this.getSessionCategory(session);
    const SERVICE_CATS = ['spa', 'gym', 'barber', 'salon', 'car_wash', 'mechanic', 'hotel', 'clinic', 'tutor', 'photography', 'cleaning', 'coworking'];
    const isSpaGym = SERVICE_CATS.includes(confirmCategory);

    if (!input) {
      const dateLabel = new Date(d.date! + 'T00:00').toLocaleDateString('en-NG', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      const lines = [
        `📋 *Booking Summary*`,
        ``,
        `🍽️ ${d.restaurant_name}`,
        `📅 ${dateLabel}`,
        `🕐 ${d.time}`,
      ];

      if (isSpaGym && d.selected_service_name) {
        lines.push(`💆 ${d.selected_service_name} — ₦${(d.selected_service_price || 0).toLocaleString()}`);
      } else {
        lines.push(`👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`);
      }

      if (d.special_requests) {
        lines.push(`📝 ${d.special_requests}`);
      }
      if (d.book_for_other && d.other_name) {
        lines.push(`👤 Booking for: ${d.other_name}${d.other_phone ? ` (${d.other_phone})` : ''}`);
      }

      await this.sendText(from, lines.join('\n'));
      await this.gupshupService.sendButtons({
        to: from,
        body: 'Confirm this booking?',
        buttons: [
          { id: 'confirm', title: 'Confirm ✓' },
          { id: 'add_request', title: '📝 Add Request' },
          { id: 'for_someone', title: '👤 For Someone' },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'cancel' || response === 'no') {
      await this.sendText(from, 'Booking cancelled. Send "Hi" to start again anytime!');
      await this.deactivateSession(session.id);
      return;
    }

    if (response === 'edit') {
      await this.updateStep(session.id, 'date_selection');
      session.current_step = 'date_selection';
      await this.handleDateSelection(session, from, '');
      return;
    }

    if (response === 'add_request') {
      await this.updateStep(session.id, 'special_requests');
      await this.handleSpecialRequests(session, from, '');
      return;
    }

    if (response === 'for_someone') {
      await this.updateStep(session.id, 'book_for_other');
      await this.handleBookForOther(session, from, '');
      return;
    }

    if (response === 'confirm' || response === 'yes') {
      await this.createReservation(session, from);
      return;
    }

    const confirmAbuse = await this.handleValidationFailure(from, 'confirmation', session);
    if (confirmAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, confirmAbuse.message); return; }
    await this.sendText(from, confirmAbuse.warn ? confirmAbuse.message : "Please tap *Confirm*, *Add Request*, or *For Someone*.");
  }

  // ── Special Requests Handler (Feature 2) ──────────────

  private async handleSpecialRequests(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: 'Any special requests for your visit?',
        buttons: [
          { id: 'req_none', title: "No, I'm good" },
          { id: 'req_birthday', title: 'Birthday 🎂' },
          { id: 'req_window', title: 'Window seat' },
        ],
      });
      await this.sendText(from, 'Or type your own request:');
      return;
    }

    const response = input.toLowerCase();

    if (response === 'req_none') {
      session.session_data.special_requests = undefined;
    } else if (response === 'req_birthday') {
      session.session_data.special_requests = 'Birthday celebration 🎂';
    } else if (response === 'req_window') {
      session.session_data.special_requests = 'Window seat preferred';
    } else {
      session.session_data.special_requests = input;
    }

    await this.updateSession(session.id, 'confirmation', session.session_data);
    if (session.session_data.special_requests) {
      await this.sendText(from, `Got it! 📝 "${session.session_data.special_requests}"`);
    }
    await this.handleConfirmation(session, from, '');
  }

  // ── Book For Other Handlers (Feature 3) ───────────────

  private async handleBookForOther(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: 'Who is this booking for?',
        buttons: [
          { id: 'for_myself', title: 'Myself' },
          { id: 'for_other', title: 'Someone else' },
        ],
      });
      return;
    }

    if (input.toLowerCase() === 'for_myself') {
      session.session_data.book_for_other = false;
      session.session_data.other_name = undefined;
      session.session_data.other_phone = undefined;
      await this.updateSession(session.id, 'confirmation', session.session_data);
      await this.handleConfirmation(session, from, '');
      return;
    }

    if (input.toLowerCase() === 'for_other') {
      session.session_data.book_for_other = true;
      await this.updateSession(session.id, 'collect_other_name', session.session_data);
      await this.handleCollectOtherName(session, from, '');
      return;
    }

    const otherAbuse = await this.handleValidationFailure(from, 'book_for_other', session);
    if (otherAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, otherAbuse.message); return; }
    await this.sendText(from, otherAbuse.warn ? otherAbuse.message : 'Please tap *Myself* or *Someone else*.');
  }

  private async handleCollectOtherName(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.sendText(from, "What's the guest's name?");
      return;
    }

    session.session_data.other_name = input.trim();
    await this.updateSession(session.id, 'collect_other_phone', session.session_data);
    await this.sendText(from, `Got it! What's ${session.session_data.other_name}'s WhatsApp number?\n\n(e.g. +2348012345678 or type *skip*)`);
  }

  private async handleCollectOtherPhone(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.sendText(from, "Please type the guest's WhatsApp number (or *skip*):");
      return;
    }

    if (input.toLowerCase() !== 'skip') {
      const phone = input.replace(/\s+/g, '');
      if (!/^\+?\d{10,15}$/.test(phone)) {
        await this.sendText(from, 'That doesn\'t look right. Please enter a valid number (e.g. +2348012345678) or type *skip*:');
        return;
      }
      session.session_data.other_phone = phone.startsWith('+') ? phone : `+${phone}`;
    }

    await this.updateSession(session.id, 'confirmation', session.session_data);
    await this.sendText(from, `Great! Booking for ${session.session_data.other_name}. ✓`);
    await this.handleConfirmation(session, from, '');
  }

  // ── Collect Name Handler ────────────────────────────────

  private async handleCollectName(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.sendText(from, 'To complete your booking, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):');
      return;
    }

    const parts = input.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    if (!firstName || firstName.length < 2) {
      await this.sendText(from, 'Please enter a valid name (first and last name):');
      return;
    }

    session.session_data.first_name = firstName;
    session.session_data.last_name = lastName;
    await this.updateSession(session.id, 'collect_email', session.session_data);

    await this.sendText(from, `Thanks, ${firstName}! 📧 What's your email address?\n\nWe'll send your booking confirmation there.`);
  }

  // ── Collect Email Handler ─────────────────────────────

  private async handleCollectEmail(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: '📧 Please type your email address, or skip:',
        buttons: [
          { id: 'skip_email', title: 'Skip' },
        ],
      });
      return;
    }

    const firstName = session.session_data.first_name || '';
    const lastName = session.session_data.last_name || '';
    let email: string | undefined;

    if (input.toLowerCase() !== 'skip_email' && input.toLowerCase() !== 'skip') {
      email = input.trim().toLowerCase();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await this.sendText(from, 'That doesn\'t look like a valid email. Please try again (e.g. ade@gmail.com) or type *skip*:');
        return;
      }

      session.session_data.email = email;
    }

    // Create the Supabase auth user + profile
    const userId = await this.createWhatsAppUser(from, firstName, lastName, email);

    if (!userId) {
      // If it failed with email, retry without email instead of killing the session
      if (email) {
        this.logger.warn(`User creation failed with email ${email}, retrying without email`);
        const retryUserId = await this.createWhatsAppUser(from, firstName, lastName);

        if (retryUserId) {
          session.user_id = retryUserId;
          await this.supabaseService.getClient()
            .from('bot_sessions')
            .update({ user_id: retryUserId, session_data: session.session_data })
            .eq('id', session.id);

          await this.sendText(from, `Thanks, ${firstName}! 🎉 Let's complete your booking.`);
          await this.createReservation(session, from);
          return;
        }
      }

      // Still failed — let user try a different email instead of restarting
      await this.sendText(from, `Hmm, that didn't work. Please try a different email, or type *skip* to continue without one:`);
      return;
    }

    // Update session with user ID
    session.user_id = userId;
    await this.supabaseService.getClient()
      .from('bot_sessions')
      .update({ user_id: userId, session_data: session.session_data })
      .eq('id', session.id);

    await this.sendText(from, `Great, ${firstName}! 🎉 Your account is set up.`);

    // Now create the reservation
    await this.createReservation(session, from);
  }

  // ── Payment Check Handler ─────────────────────────────

  private async handlePaymentCheck(session: BotSession, from: string, input: string): Promise<void> {
    const text = input.toLowerCase();

    if (text === 'check' || text === 'done' || text === 'paid' || text === 'i_paid' || text === "i've paid") {
      const ref = session.session_data.payment_reference;
      if (!ref) {
        await this.sendText(from, 'Something went wrong. Send "Hi" to start over.');
        await this.deactivateSession(session.id);
        return;
      }

      // Verify directly with Paystack API (don't rely on webhook)
      const verified = await this.verifyPaystackPayment(ref);

      if (verified) {
        const d = session.session_data;
        const dateLabel = new Date(d.date! + 'T00:00').toLocaleDateString('en-NG', {
          weekday: 'long', day: 'numeric', month: 'long',
        });

        await this.sendText(from, [
          `✅ *Payment Confirmed!*`,
          ``,
          `Your reservation at *${d.restaurant_name}* is fully confirmed.`,
          `📅 ${dateLabel} at ${d.time}`,
          `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
          `🔑 Ref: *${d.reference_code}*`,
          ``,
          `See you there! 🎉`,
        ].join('\n'));

        await this.updateSession(session.id, 'complete', session.session_data);
        await this.deactivateSession(session.id);
      } else {
        await this.gupshupService.sendButtons({
          to: from,
          body: `Payment not yet received. Please complete payment using the link sent earlier.\n\nTap *I've Paid* after paying, or *Cancel* to cancel.`,
          buttons: [
            { id: 'i_paid', title: "I've Paid" },
            { id: 'cancel', title: 'Cancel' },
          ],
        });
      }
    } else if (text === 'cancel') {
      const supabase = this.supabaseService.getClient();
      if (session.session_data.reservation_id) {
        await supabase
          .from('reservations')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'guest' })
          .eq('id', session.session_data.reservation_id);
      }
      await this.sendText(from, 'Booking cancelled. Send "Hi" to start again anytime!');
      await this.deactivateSession(session.id);
    } else {
      await this.gupshupService.sendButtons({
        to: from,
        body: `Please complete your deposit payment using the link sent above.\n\nTap *I've Paid* after paying, or *Cancel* to cancel.`,
        buttons: [
          { id: 'i_paid', title: "I've Paid" },
          { id: 'cancel', title: 'Cancel' },
        ],
      });
    }
  }

  // ── Verify Payment with Paystack API ──────────────────

  private async verifyPaystackPayment(reference: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();

    // Handle mock payments (dev mode)
    if (!this.paystackSecretKey || reference.startsWith('mock_')) {
      // Auto-succeed mock payments
      await supabase
        .from('payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('gateway_reference', reference);

      const { data: payment } = await supabase
        .from('payments')
        .select('reservation_id')
        .eq('gateway_reference', reference)
        .single();

      if (payment?.reservation_id) {
        await supabase
          .from('reservations')
          .update({ deposit_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', payment.reservation_id);
      }
      return true;
    }

    try {
      // Call Paystack verify endpoint directly
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${this.paystackSecretKey}` } },
      );

      const data = await response.json();
      this.logger.log(`Paystack verify for ${reference}: status=${data?.data?.status}`);

      if (data?.data?.status === 'success') {
        // Update our local records
        const { data: payment } = await supabase
          .from('payments')
          .select('id, reservation_id, amount')
          .eq('gateway_reference', reference)
          .single();

        if (payment) {
          // Verify amount matches
          const webhookAmountKobo = data.data.amount as number;
          const expectedKobo = payment.amount * 100;

          if (webhookAmountKobo !== expectedKobo) {
            this.logger.error(`Amount mismatch: paystack=${webhookAmountKobo}, expected=${expectedKobo}`);
            return false;
          }

          const authorization = data.data.authorization as Record<string, string> | undefined;
          await supabase
            .from('payments')
            .update({
              status: 'success',
              gateway_status: 'success',
              payment_method: (data.data.channel as string) || 'card',
              card_last_four: authorization?.last4 || null,
              card_brand: authorization?.brand || null,
              paid_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

          if (payment.reservation_id) {
            await supabase
              .from('reservations')
              .update({ deposit_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
              .eq('id', payment.reservation_id);
          }
        }
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Paystack verify error:', (error as Error).message);
      return false;
    }
  }

  // ── Create WhatsApp User ──────────────────────────────

  private async createWhatsAppUser(phone: string, firstName: string, lastName: string, email?: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const rawPhone = phone.startsWith('+') ? phone.slice(1) : phone;

    // Helper: look up profile by phone (checks both +phone and phone formats)
    const findProfileByPhone = async (): Promise<string | null> => {
      const { data: byFull } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', fullPhone)
        .single();
      if (byFull?.id) return byFull.id;

      const { data: byRaw } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', rawPhone)
        .single();
      return byRaw?.id || null;
    };

    try {
      // First, check if this phone already exists in profiles
      const existingId = await findProfileByPhone();
      if (existingId) {
        this.logger.log(`Found existing profile for phone ${phone} → ${existingId}`);
        const updateData: Record<string, string> = { first_name: firstName, last_name: lastName };
        if (email) updateData.email = email;
        await supabase.from('profiles').update(updateData).eq('id', existingId);
        return existingId;
      }

      // Create auth user via admin API (service role)
      const createPayload: Record<string, unknown> = {
        phone: fullPhone,
        phone_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      };
      if (email) {
        createPayload.email = email;
        createPayload.email_confirm = true;
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser(createPayload);

      if (authError) {
        this.logger.warn('Auth user creation error (will try lookup):', authError.message);

        // Try lookup by email (phone might have been stored differently)
        if (email) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

          if (byEmail?.id) {
            await supabase
              .from('profiles')
              .update({ phone: fullPhone, first_name: firstName, last_name: lastName })
              .eq('id', byEmail.id);
            return byEmail.id;
          }
        }

        // Last resort: try creating without email (email conflict is the most common cause)
        if (email) {
          this.logger.warn('Retrying user creation without email');
          const { data: retryData, error: retryError } = await supabase.auth.admin.createUser({
            phone: fullPhone,
            phone_confirm: true,
            user_metadata: { first_name: firstName, last_name: lastName },
          });

          if (!retryError && retryData?.user) {
            const uid = retryData.user.id;
            await supabase
              .from('profiles')
              .update({ first_name: firstName, last_name: lastName })
              .eq('id', uid);
            this.logger.log(`Created WhatsApp user (no email): ${firstName} (${fullPhone}) → ${uid}`);
            return uid;
          }
        }

        return null;
      }

      const userId = authData.user.id;

      // Update profile with name + email (trigger creates profile, we add details)
      const profileUpdate: Record<string, string> = { first_name: firstName, last_name: lastName };
      if (email) profileUpdate.email = email;

      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      this.logger.log(`Created WhatsApp user: ${firstName} ${lastName} (${fullPhone}) → ${userId}`);
      return userId;
    } catch (error) {
      this.logger.error('createWhatsAppUser error:', (error as Error).message);

      // Even on exception, try a phone lookup before giving up
      try {
        const fallbackId = await findProfileByPhone();
        if (fallbackId) return fallbackId;
      } catch { /* ignore */ }

      return null;
    }
  }

  // ── Create Reservation ──────────────────────────────────

  private async createReservation(session: BotSession, from: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const d = session.session_data;

    // Check tier limits for standalone bots
    if (session.restaurant_id) {
      const tierInfo = await this.standaloneService.checkTierLimits(session.restaurant_id);
      if (!tierInfo.allowed) {
        await this.sendText(from, 'Sorry, the monthly booking limit has been reached for this restaurant. Please call them directly to book.');
        await this.deactivateSession(session.id);
        return;
      }
    }

    // Get or create user
    let userId = session.user_id;
    if (!userId) {
      const fullPhone = from.startsWith('+') ? from : `+${from}`;
      const rawPhone = from.startsWith('+') ? from.slice(1) : from;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('phone', fullPhone)
        .single();

      if (profile?.id) {
        userId = profile.id;
      } else {
        const { data: profileRaw } = await supabase
          .from('profiles')
          .select('id, first_name')
          .eq('phone', rawPhone)
          .single();
        userId = profileRaw?.id || null;
      }
    }

    if (!userId) {
      // No account — ask for name to create one
      await this.updateSession(session.id, 'collect_name', session.session_data);
      await this.handleCollectName(session, from, '');
      return;
    }

    // Get restaurant deposit + location info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('deposit_per_guest, latitude, longitude, address')
      .eq('id', d.restaurant_id!)
      .single();

    const depositPerGuest = restaurant?.deposit_per_guest || 0;
    const totalDeposit = d.selected_service_price || (depositPerGuest * d.party_size!);

    const insertPayload: Record<string, unknown> = {
      restaurant_id: d.restaurant_id!,
      user_id: userId,
      date: d.date!,
      time: d.time!,
      party_size: d.party_size!,
      channel: 'whatsapp',
      deposit_amount: totalDeposit,
      deposit_status: totalDeposit > 0 ? 'pending' : 'none',
      status: totalDeposit > 0 ? 'pending' : 'confirmed',
      booking_type: 'instant',
    };

    if (d.special_requests) {
      insertPayload.special_requests = d.special_requests;
    }
    if (d.book_for_other && d.other_name) {
      insertPayload.guest_name = d.other_name;
    }

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert(insertPayload)
      .select('id, reference_code')
      .single();

    if (insertError || !reservation) {
      this.logger.error('Failed to create reservation via bot', insertError);
      await this.sendText(from, 'Sorry, that time slot may no longer be available. Send "Hi" to try again.');
      await this.deactivateSession(session.id);
      return;
    }

    session.session_data.reservation_id = reservation.id;
    session.session_data.reference_code = reservation.reference_code;
    session.session_data.deposit_amount = totalDeposit;

    // Populate guest fields
    try {
      const guestName = d.book_for_other && d.other_name
        ? d.other_name
        : [d.first_name, d.last_name].filter(Boolean).join(' ') || null;
      const guestPhone = d.book_for_other && d.other_phone
        ? d.other_phone
        : (from.startsWith('+') ? from : `+${from}`);

      await supabase
        .from('reservations')
        .update({
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_email: d.email || null,
        })
        .eq('id', reservation.id);
    } catch (err) {
      this.logger.warn('Failed to populate guest fields from bot', err);
    }

    const dateLabel = new Date(d.date! + 'T00:00').toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    // If deposit required, send payment link
    if (totalDeposit > 0) {
      // Get user email for Paystack (from session or profile)
      let userEmail = d.email;
      if (!userEmail) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();
        userEmail = userProfile?.email || undefined;
      }

      const paymentUrl = await this.initializePaystackPayment(
        reservation.id,
        userId,
        totalDeposit,
        reservation.reference_code,
        d.restaurant_name || 'Restaurant',
        from,
        userEmail,
      );

      if (paymentUrl) {
        session.session_data.payment_reference = paymentUrl.reference;
        await this.updateSession(session.id, 'payment', session.session_data);

        await this.sendText(from, [
          `📋 *Booking Created!*`,
          ``,
          `🍽️ ${d.restaurant_name}`,
          `📅 ${dateLabel}`,
          `🕐 ${d.time}`,
          `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
          `🔑 Ref: *${reservation.reference_code}*`,
          ``,
          `💳 *Deposit Required: ₦${totalDeposit.toLocaleString()}*`,
          ``,
          `Pay here 👇`,
          paymentUrl.url,
        ].join('\n'));

        await this.gupshupService.sendButtons({
          to: from,
          body: `Tap *I've Paid* after completing payment:`,
          buttons: [
            { id: 'i_paid', title: "I've Paid" },
            { id: 'cancel', title: 'Cancel' },
          ],
        });
      } else {
        // Payment init failed — still create booking, tell user to pay on website
        await this.updateSession(session.id, 'complete', session.session_data);
        await this.deactivateSession(session.id);

        await this.sendText(from, [
          `📋 *Booking Created!*`,
          ``,
          `🍽️ ${d.restaurant_name}`,
          `📅 ${dateLabel}`,
          `🕐 ${d.time}`,
          `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
          `🔑 Ref: *${reservation.reference_code}*`,
          ``,
          `💳 Deposit of ₦${totalDeposit.toLocaleString()} required.`,
          `Please visit naijadine.com to complete payment.`,
        ].join('\n'));
      }
    } else {
      // No deposit — booking confirmed immediately
      await this.updateSession(session.id, 'complete', session.session_data);
      await this.deactivateSession(session.id);

      // Use custom confirmation template for standalone bots
      let message: string;
      if (session.restaurant_id) {
        const templates = await this.standaloneService.getBotTemplates(session.restaurant_id);
        const tierInfo = await this.standaloneService.checkTierLimits(session.restaurant_id);
        message = this.standaloneService.fillTemplate(templates.confirmation, {
          restaurant_name: d.restaurant_name || '',
          date: dateLabel,
          time: d.time || '',
          party_size: d.party_size || 0,
          reference_code: reservation.reference_code,
        });
        if (!tierInfo.isWhitelabel) {
          message += '\n\n_Powered by NaijaDine_';
        }
      } else {
        message = [
          `✅ *Booking Confirmed!*`,
          ``,
          `🍽️ ${d.restaurant_name}`,
          `📅 ${dateLabel}`,
          `🕐 ${d.time}`,
          `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
          `🔑 Ref: *${reservation.reference_code}*`,
          ``,
          `Enjoy your meal! 🎉`,
        ].join('\n');
      }

      await this.sendText(from, message);
    }

    // Create in-app notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'booking_confirmation',
      channel: 'in_app',
      title: 'Booking Confirmed via WhatsApp',
      body: `Your reservation at ${d.restaurant_name} on ${dateLabel} at ${d.time} is confirmed. Ref: ${reservation.reference_code}`,
      metadata: { reservation_id: reservation.id, reference_code: reservation.reference_code },
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    });

    // Feature 8: Google Maps link after booking
    if (restaurant?.latitude && restaurant?.longitude) {
      const mapsUrl = `https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`;
      await this.sendText(from, `📍 How to get there:\n${restaurant.address || ''}\n${mapsUrl}`);
    }

    // Feature 3: Send confirmation to other person's WhatsApp
    if (d.book_for_other && d.other_phone) {
      const otherDateLabel = new Date(d.date! + 'T00:00').toLocaleDateString('en-NG', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      await this.sendText(d.other_phone, [
        `Hi ${d.other_name || 'there'}! 🍽️`,
        ``,
        `A table has been booked for you at *${d.restaurant_name}*:`,
        `📅 ${otherDateLabel}`,
        `🕐 ${d.time}`,
        `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
        `🔑 Ref: *${reservation.reference_code}*`,
        ``,
        `Enjoy your meal! 🎉`,
      ].join('\n'));

      if (restaurant?.latitude && restaurant?.longitude) {
        const mapsUrl = `https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`;
        await this.sendText(d.other_phone, `📍 How to get there:\n${restaurant.address || ''}\n${mapsUrl}`);
      }
    }

    // Send confirmation email if we have an email
    const emailAddr = d.email || (await this.getUserEmail(userId));
    if (emailAddr) {
      await this.sendBookingEmail(emailAddr, {
        firstName: d.first_name || 'there',
        restaurantName: d.restaurant_name || 'Restaurant',
        date: dateLabel,
        time: d.time || '',
        partySize: d.party_size || 1,
        referenceCode: reservation.reference_code,
        depositAmount: totalDeposit,
      });
    }
  }

  // ── Get User Email ────────────────────────────────────

  private async getUserEmail(userId: string): Promise<string | null> {
    const { data } = await this.supabaseService.getClient()
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    return data?.email || null;
  }

  // ── Send Booking Confirmation Email ───────────────────

  private async sendBookingEmail(
    to: string,
    details: {
      firstName: string;
      restaurantName: string;
      date: string;
      time: string;
      partySize: number;
      referenceCode: string;
      depositAmount: number;
    },
  ): Promise<void> {
    const { firstName, restaurantName, date, time, partySize, referenceCode, depositAmount } = details;

    const depositLine = depositAmount > 0
      ? `<tr><td style="padding:8px 0;color:#666;">Deposit</td><td style="padding:8px 0;font-weight:600;">₦${depositAmount.toLocaleString()}</td></tr>`
      : '';

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;">
        <div style="background:#1B4332;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">NaijaDine</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#1B4332;margin:0 0 8px;">Booking Confirmed! ✓</h2>
          <p style="color:#444;margin:0 0 20px;">Hi ${firstName}, your reservation is all set.</p>
          <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:8px;padding:16px;">
            <tr><td style="padding:8px 0;color:#666;">Restaurant</td><td style="padding:8px 0;font-weight:600;">${restaurantName}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Date</td><td style="padding:8px 0;font-weight:600;">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Time</td><td style="padding:8px 0;font-weight:600;">${time}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Guests</td><td style="padding:8px 0;font-weight:600;">${partySize}</td></tr>
            ${depositLine}
            <tr><td style="padding:8px 0;color:#666;">Reference</td><td style="padding:8px 0;font-weight:700;color:#1B4332;">${referenceCode}</td></tr>
          </table>
          <p style="color:#888;font-size:13px;margin:20px 0 0;">Show your reference code at the restaurant. Enjoy your meal!</p>
        </div>
        <div style="background:#f8f9fa;padding:16px;text-align:center;color:#999;font-size:12px;">
          NaijaDine — Discover & book the best restaurants in Nigeria
        </div>
      </div>
    `;

    try {
      await this.resendService.send({
        to,
        subject: `Booking Confirmed: ${restaurantName} — ${date}`,
        html,
      });
      this.logger.log(`Booking confirmation email sent to ${to}`);
    } catch (error) {
      this.logger.error('Failed to send booking email:', (error as Error).message);
    }
  }

  // ── Initialize Paystack Payment ───────────────────────

  private async initializePaystackPayment(
    reservationId: string,
    userId: string,
    amount: number,
    referenceCode: string,
    restaurantName: string,
    phone: string,
    userEmail?: string,
  ): Promise<{ url: string; reference: string } | null> {
    const supabase = this.supabaseService.getClient();
    const idempotencyKey = randomUUID();
    const amountInKobo = amount * 100;
    // Use real email if available, fallback to generated one
    const email = userEmail || `${phone.replace('+', '')}@whatsapp.naijadine.com`;

    try {
      if (!this.paystackSecretKey) {
        // Dev mode mock
        this.logger.warn('PAYSTACK not set — mock payment for WhatsApp');
        const mockRef = `mock_wa_${idempotencyKey}`;

        await supabase.from('payments').insert({
          reservation_id: reservationId,
          user_id: userId,
          amount,
          currency: 'NGN',
          gateway: 'paystack',
          gateway_reference: mockRef,
          status: 'pending',
          idempotency_key: idempotencyKey,
          metadata: { reservation_ref: referenceCode, channel: 'whatsapp' },
        });

        return { url: `https://naijadine.com/pay?ref=${mockRef}`, reference: mockRef };
      }

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          metadata: {
            reservation_id: reservationId,
            user_id: userId,
            reservation_ref: referenceCode,
            channel: 'whatsapp',
            custom_fields: [
              { display_name: 'Restaurant', variable_name: 'restaurant', value: restaurantName },
              { display_name: 'Booking Ref', variable_name: 'booking_ref', value: referenceCode },
            ],
          },
        }),
      });

      const data = await response.json();

      if (!data.status) {
        this.logger.error('Paystack initialize for WhatsApp failed', data);
        return null;
      }

      // Store payment record
      const { data: payment } = await supabase.from('payments').insert({
        reservation_id: reservationId,
        user_id: userId,
        amount,
        currency: 'NGN',
        gateway: 'paystack',
        gateway_reference: data.data.reference,
        status: 'pending',
        idempotency_key: idempotencyKey,
        metadata: {
          access_code: data.data.access_code,
          reservation_ref: referenceCode,
          channel: 'whatsapp',
        },
      }).select().single();

      // Link payment to reservation
      if (payment) {
        await supabase
          .from('reservations')
          .update({ payment_id: payment.id })
          .eq('id', reservationId);
      }

      return {
        url: data.data.authorization_url,
        reference: data.data.reference,
      };
    } catch (error) {
      this.logger.error('Paystack init error for WhatsApp:', (error as Error).message);
      return null;
    }
  }

  // ── My Bookings Handler (Feature 7) ────────────────────

  private async handleMyBookings(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    if (!input) {
      const { data: upcoming } = await supabase
        .from('reservations')
        .select('id, date, time, party_size, reference_code, restaurants (name)')
        .eq('user_id', session.user_id!)
        .in('status', ['confirmed', 'pending'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(5);

      if (!upcoming || upcoming.length === 0) {
        await this.sendText(from, "You don't have any upcoming bookings. Send *Hi* to make a new one!");
        await this.deactivateSession(session.id);
        return;
      }

      const items = upcoming.map((r) => {
        const rest = r.restaurants as unknown as { name: string } | null;
        const dateLabel = new Date(r.date + 'T00:00').toLocaleDateString('en-NG', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
        return {
          title: rest?.name || 'Restaurant',
          description: `${dateLabel} at ${r.time} • ${r.party_size} guests`,
          postbackText: `booking_${r.id}`,
        };
      });

      await this.gupshupService.sendList({
        to: from,
        title: 'Your Bookings',
        body: 'Select a booking to manage:',
        buttonLabel: 'View Bookings',
        items,
      });
      return;
    }

    // User selected a booking
    if (input.startsWith('booking_')) {
      const bookingId = input.replace('booking_', '');
      session.session_data.selected_booking_id = bookingId;
      await this.updateSession(session.id, 'modify_booking', session.session_data);
      await this.handleModifyBooking(session, from, '');
    }
  }

  private async handleModifyBooking(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const bookingId = session.session_data.selected_booking_id;

    if (!bookingId) {
      await this.sendText(from, 'Something went wrong. Send *my bookings* to try again.');
      await this.deactivateSession(session.id);
      return;
    }

    if (!input) {
      const { data: booking } = await supabase
        .from('reservations')
        .select('id, date, time, party_size, reference_code, restaurant_id, restaurants (name)')
        .eq('id', bookingId)
        .single();

      if (!booking) {
        await this.sendText(from, 'Booking not found. Send *my bookings* to try again.');
        await this.deactivateSession(session.id);
        return;
      }

      const rest = booking.restaurants as unknown as { name: string } | null;
      const dateLabel = new Date(booking.date + 'T00:00').toLocaleDateString('en-NG', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

      await this.sendText(from, [
        `📋 *${rest?.name || 'Restaurant'}*`,
        `📅 ${dateLabel} at ${booking.time}`,
        `👥 ${booking.party_size} guests`,
        `🔑 Ref: *${booking.reference_code}*`,
      ].join('\n'));

      await this.gupshupService.sendButtons({
        to: from,
        body: 'What would you like to do?',
        buttons: [
          { id: 'cancel_booking', title: 'Cancel Booking' },
          { id: 'change_datetime', title: 'Change Date/Time' },
          { id: 'back_bookings', title: 'Back' },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'back_bookings') {
      await this.updateStep(session.id, 'my_bookings');
      await this.handleMyBookings(session, from, '');
      return;
    }

    if (response === 'cancel_booking') {
      await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'guest' })
        .eq('id', bookingId);

      await this.sendText(from, '✓ Booking cancelled successfully.\n\nSend *Hi* to make a new booking or *my bookings* to manage others.');
      await this.deactivateSession(session.id);
      return;
    }

    if (response === 'change_datetime') {
      // Get the restaurant info from the booking, cancel old one, restart date selection
      const { data: booking } = await supabase
        .from('reservations')
        .select('restaurant_id, party_size, restaurants (name, slug, city, neighborhood)')
        .eq('id', bookingId)
        .single();

      if (!booking) {
        await this.sendText(from, 'Booking not found. Send *Hi* to start again.');
        await this.deactivateSession(session.id);
        return;
      }

      // Cancel old booking
      await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'guest' })
        .eq('id', bookingId);

      const rest = booking.restaurants as unknown as { name: string; slug: string; city: string; neighborhood: string } | null;

      // Pre-fill session with old booking info
      session.session_data.restaurant_id = booking.restaurant_id;
      session.session_data.restaurant_name = rest?.name || 'Restaurant';
      session.session_data.restaurant_slug = rest?.slug || '';
      session.session_data.city = rest?.city || '';
      session.session_data.neighborhood = rest?.neighborhood || '';
      session.session_data.party_size = booking.party_size;

      await this.updateSession(session.id, 'date_selection', session.session_data);
      await this.sendText(from, `Let's pick a new date for *${rest?.name}*:`);
      await this.handleDateSelection(session, from, '');
      return;
    }

    const modifyAbuse = await this.handleValidationFailure(from, 'modify_booking', session);
    if (modifyAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, modifyAbuse.message); return; }
    await this.sendText(from, modifyAbuse.warn ? modifyAbuse.message : 'Please tap one of the options above.');
  }

  // ── Review Handlers (Feature 4) ───────────────────────

  private async handleReviewRating(from: string, reservationId: string, rating: number): Promise<void> {
    const supabase = this.supabaseService.getClient();

    if (rating < 1 || rating > 5) {
      await this.sendText(from, 'Please rate between 1 and 5 stars.');
      return;
    }

    // Get reservation details
    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, user_id, restaurant_id, restaurants (name)')
      .eq('id', reservationId)
      .single();

    if (!reservation) {
      await this.sendText(from, 'Sorry, we could not find that reservation.');
      return;
    }

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('reservation_id', reservationId)
      .single();

    if (existingReview) {
      await this.sendText(from, 'You\'ve already reviewed this visit. Thank you! 🙏');
      return;
    }

    const rest = reservation.restaurants as unknown as { name: string } | null;

    // Insert review
    await supabase.from('reviews').insert({
      reservation_id: reservationId,
      restaurant_id: reservation.restaurant_id,
      user_id: reservation.user_id,
      rating,
    });

    const stars = '⭐'.repeat(rating);
    await this.sendText(from, `Thank you for rating *${rest?.name || 'the restaurant'}* ${stars}!`);

    // Ask for optional text review — create a session
    const phone = from.startsWith('+') ? from : `+${from}`;
    const { data: profile } = await supabase.from('profiles').select('id').eq('phone', phone).single();

    // Deactivate any existing session
    await supabase.from('bot_sessions').update({ is_active: false }).eq('whatsapp_number', from).eq('is_active', true);

    const { data: session } = await supabase.from('bot_sessions').insert({
      whatsapp_number: from,
      user_id: profile?.id || reservation.user_id,
      restaurant_id: null,
      current_step: 'review_text',
      session_data: {
        review_reservation_id: reservationId,
        review_restaurant_name: rest?.name || 'Restaurant',
        review_rating: rating,
      },
      is_active: true,
    }).select().single();

    if (session) {
      await this.gupshupService.sendButtons({
        to: from,
        body: 'Would you like to add a comment about your experience?',
        buttons: [
          { id: 'skip_review', title: 'No thanks' },
          { id: 'write_review', title: 'Yes, add comment' },
        ],
      });
    }
  }

  private async handleReviewText(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const d = session.session_data;

    if (!input) {
      await this.sendText(from, 'Type your comment about your experience:');
      return;
    }

    if (input.toLowerCase() === 'skip_review' || input.toLowerCase() === 'no thanks') {
      await this.sendText(from, 'No problem! Thanks for your rating. 🙏\n\nSend *Hi* to make a new booking.');
      await this.deactivateSession(session.id);
      return;
    }

    if (input.toLowerCase() === 'write_review') {
      await this.sendText(from, `Tell us about your experience at *${d.review_restaurant_name}*:`);
      return;
    }

    // Save the text review
    await supabase
      .from('reviews')
      .update({ comment: input.trim() })
      .eq('reservation_id', d.review_reservation_id!);

    await this.sendText(from, `Thank you for your review of *${d.review_restaurant_name}*! 🙏\n\nSend *Hi* to make a new booking.`);
    await this.deactivateSession(session.id);
  }

  // ═══════════════════════════════════════════════════════
  // FOOD ORDERING HANDLERS
  // ═══════════════════════════════════════════════════════

  // ── Order: City Selection (marketplace path) ──────────

  private async handleOrderCitySelection(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      const cityKeys = Object.keys(CITIES) as Array<keyof typeof CITIES>;
      await this.gupshupService.sendList({
        to: from,
        title: 'Select a City',
        body: 'Where would you like to order from?',
        buttonLabel: 'Choose City',
        items: cityKeys.map((key) => ({
          title: CITIES[key].name,
          postbackText: key,
        })),
      });
      await this.updateStep(session.id, 'order_city_selection');
      return;
    }

    const cityKeys = Object.keys(CITIES) as Array<keyof typeof CITIES>;
    const matchedCity = cityKeys.find(
      (key) => key === input.toLowerCase() || CITIES[key].name.toLowerCase() === input.toLowerCase(),
    );

    if (!matchedCity) {
      const abuse = await this.handleValidationFailure(from, 'order_city_selection', session);
      if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
      await this.sendText(from, abuse.warn ? abuse.message : "I didn't catch that. Please tap one of the city options.");
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.city = matchedCity;
    await this.updateSession(session.id, 'order_restaurant_selection', session.session_data);
    await this.handleOrderRestaurantSelection(session, from, '');
  }

  // ── Order: Restaurant Selection (marketplace path) ────

  private async handleOrderRestaurantSelection(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    if (!input) {
      // Fetch restaurants in city that have menu items
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, slug, cuisine_types, delivery_fee')
        .eq('city', session.session_data.city!)
        .in('status', ['active', 'approved'])
        .limit(10);

      if (!restaurants || restaurants.length === 0) {
        await this.sendText(from, 'No restaurants with menus found in this city. Send *Hi* to start again.');
        await this.deactivateSession(session.id);
        return;
      }

      // Filter to restaurants that actually have menu items
      const restaurantIds = restaurants.map(r => r.id);
      const { data: menuCounts } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .in('restaurant_id', restaurantIds)
        .eq('is_available', true);

      const hasMenu = new Set((menuCounts || []).map((m: { restaurant_id: string }) => m.restaurant_id));
      const withMenu = restaurants.filter(r => hasMenu.has(r.id));

      if (withMenu.length === 0) {
        await this.sendText(from, 'No restaurants with active menus found in this city. Send *Hi* to start again.');
        await this.deactivateSession(session.id);
        return;
      }

      await this.gupshupService.sendList({
        to: from,
        title: 'Select Restaurant',
        body: `Restaurants in ${CITIES[session.session_data.city as keyof typeof CITIES]?.name || 'your city'}:`,
        buttonLabel: 'Choose Restaurant',
        items: withMenu.slice(0, 10).map((r) => ({
          title: r.name,
          description: r.delivery_fee !== null ? `Delivery: ${r.delivery_fee === 0 ? 'Free' : formatNaira(r.delivery_fee)}` : 'Pickup only',
          postbackText: r.slug,
        })),
      });
      return;
    }

    // Look up by slug
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, delivery_fee')
      .eq('slug', input.toLowerCase().replace(/\s+/g, '-'))
      .single();

    if (!restaurant) {
      const abuse = await this.handleValidationFailure(from, 'order_restaurant_selection', session);
      if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
      await this.sendText(from, abuse.warn ? abuse.message : "I didn't catch that. Please tap one of the restaurant options.");
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.order_restaurant_id = restaurant.id;
    session.session_data.order_restaurant_name = restaurant.name;
    session.session_data.order_delivery_fee = restaurant.delivery_fee ?? null;
    await this.updateSession(session.id, 'order_menu_categories', session.session_data);
    await this.sendText(from, `🍽️ Let's order from *${restaurant.name}*!`);
    await this.handleOrderMenuCategories(session, from, '');
  }

  // ── Order: Menu Categories ────────────────────────────

  private async handleOrderMenuCategories(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const restaurantId = session.session_data.order_restaurant_id || session.restaurant_id;
    const labels = this.getOrderFlowLabels(session);

    if (!restaurantId) {
      await this.sendText(from, 'Something went wrong. Send *Hi* to start again.');
      await this.deactivateSession(session.id);
      return;
    }

    if (!input) {
      const { data: categories } = await supabase
        .from('menu_categories')
        .select('id, name, description')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10);

      if (!categories || categories.length === 0) {
        await this.sendText(from, `${labels.noItems} Send *Hi* to try another.`);
        await this.deactivateSession(session.id);
        return;
      }

      const cart = session.session_data.cart || [];
      const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
      const cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const bodyText = cartCount > 0
        ? `${labels.menuBody}\n\n${labels.cartSummary(cartCount, cartTotal)}`
        : labels.menuBody;

      await this.gupshupService.sendList({
        to: from,
        title: labels.menuTitle,
        body: bodyText,
        buttonLabel: labels.browseBtn,
        items: categories.map((c) => ({
          title: c.name,
          description: c.description || '',
          postbackText: `cat_${c.id}`,
        })),
      });
      return;
    }

    // User selected a category
    const categoryId = input.replace('cat_', '');
    const { data: category } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('id', categoryId)
      .single();

    if (!category) {
      const abuse = await this.handleValidationFailure(from, 'order_menu_categories', session);
      if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
      await this.sendText(from, abuse.warn ? abuse.message : 'Please tap one of the menu categories.');
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.order_selected_category_id = category.id;
    session.session_data.order_selected_category_name = category.name;
    await this.updateSession(session.id, 'order_menu_items', session.session_data);
    await this.handleOrderMenuItems(session, from, '');
  }

  // ── Order: Menu Items ──────────────────────────────────

  private async handleOrderMenuItems(session: BotSession, from: string, input: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const categoryId = session.session_data.order_selected_category_id;

    if (!categoryId) {
      await this.updateStep(session.id, 'order_menu_categories');
      await this.handleOrderMenuCategories(session, from, '');
      return;
    }

    if (!input) {
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, description, price')
        .eq('category_id', categoryId)
        .eq('is_available', true)
        .order('sort_order', { ascending: true })
        .limit(10);

      if (!items || items.length === 0) {
        await this.sendText(from, `No items available in ${session.session_data.order_selected_category_name}. Try another category.`);
        await this.updateStep(session.id, 'order_menu_categories');
        await this.handleOrderMenuCategories(session, from, '');
        return;
      }

      const itemLabels = this.getOrderFlowLabels(session);
      await this.gupshupService.sendList({
        to: from,
        title: session.session_data.order_selected_category_name || 'Menu Items',
        body: itemLabels.selectItemBody,
        buttonLabel: itemLabels.chooseItemBtn,
        items: items.map((item) => ({
          title: item.name,
          description: `${formatNaira(item.price)}${item.description ? ' — ' + item.description.slice(0, 50) : ''}`,
          postbackText: `item_${item.id}`,
        })),
      });
      return;
    }

    // User selected an item
    const itemId = input.replace('item_', '');
    const { data: item } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('id', itemId)
      .single();

    if (!item) {
      const abuse = await this.handleValidationFailure(from, 'order_menu_items', session);
      if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
      await this.sendText(from, abuse.warn ? abuse.message : 'Please tap one of the menu items.');
      return;
    }

    this.intelligence.resetAbuse(from);
    session.session_data.order_selected_item_id = item.id;
    session.session_data.order_selected_item_name = item.name;
    session.session_data.order_selected_item_price = item.price;
    await this.updateSession(session.id, 'order_item_quantity', session.session_data);
    await this.handleOrderItemQuantity(session, from, '');
  }

  // ── Order: Item Quantity ───────────────────────────────

  private async handleOrderItemQuantity(session: BotSession, from: string, input: string): Promise<void> {
    const d = session.session_data;
    const qtyLabels = this.getOrderFlowLabels(session);

    // For categories that skip quantity (e.g. church giving), auto-set to 1
    if (qtyLabels.skipQuantity) {
      if (!d.cart) d.cart = [];
      // For church, don't merge — each selection is a separate offering
      d.cart.push({
        item_id: d.order_selected_item_id!,
        name: d.order_selected_item_name!,
        price: d.order_selected_item_price!,
        quantity: 1,
      });
      this.intelligence.resetAbuse(from);
      await this.updateSession(session.id, 'order_add_more', d);
      await this.sendText(from, qtyLabels.addedText(d.order_selected_item_name!));
      await this.handleOrderAddMore(session, from, '');
      return;
    }

    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: `*${d.order_selected_item_name}* — ${formatNaira(d.order_selected_item_price || 0)}\n\nHow many?`,
        buttons: [
          { id: '1', title: '1' },
          { id: '2', title: '2' },
          { id: '3', title: '3' },
        ],
      });
      await this.sendText(from, `Or type a number (1-${ORDER_DEFAULTS.maxItemQuantity}).`);
      return;
    }

    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 1 || qty > ORDER_DEFAULTS.maxItemQuantity) {
      await this.sendText(from, `Please enter a number between 1 and ${ORDER_DEFAULTS.maxItemQuantity}.`);
      return;
    }

    // Initialize cart if needed
    if (!d.cart) d.cart = [];

    // Check cart limit
    const totalItems = d.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (totalItems + qty > ORDER_DEFAULTS.maxCartItems) {
      await this.sendText(from, `Maximum ${ORDER_DEFAULTS.maxCartItems} items. Please proceed or remove items first.`);
      return;
    }

    // Merge into cart (accumulate if same item)
    const existingIndex = d.cart.findIndex(i => i.item_id === d.order_selected_item_id);
    if (existingIndex >= 0) {
      d.cart[existingIndex].quantity += qty;
    } else {
      d.cart.push({
        item_id: d.order_selected_item_id!,
        name: d.order_selected_item_name!,
        price: d.order_selected_item_price!,
        quantity: qty,
      });
    }

    this.intelligence.resetAbuse(from);
    await this.updateSession(session.id, 'order_add_more', d);
    await this.sendText(from, qtyLabels.addedText(d.order_selected_item_name!, qty));
    await this.handleOrderAddMore(session, from, '');
  }

  // ── Order: Add More ───────────────────────────────────

  private async handleOrderAddMore(session: BotSession, from: string, input: string): Promise<void> {
    const cart = session.session_data.cart || [];
    const addLabels = this.getOrderFlowLabels(session);

    if (!input) {
      const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
      const cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      await this.gupshupService.sendButtons({
        to: from,
        body: addLabels.cartSummary(cartCount, cartTotal),
        buttons: [
          { id: 'add_more', title: '➕ Add More' },
          { id: 'view_cart', title: addLabels.viewCartBtn },
          { id: 'checkout', title: addLabels.checkoutBtn },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'add_more') {
      await this.updateStep(session.id, 'order_menu_categories');
      await this.handleOrderMenuCategories(session, from, '');
      return;
    }

    if (response === 'view_cart') {
      await this.updateStep(session.id, 'order_cart_review');
      await this.handleOrderCartReview(session, from, '');
      return;
    }

    if (response === 'checkout') {
      if (cart.length === 0) {
        await this.sendText(from, addLabels.emptyText);
        await this.updateStep(session.id, 'order_menu_categories');
        await this.handleOrderMenuCategories(session, from, '');
        return;
      }
      await this.updateStep(session.id, 'order_type_selection');
      await this.handleOrderTypeSelection(session, from, '');
      return;
    }

    const abuse = await this.handleValidationFailure(from, 'order_add_more', session);
    if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
    await this.sendText(from, abuse.warn ? abuse.message : addLabels.hintBtns);
  }

  // ── Order: Cart Review ────────────────────────────────

  private async handleOrderCartReview(session: BotSession, from: string, input: string): Promise<void> {
    const cart = session.session_data.cart || [];
    const cartLabels = this.getOrderFlowLabels(session);

    if (!input) {
      if (cart.length === 0) {
        await this.sendText(from, cartLabels.emptyText);
        await this.updateStep(session.id, 'order_menu_categories');
        await this.handleOrderMenuCategories(session, from, '');
        return;
      }

      const lines = [cartLabels.cartHeader, ''];
      let subtotal = 0;
      for (const item of cart) {
        const lineTotal = item.price * item.quantity;
        subtotal += lineTotal;
        lines.push(cartLabels.skipQuantity
          ? `${item.name} — ${formatNaira(lineTotal)}`
          : `${item.quantity}x ${item.name} — ${formatNaira(lineTotal)}`);
      }
      lines.push('', `*Total: ${formatNaira(subtotal)}*`);

      await this.sendText(from, lines.join('\n'));
      await this.gupshupService.sendButtons({
        to: from,
        body: 'What would you like to do?',
        buttons: [
          { id: 'checkout', title: cartLabels.checkoutBtn },
          { id: 'add_more', title: '➕ Add More' },
          { id: 'clear_cart', title: cartLabels.clearCartBtn },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'checkout') {
      if (cart.length === 0) {
        await this.sendText(from, cartLabels.emptyText);
        await this.updateStep(session.id, 'order_menu_categories');
        await this.handleOrderMenuCategories(session, from, '');
        return;
      }
      await this.updateStep(session.id, 'order_type_selection');
      await this.handleOrderTypeSelection(session, from, '');
      return;
    }

    if (response === 'add_more') {
      await this.updateStep(session.id, 'order_menu_categories');
      await this.handleOrderMenuCategories(session, from, '');
      return;
    }

    if (response === 'clear_cart') {
      session.session_data.cart = [];
      await this.updateSession(session.id, 'order_menu_categories', session.session_data);
      await this.sendText(from, cartLabels.clearedText);
      await this.handleOrderMenuCategories(session, from, '');
      return;
    }

    const abuse = await this.handleValidationFailure(from, 'order_cart_review', session);
    if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
    await this.sendText(from, abuse.warn ? abuse.message : cartLabels.hintCartBtns);
  }

  // ── Order: Type Selection (pickup/delivery) ───────────

  private async handleOrderTypeSelection(session: BotSession, from: string, input: string): Promise<void> {
    const orderLabels = this.getOrderFlowLabels(session);

    // Auto-skip delivery/instructions for non-physical categories (church, cinema, events)
    if (orderLabels.orderType === 'none') {
      session.session_data.order_type = 'pickup';
      if (orderLabels.specialInstr) {
        await this.updateSession(session.id, 'order_special_instructions', session.session_data);
        await this.handleOrderSpecialInstructions(session, from, '');
      } else {
        await this.updateSession(session.id, 'order_confirm', session.session_data);
        await this.handleOrderConfirm(session, from, '');
      }
      return;
    }

    const deliveryFee = session.session_data.order_delivery_fee;

    if (!input) {
      // If delivery not available, auto-select pickup
      if (deliveryFee === null || deliveryFee === undefined) {
        session.session_data.order_type = 'pickup';
        session.session_data.order_delivery_fee = null;
        await this.updateSession(session.id, 'order_special_instructions', session.session_data);
        await this.sendText(from, '🏃 This restaurant offers *pickup only*.');
        await this.handleOrderSpecialInstructions(session, from, '');
        return;
      }

      const deliveryLabel = deliveryFee === 0 ? 'Free delivery' : `Delivery fee: ${formatNaira(deliveryFee)}`;
      await this.gupshupService.sendButtons({
        to: from,
        body: `How would you like to get your order?\n\n${deliveryLabel}`,
        buttons: [
          { id: 'pickup', title: '🏃 Pickup' },
          { id: 'delivery', title: '🚗 Delivery' },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'pickup') {
      session.session_data.order_type = 'pickup';
      await this.updateSession(session.id, 'order_special_instructions', session.session_data);
      await this.handleOrderSpecialInstructions(session, from, '');
      return;
    }

    if (response === 'delivery') {
      session.session_data.order_type = 'delivery';
      await this.updateSession(session.id, 'order_delivery_address', session.session_data);
      await this.handleOrderDeliveryAddress(session, from, '');
      return;
    }

    const abuse = await this.handleValidationFailure(from, 'order_type_selection', session);
    if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
    await this.sendText(from, abuse.warn ? abuse.message : 'Please tap *Pickup* or *Delivery*.');
  }

  // ── Order: Delivery Address ───────────────────────────

  private async handleOrderDeliveryAddress(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.sendText(from, '📍 Please type your full delivery address:');
      return;
    }

    if (input.trim().length < 10) {
      await this.sendText(from, 'Please provide a more detailed address (at least 10 characters):');
      return;
    }

    session.session_data.delivery_address = input.trim();
    await this.updateSession(session.id, 'order_special_instructions', session.session_data);
    await this.sendText(from, `📍 Delivery to: ${input.trim()}`);
    await this.handleOrderSpecialInstructions(session, from, '');
  }

  // ── Order: Special Instructions ───────────────────────

  private async handleOrderSpecialInstructions(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: 'Any special instructions for your order?',
        buttons: [
          { id: 'no_instructions', title: 'No, proceed' },
        ],
      });
      await this.sendText(from, 'Or type your instructions (e.g. "extra spicy", "no onions"):');
      return;
    }

    if (input.toLowerCase() === 'no_instructions' || input.toLowerCase() === 'skip') {
      session.session_data.order_special_instructions = undefined;
    } else {
      session.session_data.order_special_instructions = input.trim();
    }

    await this.updateSession(session.id, 'order_confirm', session.session_data);
    await this.handleOrderConfirm(session, from, '');
  }

  // ── Order: Confirm ────────────────────────────────────

  private async handleOrderConfirm(session: BotSession, from: string, input: string): Promise<void> {
    const d = session.session_data;
    const cart = d.cart || [];
    const confirmLabels = this.getOrderFlowLabels(session);

    if (!input) {
      const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const deliveryFeeAmount = d.order_type === 'delivery' ? (d.order_delivery_fee || 0) : 0;
      const total = subtotal + deliveryFeeAmount;

      d.order_subtotal = subtotal;
      d.order_total = total;
      await this.updateSession(session.id, 'order_confirm', d);

      const catEmojiMap: Record<string, string> = {
        restaurant: '🍽️', church: '⛪', spa: '💆', gym: '💪', cinema: '🎬', events: '🎫', shop: '🛍️',
        barber: '💈', salon: '💇', beauty: '💄', laundry: '👔', car_wash: '🚗', mechanic: '🔧',
        hotel: '🏨', clinic: '🏥', tutor: '📚', photography: '📸', catering: '🍱', cleaning: '🧹',
        tailor: '🪡', printing: '🖨️', logistics: '🚚', bakery: '🎂', coworking: '🏢',
      };
      const catEmoji = catEmojiMap[this.getSessionCategory(session)] || '📋';
      const lines = [
        `📋 *${confirmLabels.summaryLabel}*`,
        '',
        `${catEmoji} ${d.order_restaurant_name}`,
      ];

      // Only show delivery/pickup line for categories that have it
      if (confirmLabels.deliverySection) {
        lines.push(`📦 ${d.order_type === 'delivery' ? '🚗 Delivery' : '🏃 Pickup'}`);
      }
      lines.push('');

      for (const item of cart) {
        lines.push(confirmLabels.skipQuantity
          ? `${item.name} — ${formatNaira(item.price * item.quantity)}`
          : `${item.quantity}x ${item.name} — ${formatNaira(item.price * item.quantity)}`);
      }

      lines.push('');
      if (confirmLabels.deliverySection) {
        lines.push(`Subtotal: ${formatNaira(subtotal)}`);
        if (deliveryFeeAmount > 0) {
          lines.push(`Delivery: ${formatNaira(deliveryFeeAmount)}`);
        }
      }
      lines.push(`*Total: ${formatNaira(total)}*`);

      if (d.delivery_address) {
        lines.push('', `📍 ${d.delivery_address}`);
      }
      if (d.order_special_instructions) {
        lines.push(`📝 ${d.order_special_instructions}`);
      }

      await this.sendText(from, lines.join('\n'));
      await this.gupshupService.sendButtons({
        to: from,
        body: `Confirm this ${confirmLabels.itemLabel}?`,
        buttons: [
          { id: 'confirm_order', title: '✅ Confirm' },
          { id: 'edit_cart', title: confirmLabels.editCartBtn },
          { id: 'cancel_order', title: '❌ Cancel' },
        ],
      });
      return;
    }

    const response = input.toLowerCase();

    if (response === 'cancel_order' || response === 'cancel') {
      await this.sendText(from, confirmLabels.cancelText);
      await this.deactivateSession(session.id);
      return;
    }

    if (response === 'edit_cart') {
      await this.updateStep(session.id, 'order_cart_review');
      await this.handleOrderCartReview(session, from, '');
      return;
    }

    if (response === 'confirm_order' || response === 'confirm') {
      await this.createFoodOrder(session, from);
      return;
    }

    const abuse = await this.handleValidationFailure(from, 'order_confirm', session);
    if (abuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, abuse.message); return; }
    await this.sendText(from, abuse.warn ? abuse.message : confirmLabels.hintConfirmBtns);
  }

  // ── Order: Collect Name ───────────────────────────────

  private async handleOrderCollectName(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      const nameLabels = this.getOrderFlowLabels(session);
      await this.sendText(from, nameLabels.collectNameText);
      return;
    }

    const parts = input.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    if (!firstName || firstName.length < 2) {
      await this.sendText(from, 'Please enter a valid name (first and last name):');
      return;
    }

    session.session_data.first_name = firstName;
    session.session_data.last_name = lastName;
    await this.updateSession(session.id, 'order_collect_email', session.session_data);

    await this.sendText(from, `Thanks, ${firstName}! 📧 What's your email address?\n\nWe'll send your order confirmation there.`);
  }

  // ── Order: Collect Email ──────────────────────────────

  private async handleOrderCollectEmail(session: BotSession, from: string, input: string): Promise<void> {
    if (!input) {
      await this.gupshupService.sendButtons({
        to: from,
        body: '📧 Please type your email address, or skip:',
        buttons: [
          { id: 'skip_email', title: 'Skip' },
        ],
      });
      return;
    }

    const firstName = session.session_data.first_name || '';
    const lastName = session.session_data.last_name || '';
    let email: string | undefined;

    if (input.toLowerCase() !== 'skip_email' && input.toLowerCase() !== 'skip') {
      email = input.trim().toLowerCase();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await this.sendText(from, 'That doesn\'t look like a valid email. Please try again (e.g. ade@gmail.com) or type *skip*:');
        return;
      }

      session.session_data.email = email;
    }

    // Create the Supabase auth user + profile
    const userId = await this.createWhatsAppUser(from, firstName, lastName, email);

    if (!userId) {
      if (email) {
        this.logger.warn(`User creation failed with email ${email}, retrying without email`);
        const retryUserId = await this.createWhatsAppUser(from, firstName, lastName);

        if (retryUserId) {
          session.user_id = retryUserId;
          await this.supabaseService.getClient()
            .from('bot_sessions')
            .update({ user_id: retryUserId, session_data: session.session_data })
            .eq('id', session.id);

          await this.sendText(from, `Thanks, ${firstName}! 🎉 Let's complete your order.`);
          await this.createFoodOrder(session, from);
          return;
        }
      }

      await this.sendText(from, 'Hmm, that didn\'t work. Please try a different email, or type *skip* to continue without one:');
      return;
    }

    session.user_id = userId;
    await this.supabaseService.getClient()
      .from('bot_sessions')
      .update({ user_id: userId, session_data: session.session_data })
      .eq('id', session.id);

    await this.sendText(from, `Great, ${firstName}! 🎉 Your account is set up.`);
    await this.createFoodOrder(session, from);
  }

  // ── Order: Create Food Order ──────────────────────────

  private async createFoodOrder(session: BotSession, from: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const d = session.session_data;
    const cart = d.cart || [];

    // Get or create user
    let userId = session.user_id;
    if (!userId) {
      const fullPhone = from.startsWith('+') ? from : `+${from}`;
      const rawPhone = from.startsWith('+') ? from.slice(1) : from;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('phone', fullPhone)
        .single();

      if (profile?.id) {
        userId = profile.id;
      } else {
        const { data: profileRaw } = await supabase
          .from('profiles')
          .select('id, first_name')
          .eq('phone', rawPhone)
          .single();
        userId = profileRaw?.id || null;
      }
    }

    if (!userId) {
      // No account — ask for name to create one
      await this.updateSession(session.id, 'order_collect_name', d);
      await this.handleOrderCollectName(session, from, '');
      return;
    }

    const restaurantId = d.order_restaurant_id || session.restaurant_id;
    if (!restaurantId || cart.length === 0) {
      await this.sendText(from, 'Something went wrong. Send *Hi* to start again.');
      await this.deactivateSession(session.id);
      return;
    }

    const subtotal = d.order_subtotal || cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const deliveryFeeAmount = d.order_type === 'delivery' ? (d.order_delivery_fee || 0) : 0;
    const total = d.order_total || subtotal + deliveryFeeAmount;

    // Get customer info
    const phone = from.startsWith('+') ? from : `+${from}`;
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single();

    const customerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || d.first_name || null;

    // INSERT order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        order_type: d.order_type || 'pickup',
        status: 'pending_payment',
        subtotal,
        delivery_fee: deliveryFeeAmount,
        total,
        delivery_address: d.delivery_address || null,
        special_instructions: d.order_special_instructions || null,
        customer_name: customerName,
        customer_phone: phone,
        customer_email: d.email || profile?.email || null,
      })
      .select('id, reference_code')
      .single();

    if (orderError || !order) {
      this.logger.error('Failed to create food order via bot', orderError);
      await this.sendText(from, 'Sorry, something went wrong creating your order. Send *Hi* to try again.');
      await this.deactivateSession(session.id);
      return;
    }

    // INSERT order items (snapshot from cart)
    const orderItems = cart.map(item => ({
      order_id: order.id,
      menu_item_id: item.item_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      this.logger.error('Failed to insert order items', itemsError);
    }

    d.order_id = order.id;
    d.order_reference_code = order.reference_code;

    // Initialize payment
    let userEmail = d.email || profile?.email || undefined;

    const paymentResult = await this.initializeOrderPayment(
      order.id,
      userId,
      total,
      order.reference_code,
      d.order_restaurant_name || 'Restaurant',
      from,
      userEmail,
    );

    if (paymentResult) {
      d.order_payment_reference = paymentResult.reference;
      await this.updateSession(session.id, 'order_payment', d);

      await this.sendText(from, [
        `📋 *Order Created!*`,
        ``,
        `🍽️ ${d.order_restaurant_name}`,
        `📦 ${d.order_type === 'delivery' ? '🚗 Delivery' : '🏃 Pickup'}`,
        `🔑 Ref: *${order.reference_code}*`,
        ``,
        `💳 *Total: ${formatNaira(total)}*`,
        ``,
        `Pay here 👇`,
        paymentResult.url,
      ].join('\n'));

      await this.gupshupService.sendButtons({
        to: from,
        body: `Tap *I've Paid* after completing payment:`,
        buttons: [
          { id: 'i_paid', title: "I've Paid" },
          { id: 'cancel', title: 'Cancel' },
        ],
      });
    } else {
      // Payment init failed
      await this.updateSession(session.id, 'order_complete', d);
      await this.deactivateSession(session.id);

      await this.sendText(from, [
        `📋 *Order Created!*`,
        ``,
        `🍽️ ${d.order_restaurant_name}`,
        `🔑 Ref: *${order.reference_code}*`,
        ``,
        `💳 Total: ${formatNaira(total)}`,
        `Please visit naijadine.com to complete payment.`,
      ].join('\n'));
    }
  }

  // ── Order: Initialize Payment ─────────────────────────

  private async initializeOrderPayment(
    orderId: string,
    userId: string,
    amount: number, // in Naira
    referenceCode: string,
    restaurantName: string,
    phone: string,
    userEmail?: string,
  ): Promise<{ url: string; reference: string } | null> {
    const supabase = this.supabaseService.getClient();
    const idempotencyKey = randomUUID();
    const amountInKobo = amount * 100;
    const email = userEmail || `${phone.replace('+', '')}@whatsapp.naijadine.com`;

    try {
      if (!this.paystackSecretKey) {
        // Dev mode mock
        this.logger.warn('PAYSTACK not set — mock payment for food order');
        const mockRef = `mock_fo_${idempotencyKey}`;

        await supabase.from('payments').insert({
          reservation_id: null,
          order_id: orderId,
          user_id: userId,
          amount,
          currency: 'NGN',
          gateway: 'paystack',
          gateway_reference: mockRef,
          status: 'pending',
          idempotency_key: idempotencyKey,
          metadata: { order_ref: referenceCode, channel: 'whatsapp' },
        });

        return { url: `https://naijadine.com/pay?ref=${mockRef}`, reference: mockRef };
      }

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          metadata: {
            order_id: orderId,
            user_id: userId,
            order_ref: referenceCode,
            channel: 'whatsapp',
            custom_fields: [
              { display_name: 'Restaurant', variable_name: 'restaurant', value: restaurantName },
              { display_name: 'Order Ref', variable_name: 'order_ref', value: referenceCode },
            ],
          },
        }),
      });

      const data = await response.json();

      if (!data.status) {
        this.logger.error('Paystack initialize for food order failed', data);
        return null;
      }

      const { data: payment } = await supabase.from('payments').insert({
        reservation_id: null,
        order_id: orderId,
        user_id: userId,
        amount,
        currency: 'NGN',
        gateway: 'paystack',
        gateway_reference: data.data.reference,
        status: 'pending',
        idempotency_key: idempotencyKey,
        metadata: {
          access_code: data.data.access_code,
          order_ref: referenceCode,
          channel: 'whatsapp',
        },
      }).select().single();

      if (payment) {
        await supabase
          .from('orders')
          .update({ payment_id: payment.id })
          .eq('id', orderId);
      }

      return {
        url: data.data.authorization_url,
        reference: data.data.reference,
      };
    } catch (error) {
      this.logger.error('Paystack init error for food order:', (error as Error).message);
      return null;
    }
  }

  // ── Order: Payment Check ──────────────────────────────

  private async handleOrderPaymentCheck(session: BotSession, from: string, input: string): Promise<void> {
    const text = input.toLowerCase();

    if (text === 'check' || text === 'done' || text === 'paid' || text === 'i_paid' || text === "i've paid") {
      const ref = session.session_data.order_payment_reference;
      if (!ref) {
        await this.sendText(from, 'Something went wrong. Send *Hi* to start over.');
        await this.deactivateSession(session.id);
        return;
      }

      const verified = await this.verifyOrderPayment(ref);

      if (verified) {
        const d = session.session_data;
        const payLabels = this.getOrderFlowLabels(session);
        await this.sendText(from, payLabels.paymentConfirmText(
          d.order_restaurant_name || 'Business',
          d.order_reference_code || '',
        ));

        await this.updateSession(session.id, 'order_complete', d);
        await this.deactivateSession(session.id);
      } else {
        await this.gupshupService.sendButtons({
          to: from,
          body: `Payment not yet received. Please complete payment using the link sent earlier.\n\nTap *I've Paid* after paying, or *Cancel* to cancel.`,
          buttons: [
            { id: 'i_paid', title: "I've Paid" },
            { id: 'cancel', title: 'Cancel' },
          ],
        });
      }
    } else if (text === 'cancel') {
      const supabase = this.supabaseService.getClient();
      if (session.session_data.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'customer' })
          .eq('id', session.session_data.order_id);
      }
      const cancelLabels = this.getOrderFlowLabels(session);
      await this.sendText(from, cancelLabels.cancelText);
      await this.deactivateSession(session.id);
    } else {
      await this.gupshupService.sendButtons({
        to: from,
        body: `Please complete your payment using the link sent above.\n\nTap *I've Paid* after paying, or *Cancel* to cancel.`,
        buttons: [
          { id: 'i_paid', title: "I've Paid" },
          { id: 'cancel', title: 'Cancel' },
        ],
      });
    }
  }

  // ── Order: Verify Payment ─────────────────────────────

  private async verifyOrderPayment(reference: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();

    // Handle mock payments (dev mode)
    if (!this.paystackSecretKey || reference.startsWith('mock_')) {
      await supabase
        .from('payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('gateway_reference', reference);

      const { data: payment } = await supabase
        .from('payments')
        .select('order_id')
        .eq('gateway_reference', reference)
        .single();

      if (payment?.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', payment.order_id);
      }
      return true;
    }

    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${this.paystackSecretKey}` } },
      );

      const data = await response.json();
      this.logger.log(`Paystack verify for food order ${reference}: status=${data?.data?.status}`);

      if (data?.data?.status === 'success') {
        const { data: payment } = await supabase
          .from('payments')
          .select('id, order_id, amount')
          .eq('gateway_reference', reference)
          .single();

        if (payment) {
          const webhookAmountKobo = data.data.amount as number;
          const expectedKobo = payment.amount * 100;

          if (webhookAmountKobo !== expectedKobo) {
            this.logger.error(`Order amount mismatch: paystack=${webhookAmountKobo}, expected=${expectedKobo}`);
            return false;
          }

          const authorization = data.data.authorization as Record<string, string> | undefined;
          await supabase
            .from('payments')
            .update({
              status: 'success',
              gateway_status: 'success',
              payment_method: (data.data.channel as string) || 'card',
              card_last_four: authorization?.last4 || null,
              card_brand: authorization?.brand || null,
              paid_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

          if (payment.order_id) {
            await supabase
              .from('orders')
              .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
              .eq('id', payment.order_id);
          }
        }
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Paystack verify error for food order:', (error as Error).message);
      return false;
    }
  }

  // ── Category-Aware Order Flow Labels ─────────────────────

  private getOrderFlowLabels(session: BotSession) {
    const category = this.getSessionCategory(session);
    switch (category) {
      case 'church':
        return {
          menuTitle: 'Giving Options', browseBtn: 'Browse Options', menuBody: 'Choose a giving category:',
          itemLabel: 'offering', noItems: 'No giving options available right now.',
          orderType: 'none' as const, specialInstr: false,
          summaryLabel: 'Offering Summary', deliverySection: false,
          // Cart & flow labels
          selectItemBody: 'Select an offering amount:', chooseItemBtn: 'Choose',
          skipQuantity: true, // always 1 for church — no "how many tithes?"
          addedText: (name: string, _qty?: number) => `🙏 *${name}* selected ✓`,
          cartSummary: (count: number, total: number) => `🙏 ${count} offering${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🙏 *Your Offerings*',
          viewCartBtn: '🙏 View Offerings', checkoutBtn: '✅ Proceed',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit',
          emptyText: 'No offerings selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your offering, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Offering Received!*\n\nThank you for your giving to *${name}*.\n🔑 Ref: *${ref}*\n\nGod bless you! 🙏`,
          hintBtns: 'Please tap *Add More*, *View Offerings*, or *Proceed*.',
          hintCartBtns: 'Please tap *Proceed*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit*, or *Cancel*.',
        };
      case 'cinema':
        return {
          menuTitle: 'Now Showing', browseBtn: 'See Movies', menuBody: 'What would you like to see?',
          itemLabel: 'ticket', noItems: 'No movies showing right now.',
          orderType: 'none' as const, specialInstr: false,
          summaryLabel: 'Ticket Summary', deliverySection: false,
          selectItemBody: 'Select a ticket type:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* ✓`,
          cartSummary: (count: number, total: number) => `🎬 ${count} ticket${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🎬 *Your Tickets*',
          viewCartBtn: '🎬 View Tickets', checkoutBtn: '✅ Proceed',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit',
          emptyText: 'No tickets selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your booking, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Tickets Confirmed!*\n\nYour tickets at *${name}* are booked.\n🔑 Ref: *${ref}*\n\nEnjoy the show! 🎬`,
          hintBtns: 'Please tap *Add More*, *View Tickets*, or *Proceed*.',
          hintCartBtns: 'Please tap *Proceed*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit*, or *Cancel*.',
        };
      case 'events':
        return {
          menuTitle: 'Upcoming Events', browseBtn: 'Browse Events', menuBody: 'Browse upcoming events:',
          itemLabel: 'ticket', noItems: 'No events available right now.',
          orderType: 'none' as const, specialInstr: false,
          summaryLabel: 'Ticket Summary', deliverySection: false,
          selectItemBody: 'Select a ticket type:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* ✓`,
          cartSummary: (count: number, total: number) => `🎫 ${count} ticket${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🎫 *Your Tickets*',
          viewCartBtn: '🎫 View Tickets', checkoutBtn: '✅ Proceed',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit',
          emptyText: 'No tickets selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your booking, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Tickets Confirmed!*\n\nYour tickets for *${name}* are booked.\n🔑 Ref: *${ref}*\n\nSee you there! 🎉`,
          hintBtns: 'Please tap *Add More*, *View Tickets*, or *Proceed*.',
          hintCartBtns: 'Please tap *Proceed*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit*, or *Cancel*.',
        };
      case 'shop':
        return {
          menuTitle: 'Product Categories', browseBtn: 'Browse Products', menuBody: 'Browse our products:',
          itemLabel: 'item', noItems: 'No products available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select an item to add:', chooseItemBtn: 'Choose Item',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to cart ✓`,
          cartSummary: (count: number, total: number) => `🛒 Cart: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🛒 *Your Cart*',
          viewCartBtn: '🛒 View Cart', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear Cart', editCartBtn: '✏️ Edit Cart',
          emptyText: 'Your cart is empty! Let\'s add some items.', clearedText: '🗑️ Cart cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 🎉`,
          hintBtns: 'Please tap *Add More*, *View Cart*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear Cart*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Cart*, or *Cancel*.',
        };
      case 'beauty':
        return {
          menuTitle: 'Beauty Products', browseBtn: 'Browse Products', menuBody: 'Browse our beauty products:',
          itemLabel: 'item', noItems: 'No products available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select a product:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to cart ✓`,
          cartSummary: (count: number, total: number) => `💄 Cart: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '💄 *Your Cart*',
          viewCartBtn: '💄 View Cart', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear Cart', editCartBtn: '✏️ Edit Cart',
          emptyText: 'Your cart is empty! Let\'s add some items.', clearedText: '🗑️ Cart cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 💄`,
          hintBtns: 'Please tap *Add More*, *View Cart*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear Cart*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Cart*, or *Cancel*.',
        };
      case 'laundry':
        return {
          menuTitle: 'Laundry Services', browseBtn: 'Browse Services', menuBody: 'Choose a laundry service:',
          itemLabel: 'item', noItems: 'No services available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select a service:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `👔 Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '👔 *Your Order*',
          viewCartBtn: '👔 View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour laundry order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 👔`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      case 'catering':
        return {
          menuTitle: 'Catering Menu', browseBtn: 'Browse Menu', menuBody: 'Browse our catering options:',
          itemLabel: 'item', noItems: 'No catering options available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select an item:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `🍱 Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🍱 *Your Order*',
          viewCartBtn: '🍱 View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour catering order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll be in touch! 🍱`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      case 'tailor':
        return {
          menuTitle: 'Our Styles', browseBtn: 'Browse Styles', menuBody: 'Browse our styles:',
          itemLabel: 'item', noItems: 'No styles available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select a style:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `🪡 Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🪡 *Your Order*',
          viewCartBtn: '🪡 View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 🪡`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      case 'printing':
        return {
          menuTitle: 'Print Services', browseBtn: 'Browse Services', menuBody: 'Browse our print services:',
          itemLabel: 'item', noItems: 'No print services available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select a product:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `🖨️ Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🖨️ *Your Order*',
          viewCartBtn: '🖨️ View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour print order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 🖨️`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      case 'logistics':
        return {
          menuTitle: 'Delivery Options', browseBtn: 'Browse Packages', menuBody: 'Choose a delivery option:',
          itemLabel: 'item', noItems: 'No delivery options available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select an option:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `🚚 Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🚚 *Your Order*',
          viewCartBtn: '🚚 View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour dispatch at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll keep you updated. 🚚`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      case 'bakery':
        return {
          menuTitle: 'Our Bakery', browseBtn: 'Browse Menu', menuBody: 'Browse our baked goods:',
          itemLabel: 'item', noItems: 'No items available right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select an item:', chooseItemBtn: 'Choose',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to order ✓`,
          cartSummary: (count: number, total: number) => `🎂 Order: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🎂 *Your Order*',
          viewCartBtn: '🎂 View Order', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear All', editCartBtn: '✏️ Edit Order',
          emptyText: 'No items selected yet.', clearedText: '🗑️ Cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Order Confirmed!*\n\nYour order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 🎂`,
          hintBtns: 'Please tap *Add More*, *View Order*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear All*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Order*, or *Cancel*.',
        };
      default: // restaurant (food ordering)
        return {
          menuTitle: 'Menu Categories', browseBtn: 'Browse Menu', menuBody: 'Browse the menu:',
          itemLabel: 'item', noItems: 'No menu items available at this restaurant right now.',
          orderType: 'show' as const, specialInstr: true,
          summaryLabel: 'Order Summary', deliverySection: true,
          selectItemBody: 'Select an item to add:', chooseItemBtn: 'Choose Item',
          skipQuantity: false,
          addedText: (name: string, qty?: number) => `Added ${qty || 1}x *${name}* to cart ✓`,
          cartSummary: (count: number, total: number) => `🛒 Cart: ${count} item${count !== 1 ? 's' : ''} — ${formatNaira(total)}`,
          cartHeader: '🛒 *Your Cart*',
          viewCartBtn: '🛒 View Cart', checkoutBtn: '✅ Checkout',
          clearCartBtn: '🗑️ Clear Cart', editCartBtn: '✏️ Edit Cart',
          emptyText: 'Your cart is empty! Let\'s add some items.', clearedText: '🗑️ Cart cleared! Let\'s start fresh.',
          cancelText: 'Order cancelled. Send *Hi* to start again anytime!',
          collectNameText: 'To complete your order, I need your name.\n\nPlease type your *full name* (e.g. Ade Johnson):',
          paymentConfirmText: (name: string, ref: string) => `✅ *Payment Confirmed!*\n\nYour order at *${name}* is confirmed!\n🔑 Ref: *${ref}*\n\nWe'll notify you when it's ready. 🎉`,
          hintBtns: 'Please tap *Add More*, *View Cart*, or *Checkout*.',
          hintCartBtns: 'Please tap *Checkout*, *Add More*, or *Clear Cart*.',
          hintConfirmBtns: 'Please tap *Confirm*, *Edit Cart*, or *Cancel*.',
        };
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Handle a validation failure: record gibberish + track retries.
   * After 3 failures on the same step, automatically sends contextual help.
   * Returns the abuse result (caller should check timeout/warn as usual).
   */
  private async handleValidationFailure(
    from: string,
    step: string,
    session: BotSession,
  ): Promise<AbuseResult> {
    const abuse = this.intelligence.recordGibberish(from);

    // Track retries for auto-help
    const retry = this.intelligence.recordValidationFailure(from, step);
    if (retry.showHelp && !abuse.timeout && !abuse.warn) {
      const helpText = this.intelligence.getContextualHelp(step);
      await this.sendText(from, `💡 *Need help?*\n${helpText}\n\nOr type *help* for all options.`);
    }

    return abuse;
  }

  private getSessionCategory(session: BotSession): BusinessCategory {
    return (session.session_data.business_category as BusinessCategory) || 'restaurant';
  }

  private async resolveCategory(restaurantId: string): Promise<BusinessCategory> {
    const { data } = await this.supabaseService.getClient()
      .from('restaurants')
      .select('business_category')
      .eq('id', restaurantId)
      .single();
    return (data?.business_category as BusinessCategory) || 'restaurant';
  }

  private async getActiveSession(phone: string): Promise<BotSession | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('bot_sessions')
      .select('*')
      .eq('whatsapp_number', phone)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return (data as BotSession) || null;
  }

  private async updateStep(sessionId: string, step: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('bot_sessions')
      .update({ current_step: step })
      .eq('id', sessionId);
  }

  private async updateSession(sessionId: string, step: string, data: SessionData): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('bot_sessions')
      .update({ current_step: step, session_data: data })
      .eq('id', sessionId);
  }

  private async deactivateSession(sessionId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('bot_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
  }

  private async lookupBotCode(text: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const upperText = text.toUpperCase().trim();

    const FILLER_WORDS = new Set([
      'HI', 'HELLO', 'HEY', 'YO', 'SUP', 'HIYA', 'HOWDY',
      'GOOD', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT',
      'BOOK', 'BOOKING', 'RESERVE', 'RESERVATION', 'TABLE', 'ORDER',
      'I', 'WANT', 'NEED', 'WOULD', 'LIKE', 'TO', 'A', 'AT', 'THE', 'FOR',
      'PLEASE', 'PLS', 'PLZ', 'THANKS', 'THANK', 'YOU',
      'DUDE', 'BRO', 'SIS', 'ABEG', 'BIKO', 'JO',
      'CAN', 'ME', 'MY', 'GET', 'MAKE', 'HELP',
    ]);

    // 1. Exact match
    if (/^[A-Z0-9-]{2,30}$/.test(upperText)) {
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('bot_code', upperText)
        .in('status', ['active', 'approved'])
        .maybeSingle();
      if (data?.id) return data.id;
    }

    // 2. Hyphenated token match
    const tokens = upperText.split(/\s+/);
    const hyphenated = tokens.filter(t => t.includes('-') && /^[A-Z0-9-]{2,30}$/.test(t));
    for (const candidate of hyphenated) {
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('bot_code', candidate)
        .in('status', ['active', 'approved'])
        .maybeSingle();
      if (data?.id) return data.id;
    }

    // 3. Strip filler words
    const meaningful = tokens.filter(t => !FILLER_WORDS.has(t) && t.length > 0);
    if (meaningful.length > 0 && meaningful.length <= 5) {
      const candidate = meaningful.join('-').replace(/-+/g, '-').slice(0, 30);
      if (/^[A-Z0-9-]{2,30}$/.test(candidate)) {
        const { data } = await supabase
          .from('restaurants')
          .select('id')
          .eq('bot_code', candidate)
          .in('status', ['active', 'approved'])
          .maybeSingle();
        if (data?.id) return data.id;
      }
    }

    return null;
  }

  private async sendText(to: string, text: string): Promise<void> {
    await this.gupshupService.sendText({ to, text });
  }
}
