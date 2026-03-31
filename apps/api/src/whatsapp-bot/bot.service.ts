import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import { GupshupService } from '../notifications/channels/gupshup.service';
import { ResendEmailService } from '../notifications/channels/resend.service';
import { StandaloneService } from './standalone.service';
import { BotIntelligenceService } from './bot-intelligence.service';
import { CITIES, CUISINE_TYPES, BOOKING_DEFAULTS, generateTimeSlots } from '@naijadine/shared';
import { randomUUID } from 'crypto';

type BotStep =
  | 'greeting'
  | 'quick_rebook'
  | 'city_selection'
  | 'neighborhood_selection'
  | 'restaurant_selection'
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
  | 'complete';

interface SessionData {
  city?: string;
  neighborhood?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  restaurant_slug?: string;
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
      const abuse = this.intelligence.recordProfanity(from);
      if (abuse.timeout) {
        // Deactivate session before blocking
        const existingSession = await this.getActiveSession(from);
        if (existingSession) await this.deactivateSession(existingSession.id);
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

    // Check for restart keywords (fixed: use word boundary to avoid matching "history", "help" etc.)
    // Skip restart detection on free-text steps so "Hi" can be typed as a name
    const currentStep = session?.current_step || '';
    const isFreeTextStep = ['collect_name', 'collect_other_name', 'collect_email', 'special_requests', 'review_text'].includes(currentStep);
    const isRestart = !isFreeTextStep && (
      /^(start|restart)$/i.test(text) ||
      (this.intelligence.detectIntent(text, 'greeting')?.intent === 'greeting')
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
      // Handles: "BUKKA-HUT", "book BUKKA-HUT", "hi I want to reserve at BUKKA-HUT", etc.
      if (!restaurantId) {
        const upperText = text.toUpperCase().trim();

        // Common filler words people type before/after a bot code
        const FILLER_WORDS = new Set([
          'HI', 'HELLO', 'HEY', 'YO', 'SUP', 'HIYA', 'HOWDY',
          'GOOD', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT',
          'BOOK', 'BOOKING', 'RESERVE', 'RESERVATION', 'TABLE', 'ORDER',
          'I', 'WANT', 'NEED', 'WOULD', 'LIKE', 'TO', 'A', 'AT', 'THE', 'FOR',
          'PLEASE', 'PLS', 'PLZ', 'THANKS', 'THANK', 'YOU',
          'DUDE', 'BRO', 'SIS', 'ABEG', 'BIKO', 'JO',
          'CAN', 'ME', 'MY', 'GET', 'MAKE', 'HELP',
        ]);

        // 1. Exact match — whole message is the bot_code
        if (/^[A-Z0-9-]{2,30}$/.test(upperText)) {
          const { data: codeMatch } = await supabase
            .from('restaurants')
            .select('id')
            .eq('bot_code', upperText)
            .in('status', ['active', 'approved'])
            .maybeSingle();
          if (codeMatch) restaurantId = codeMatch.id;
        }

        // 2. Hyphenated token match — pick out hyphenated words (most bot codes have hyphens)
        if (!restaurantId) {
          const tokens = upperText.split(/\s+/);
          const hyphenated = tokens.filter(t => t.includes('-') && /^[A-Z0-9-]{2,30}$/.test(t));
          for (const candidate of hyphenated) {
            const { data: codeMatch } = await supabase
              .from('restaurants')
              .select('id')
              .eq('bot_code', candidate)
              .in('status', ['active', 'approved'])
              .maybeSingle();
            if (codeMatch) { restaurantId = codeMatch.id; break; }
          }
        }

        // 3. Strip filler words — join remaining tokens and check as bot_code
        //    e.g. "book BUKKA HUT please" → "BUKKA-HUT"
        if (!restaurantId) {
          const tokens = upperText.split(/\s+/);
          const meaningful = tokens.filter(t => !FILLER_WORDS.has(t) && t.length > 0);
          if (meaningful.length > 0 && meaningful.length <= 5) {
            const candidate = meaningful.join('-').replace(/-+/g, '-').slice(0, 30);
            if (/^[A-Z0-9-]{2,30}$/.test(candidate)) {
              const { data: codeMatch } = await supabase
                .from('restaurants')
                .select('id')
                .eq('bot_code', candidate)
                .in('status', ['active', 'approved'])
                .maybeSingle();
              if (codeMatch) restaurantId = codeMatch.id;
            }
          }
        }
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
          current_step: restaurantId ? 'date_selection' : 'greeting',
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
        // Standalone bot — load restaurant name and skip to date
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, slug')
          .eq('id', restaurantId)
          .single();

        if (restaurant) {
          session.session_data.restaurant_name = restaurant.name;
          session.session_data.restaurant_slug = restaurant.slug;
          await supabase
            .from('bot_sessions')
            .update({ session_data: session.session_data })
            .eq('id', session.id);
        }

        // Use custom greeting template (white-label support) with optional alias persona
        const templates = await this.standaloneService.getBotTemplates(restaurantId);
        const tierInfo = await this.standaloneService.checkTierLimits(restaurantId);
        const botAlias = await this.standaloneService.getBotAlias(restaurantId);

        let greeting: string;
        if (botAlias) {
          greeting = this.intelligence.getPersonaGreeting(botAlias, restaurant?.name || 'our restaurant');
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
        await this.handleDateSelection(session, from, '');
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
    const detectedIntent = this.intelligence.detectIntent(text, step);

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
        await this.sendText(from, this.intelligence.getHelpText(isStandalone, restaurantName, alias || undefined));
        // Also remind them where they are
        const helpNudge = this.intelligence.getContextualHelp(step);
        await this.sendText(from, `📍 You're currently at: *${step.replace(/_/g, ' ')}*\n${helpNudge}`);
        return;
      }

      if (detectedIntent.action === 'acknowledge') {
        await this.sendText(from, detectedIntent.response!);
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
      const cityAbuse = this.intelligence.recordGibberish(from);
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
      const areaAbuse = this.intelligence.recordGibberish(from);
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
      .select('id, name, slug, cover_photo_url')
      .eq('slug', input.toLowerCase().replace(/\s+/g, '-'))
      .single();

    if (!restaurant) {
      // Try matching by name
      const { data: byName } = await supabase
        .from('restaurants')
        .select('id, name, slug, cover_photo_url')
        .ilike('name', `%${input}%`)
        .eq('city', session.session_data.city!)
        .in('status', ['active', 'approved'])
        .limit(1)
        .single();

      if (!byName) {
        const restAbuse = this.intelligence.recordGibberish(from);
        if (restAbuse.timeout) { await this.deactivateSession(session.id); await this.sendText(from, restAbuse.message); return; }
        await this.sendText(from, restAbuse.warn ? restAbuse.message : "I didn't catch that. Please tap one of the restaurant options.");
        return;
      }

      session.session_data.restaurant_id = byName.id;
      session.session_data.restaurant_name = byName.name;
      session.session_data.restaurant_slug = byName.slug;

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
        const dateAbuse = this.intelligence.recordGibberish(from);
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
      const timeAbuse = this.intelligence.recordGibberish(from);
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
        `👥 ${d.party_size} guest${d.party_size! > 1 ? 's' : ''}`,
      ];

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

    const confirmAbuse = this.intelligence.recordGibberish(from);
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

    const otherAbuse = this.intelligence.recordGibberish(from);
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

    try {
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

        // Try lookup by phone first
        const { data: byPhone } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', fullPhone)
          .single();

        if (byPhone?.id) {
          if (email) {
            await supabase
              .from('profiles')
              .update({ email, first_name: firstName, last_name: lastName })
              .eq('id', byPhone.id);
          }
          return byPhone.id;
        }

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

      // Even on exception, try a simple phone lookup before giving up
      try {
        const { data: fallback } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', fullPhone)
          .single();
        if (fallback?.id) return fallback.id;
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
      const phone = from.startsWith('+') ? from : `+${from}`;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('phone', phone)
        .single();

      userId = profile?.id || null;
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
    const totalDeposit = depositPerGuest * d.party_size!;

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

    const modifyAbuse = this.intelligence.recordGibberish(from);
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

  // ── Helpers ──────────────────────────────────────────────

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

  private async sendText(to: string, text: string): Promise<void> {
    await this.gupshupService.sendText({ to, text });
  }
}
