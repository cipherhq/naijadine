import { Injectable } from '@nestjs/common';

// ── Types ──────────────────────────────────────────────

export type BusinessCategory =
  | 'restaurant'
  | 'church'
  | 'gym'
  | 'cinema'
  | 'spa'
  | 'events'
  | 'shop'
  | 'barber'
  | 'salon'
  | 'beauty'
  | 'laundry'
  | 'car_wash'
  | 'mechanic'
  | 'hotel'
  | 'clinic'
  | 'tutor'
  | 'photography'
  | 'catering'
  | 'cleaning'
  | 'tailor'
  | 'printing'
  | 'logistics'
  | 'bakery'
  | 'coworking'
  | 'other';

export type BotIntent =
  | 'greeting'
  | 'help'
  | 'booking'
  | 'cancel'
  | 'status'
  | 'order'
  | 'menu'
  | 'pricing'
  | 'hours'
  | 'location'
  | 'thanks';

interface IntentRule {
  intent: BotIntent;
  patterns: RegExp[];
  /** Step to navigate to, or null for info-only response */
  action: string | null;
  response: string | null;
}

export interface IntentResult {
  intent: BotIntent;
  action: string | null;
  response: string | null;
}

export interface AbuseResult {
  timeout: boolean;
  warn: boolean;
  message: string;
}

interface AbuseRecord {
  gibberishCount: number;
  profanityCount: number;
  lastGibberish: number;
  lastProfanity: number;
  cooldownUntil: number;
}

interface ValidationRetryRecord {
  stepId: string;
  failureCount: number;
  lastFailure: number;
}

// ── Category labels & emoji ────────────────────────────

const CATEGORY_LABELS: Record<BusinessCategory, { emoji: string; noun: string; action: string; plural: string }> = {
  restaurant:  { emoji: '🍽️', noun: 'reservation', action: 'Book', plural: 'reservations' },
  church:      { emoji: '⛪', noun: 'payment', action: 'Pay', plural: 'payments' },
  gym:         { emoji: '🏋️', noun: 'session', action: 'Book', plural: 'sessions' },
  cinema:      { emoji: '🎬', noun: 'ticket', action: 'Buy', plural: 'tickets' },
  spa:         { emoji: '💆', noun: 'appointment', action: 'Book', plural: 'appointments' },
  events:      { emoji: '🎉', noun: 'ticket', action: 'Buy', plural: 'tickets' },
  shop:        { emoji: '🛍️', noun: 'order', action: 'Order', plural: 'orders' },
  barber:      { emoji: '💈', noun: 'appointment', action: 'Book', plural: 'appointments' },
  salon:       { emoji: '💇', noun: 'appointment', action: 'Book', plural: 'appointments' },
  beauty:      { emoji: '💄', noun: 'order', action: 'Order', plural: 'orders' },
  laundry:     { emoji: '👔', noun: 'order', action: 'Order', plural: 'orders' },
  car_wash:    { emoji: '🚗', noun: 'appointment', action: 'Book', plural: 'appointments' },
  mechanic:    { emoji: '🔧', noun: 'appointment', action: 'Book', plural: 'appointments' },
  hotel:       { emoji: '🏨', noun: 'booking', action: 'Book', plural: 'bookings' },
  clinic:      { emoji: '🏥', noun: 'appointment', action: 'Book', plural: 'appointments' },
  tutor:       { emoji: '📚', noun: 'session', action: 'Book', plural: 'sessions' },
  photography: { emoji: '📸', noun: 'session', action: 'Book', plural: 'sessions' },
  catering:    { emoji: '🍱', noun: 'order', action: 'Order', plural: 'orders' },
  cleaning:    { emoji: '🧹', noun: 'appointment', action: 'Book', plural: 'appointments' },
  tailor:      { emoji: '🪡', noun: 'order', action: 'Order', plural: 'orders' },
  printing:    { emoji: '🖨️', noun: 'order', action: 'Order', plural: 'orders' },
  logistics:   { emoji: '🚚', noun: 'order', action: 'Order', plural: 'orders' },
  bakery:      { emoji: '🎂', noun: 'order', action: 'Order', plural: 'orders' },
  coworking:   { emoji: '🏢', noun: 'booking', action: 'Book', plural: 'bookings' },
  other:       { emoji: '📋', noun: 'booking', action: 'Book', plural: 'bookings' },
};

// ── Category-aware profanity responses (first offense) ─

const PROFANITY_RESPONSES: Record<BusinessCategory, string[]> = {
  restaurant: [
    "Hangry? I get it! Let me help you find a table instead. 🍽️",
    "I understand the frustration. Let me help you book a great meal. 😊",
    "Let's channel that energy into finding you amazing food! 🍛",
  ],
  church: [
    "God loves a cheerful giver, friend. Let me help you with your offering. ⛪",
    "Grace and peace! Let me help you with what you need. 🙏",
    "Let's keep the spirit positive! How can I assist you today? ⛪",
  ],
  gym: [
    "Channel that energy into a workout! Let me help you book a session. 🏋️",
    "Save the intensity for the gym floor! How can I help you? 💪",
    "That's some energy! Let's put it towards booking your next session. 🏋️",
  ],
  cinema: [
    "Let's keep it rated G! I'm here to get you tickets. 🎬",
    "Save the drama for the big screen! How can I help? 🎬",
    "Plot twist: I'm here to help, not argue! Let me get you sorted. 🍿",
  ],
  spa: [
    "Sounds like you need a spa day more than ever! Let me help you book one. 💆",
    "Deep breaths... I'm here to help you relax. Let's book an appointment. 🧘",
    "Let's turn that stress into serenity! How can I help? 💆",
  ],
  events: [
    "Let's keep the vibe positive! I'm here to get you into an amazing event. 🎉",
    "Save the energy for the event! How can I help you get tickets? 🎟️",
    "I understand the frustration. Let me help you get sorted! 🎉",
  ],
  shop: [
    "Retail therapy might be just what you need! Let me help you shop. 🛍️",
    "I get it. Let me help you find what you're looking for instead. 🛒",
    "Let's turn that frown around with some great finds! 🛍️",
  ],
  barber: [
    "Easy there! Let me help you book a fresh cut instead. 💈",
    "Save that energy for the barber chair! How can I help? 💈",
    "Let's get you looking sharp! What service do you need? 💈",
  ],
  salon: [
    "Let's channel that into a glow-up! How can I help you book? 💇",
    "Deep breaths! Let me help you book your hair appointment. 💇",
    "Let's get you looking fabulous instead! What do you need? 💇",
  ],
  beauty: [
    "Retail therapy might help! Let me help you find what you need. 💄",
    "Let's focus on finding you something beautiful instead! 💄",
    "I'm here to help you shop. What can I find for you? 💄",
  ],
  laundry: [
    "Let's clean up this conversation! How can I help with your laundry? 👔",
    "Fresh start? Let me help you get your clothes sorted. 👔",
    "Let's keep things fresh! What laundry service do you need? 👔",
  ],
  car_wash: [
    "Let's wash away that frustration! How can I help? 🚗",
    "Time for a clean start! Let me help you book a wash. 🚗",
    "Let's get your ride sparkling instead! What do you need? 🚗",
  ],
  mechanic: [
    "Let's fix the real problem! How can I help with your car? 🔧",
    "Save that energy — let me help you book a service. 🔧",
    "I'm here to help get things running smooth! What do you need? 🔧",
  ],
  hotel: [
    "Sounds like you need a good rest! Let me help you book a room. 🏨",
    "Let's find you a comfortable stay instead! 🏨",
    "I'm here to help you relax. What room are you looking for? 🏨",
  ],
  clinic: [
    "I want to help you feel better! Let me book your appointment. 🏥",
    "Let's focus on your health. How can I help? 🏥",
    "I'm here to help! What medical service do you need? 🏥",
  ],
  tutor: [
    "Let's channel that into learning! How can I help you book? 📚",
    "Knowledge is power! Let me help you book a session. 📚",
    "Let's focus on growth! What subject do you need help with? 📚",
  ],
  photography: [
    "Let's capture something positive! How can I help? 📸",
    "Say cheese, not that! Let me help you book a session. 📸",
    "Let's focus on the big picture! What do you need? 📸",
  ],
  catering: [
    "Let's feed the good vibes! How can I help with your order? 🍱",
    "Good food fixes everything! Let me help you get sorted. 🍱",
    "Let's plan something delicious instead! What do you need? 🍱",
  ],
  cleaning: [
    "Let's clean up this conversation! How can I help? 🧹",
    "Fresh start? Let me help you book a cleaning. 🧹",
    "I'm here to help things sparkle! What do you need? 🧹",
  ],
  tailor: [
    "Let's stitch things together! How can I help with your order? 🪡",
    "Let me help you look sharp instead! What do you need? 🪡",
    "I'm here to help you get fitted! What are you looking for? 🪡",
  ],
  printing: [
    "Let's make a good impression! How can I help? 🖨️",
    "Let me help you get your prints sorted instead. 🖨️",
    "I'm here to help! What do you need printed? 🖨️",
  ],
  logistics: [
    "Let's deliver something positive! How can I help? 🚚",
    "I'm here to get things moving! What do you need? 🚚",
    "Let me help you with your delivery instead. 🚚",
  ],
  bakery: [
    "Have something sweet instead! Let me help you order. 🎂",
    "Sugar fixes everything! What can I get for you? 🎂",
    "Let's bake this right! How can I help? 🎂",
  ],
  coworking: [
    "Let's find you a productive space! How can I help? 🏢",
    "Channel that energy into work! Let me book you a spot. 🏢",
    "I'm here to help you find the right space. What do you need? 🏢",
  ],
  other: [
    "I understand you may be frustrated. I'm here to help! 😊",
    "Let's keep things friendly. What can I assist you with? 🙏",
    "I'm on your side! Let me help you get what you need. 😊",
  ],
};

// ── Category-aware intent responses ────────────────────

function getMenuResponse(category: BusinessCategory): string {
  switch (category) {
    case 'restaurant': return 'You can check the menu once you select a restaurant. 🍽️';
    case 'church':     return 'You can see available services once we get started. ⛪';
    case 'gym':        return 'You can browse available classes once you start booking. 🏋️';
    case 'cinema':     return "You'll see what's showing once we get started. 🎬";
    case 'spa':        return 'You can browse our treatments once you start booking. 💆';
    case 'events':     return 'You can browse available events once we get started. 🎉';
    case 'shop':       return 'You can browse our catalog once you start your order. 🛍️';
    default:           return 'You can browse options once we get started. 📋';
  }
}

function getPricingResponse(category: BusinessCategory): string {
  switch (category) {
    case 'restaurant': return 'Deposit amounts vary by restaurant. Most are free to book! 💰';
    case 'church':     return 'You can choose your own amount when you pay. ⛪';
    case 'gym':        return 'Pricing varies by session type. Most require no deposit! 💰';
    case 'cinema':     return 'Ticket prices depend on the showing and seat type. 🎬';
    case 'spa':        return 'Pricing varies by service. Most require no deposit! 💰';
    case 'events':     return 'Ticket prices vary by event. Let me help you find one! 🎟️';
    case 'shop':       return "Pricing depends on the items. Let's start browsing! 🛍️";
    default:           return 'Pricing varies. Let me help you find details! 💰';
  }
}

function getHoursResponse(category: BusinessCategory): string {
  switch (category) {
    case 'restaurant': return "Opening hours depend on the restaurant. Let's pick one first! 🕐";
    case 'church':     return "Service times vary. Let's get you the schedule! ⛪";
    case 'gym':        return "Hours vary by location. Let's find one for you! 🕐";
    case 'cinema':     return "Showtimes depend on the movie. Let's check! 🎬";
    case 'spa':        return "Appointment times vary by treatment. Let's find a slot for you! 💆";
    case 'events':     return "Event times vary. Let's find the one you want! 🕐";
    case 'shop':       return "Store hours vary by location. Let's find one! 🕐";
    default:           return "Hours vary. Let's get you the details! 🕐";
  }
}

function getLocationResponse(category: BusinessCategory): string {
  switch (category) {
    case 'restaurant': return "I'll send directions after you book! Let's get you a table first. 📍";
    case 'church':     return "I'll send directions after you're set up! 📍";
    case 'gym':        return "I'll send directions after you book your session! 📍";
    case 'cinema':     return "I'll send directions after you buy your tickets! 📍";
    case 'spa':        return "I'll send directions after you book your appointment! 📍";
    case 'events':     return "I'll send directions after you get your tickets! 📍";
    case 'shop':       return "I'll send the location once you're ready! 📍";
    default:           return "I'll send directions once we're set! 📍";
  }
}

function getBookingResponse(category: BusinessCategory): string {
  switch (category) {
    case 'restaurant': return "Let's find you a table! 🍽️";
    case 'church':     return "Let's get your offering set up! ⛪";
    case 'gym':        return "Let's book you a session! 🏋️";
    case 'cinema':     return "Let's get you some tickets! 🎬";
    case 'spa':        return "Let's book your appointment! 💆";
    case 'events':     return "Let's find you an event! 🎉";
    case 'shop':       return "Let's start your order! 🛍️";
    default:           return "Let's get you started! 📋";
  }
}

// ── Free-text steps where we should NOT fire intents ───

const FREE_TEXT_STEPS = new Set([
  'collect_name',
  'collect_other_name',
  'collect_email',
  'special_requests',
  'review_text',
  'order_delivery_address',
  'order_collect_name',
  'order_collect_email',
  'order_special_instructions',
]);

// ── Intent rules (scored by specificity) ───────────────

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'cancel',
    patterns: [/\bcancel\s*(my\s*)?(booking|reservation)\b/i],
    action: 'bookings',
    response: null,
  },
  {
    intent: 'status',
    patterns: [
      /\b(my\s+booking|check\s+booking|booking\s+status|where'?s?\s+my\s+booking)\b/i,
      /^status$/i,
    ],
    action: 'bookings',
    response: null,
  },
  {
    intent: 'booking',
    patterns: [/\b(book|reserve|table|reservation)\b/i],
    action: 'city_selection',
    response: null, // now category-aware, set dynamically
  },
  {
    intent: 'help',
    patterns: [
      /^help$/i,
      /\b(what can you do|how does this work|options)\b/i,
    ],
    action: 'help',
    response: null,
  },
  {
    intent: 'greeting',
    patterns: [
      /^(hello|hi|hey|yo|howdy)$/i,
      /^good\s+(morning|afternoon|evening)$/i,
    ],
    action: 'restart',
    response: null,
  },
  {
    intent: 'order',
    patterns: [/^(order|order food|place an order|i want to order|buy food|get food)$/i],
    action: 'start_order',
    response: null,
  },
  {
    intent: 'menu',
    patterns: [/\b(menu|food|what do you serve|dishes)\b/i],
    action: null,
    response: null, // category-aware
  },
  {
    intent: 'pricing',
    patterns: [/\b(price|cost|how much|deposit|fee|expensive|cheap)\b/i],
    action: null,
    response: null, // category-aware
  },
  {
    intent: 'hours',
    patterns: [/\b(hours|opening|closing|when are you open|schedule|appointment\s*time|available\s*(times|slots))\b/i],
    action: null,
    response: null, // category-aware
  },
  {
    intent: 'location',
    patterns: [/\b(where|address|directions|map|location)\b/i],
    action: null,
    response: null, // category-aware
  },
  {
    intent: 'thanks',
    patterns: [
      /^(thanks|thank\s*you|cheers)$/i,
      /^(cool|great|okay|ok|nice),?\s*(thanks|thank\s*you|cheers)$/i,
    ],
    action: 'acknowledge',
    response: null,
  },
];

const THANKS_RESPONSES = [
  "You're welcome! 😊",
  'Happy to help! 😊',
  'Anytime! 😊',
  'Glad I could help! 🙏',
];

// ── Profanity word list (moderate filter) ──────────────

const PROFANITY_SET = new Set([
  // English profanity
  'fuck', 'shit', 'bitch', 'bastard', 'cunt', 'whore', 'asshole', 'dick',
  'motherfucker', 'cocksucker', 'bullshit', 'piss', 'slut', 'wanker',
  'twat', 'prick', 'arse', 'arsehole', 'bollocks', 'tosser', 'shithead',
  'dumbass', 'dipshit', 'jackass', 'fuckoff', 'stfu', 'gtfo',
  // Nigerian pidgin / Yoruba / Igbo slang
  'mumu', 'oloshi', 'werey', 'ode', 'ashawo', 'oponu', 'oloriburuku',
  'agbaya', 'ewu', 'efulefu', 'anuofia', 'olofofo', 'yeye', 'omo ale',
  'oshisco', 'oniranu', 'were', 'alakori', 'alagbere', 'oku', 'gorimapa',
  'ashewo', 'mugu',
]);

// L33t-speak & censored patterns
const LEET_PATTERNS: Array<[RegExp, string]> = [
  [/f[\W_]*[uü*]+[\W_]*[ck]+/gi, 'fuck'],
  [/sh[\W_]*[i1!]+[\W_]*t/gi, 'shit'],
  [/b[\W_]*[i1!]+[\W_]*t[\W_]*ch/gi, 'bitch'],
  [/a[\W_]*s[\W_]*s/gi, 'ass'],
  [/d[\W_]*[i1!]+[\W_]*ck/gi, 'dick'],
  [/c[\W_]*[uü]+[\W_]*nt/gi, 'cunt'],
];

// ── Contextual help per step (neutral wording) ─────────

const STEP_HELP: Record<string, string> = {
  greeting: "Send *Hi* to get started, or type *help* for options.",
  quick_rebook: 'Tap a previous option to rebook, or *Browse New* to explore.',
  city_selection: 'Tap *Choose City* to pick your location. 🏙️',
  neighborhood_selection: 'Tap *Choose Area* to select a neighborhood. 📍',
  restaurant_selection: 'Tap *Choose* to make your selection. 📋',
  service_selection: 'Browse the available services and pick one to book. 📋',
  date_selection: 'Tap *Choose Date* to select your preferred date. 📅',
  time_selection: 'Tap *Choose Time* to pick your preferred slot. 🕐',
  party_size: 'Type a number (e.g. *4*) or tap a button for guest count. 👥',
  confirmation: 'Tap *Confirm* to proceed, *Add Request* for special requests, or *For Someone* to book for a friend. ✅',
  special_requests: 'Tap a quick option or type your own request. 📝',
  book_for_other: 'Tap *Myself* or *Someone else*. 👤',
  collect_name: 'Type your full name (e.g. *Ade Johnson*). ✍️',
  collect_other_name: "Type the guest's name. ✍️",
  collect_other_phone: "Type the guest's WhatsApp number or *skip*. 📱",
  collect_email: 'Type your email or tap *Skip*. 📧',
  payment: "Tap *I've Paid* after completing payment. 💳",
  my_bookings: 'Tap a booking to manage it, or send *Hi* to make a new one.',
  modify_booking: 'Tap *Cancel*, *Change Date/Time*, or *Back*.',
  review_text: 'Type your comment or tap *No thanks* to skip. ✍️',
  order_city_selection: 'Tap *Choose City* to pick your location. 🏙️',
  order_restaurant_selection: 'Tap *Choose Restaurant* to pick where to order from. 🍽️',
  order_menu_categories: 'Tap *Browse Menu* to pick a food category. 📋',
  order_menu_items: 'Tap an item to add it to your cart. 🛒',
  order_item_quantity: 'Tap a quantity or type a number (1-10). 🔢',
  order_add_more: 'Tap *Add More* to browse, *View Cart* to review, or *Checkout*. 🛒',
  order_cart_review: 'Tap *Checkout* to proceed, *Add More* to keep browsing, or *Clear Cart*. 🛒',
  order_type_selection: 'Tap *Pickup* or *Delivery* to choose how to get your order. 🚗',
  order_delivery_address: 'Type your full delivery address (at least 10 characters). 📍',
  order_special_instructions: 'Type any special instructions or tap *Skip*. 📝',
  order_confirm: 'Tap *Confirm* to place your order, *Edit Cart* to make changes, or *Cancel*. ✅',
  order_collect_name: 'Type your full name (e.g. *Ade Johnson*). ✍️',
  order_collect_email: 'Type your email or tap *Skip*. 📧',
  order_payment: "Tap *I've Paid* after completing payment. 💳",
  order_complete: 'Your order is confirmed! Send *Hi* to start a new session.',
};

// ── Service ─────────────────────────────────────────────

@Injectable()
export class BotIntelligenceService {
  private readonly abuseMap = new Map<string, AbuseRecord>();
  private readonly retryMap = new Map<string, ValidationRetryRecord>();

  // ── 1A. Intent Detection ──────────────────────────────

  detectIntent(text: string, currentStep: string, category: BusinessCategory = 'restaurant'): IntentResult | null {
    // Don't fire intents on free-text input steps
    if (FREE_TEXT_STEPS.has(currentStep)) return null;

    const normalized = text.toLowerCase().trim();

    // Special case: bare numbers 1-5 in review_text step → treat as rating
    if (currentStep === 'review_text' && /^[1-5]$/.test(normalized)) {
      return null; // let the handler deal with it
    }

    for (const rule of INTENT_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(normalized)) {
          let response = rule.response;

          // Category-aware responses
          if (rule.intent === 'thanks') {
            response = THANKS_RESPONSES[Math.floor(Math.random() * THANKS_RESPONSES.length)];
          } else if (rule.intent === 'menu') {
            response = getMenuResponse(category);
          } else if (rule.intent === 'pricing') {
            response = getPricingResponse(category);
          } else if (rule.intent === 'hours') {
            response = getHoursResponse(category);
          } else if (rule.intent === 'location') {
            response = getLocationResponse(category);
          } else if (rule.intent === 'booking') {
            response = getBookingResponse(category);
          }

          return { intent: rule.intent, action: rule.action, response };
        }
      }
    }

    return null;
  }

  // ── 1B. Profanity Detection ───────────────────────────

  containsProfanity(text: string): boolean {
    // Normalize: collapse repeated chars ("fuuuck" → "fuck")
    const collapsed = text.toLowerCase().replace(/(.)\1{2,}/g, '$1$1');

    // Whole-word check against profanity set
    const words = collapsed.split(/[\s,.!?;:]+/).filter(Boolean);
    for (const word of words) {
      // Strip non-alpha for matching but keep the word boundary logic
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length >= 3 && PROFANITY_SET.has(cleaned)) return true;
    }

    // L33t-speak / censored pattern check
    for (const [pattern] of LEET_PATTERNS) {
      if (pattern.test(collapsed)) return true;
    }

    return false;
  }

  // ── 1C. Abuse Tracking ────────────────────────────────

  isTimedOut(phone: string): { timedOut: boolean; remaining: number } {
    const record = this.abuseMap.get(phone);
    if (!record || !record.cooldownUntil) return { timedOut: false, remaining: 0 };

    const remaining = record.cooldownUntil - Date.now();
    if (remaining <= 0) {
      record.cooldownUntil = 0;
      return { timedOut: false, remaining: 0 };
    }

    return { timedOut: true, remaining: Math.ceil(remaining / 60000) };
  }

  recordGibberish(phone: string): AbuseResult {
    this.pruneIfNeeded();
    const now = Date.now();
    let record = this.abuseMap.get(phone);

    if (!record) {
      record = { gibberishCount: 0, profanityCount: 0, lastGibberish: 0, lastProfanity: 0, cooldownUntil: 0 };
      this.abuseMap.set(phone, record);
    }

    // Reset count if 5 min gap
    if (now - record.lastGibberish > 5 * 60 * 1000) {
      record.gibberishCount = 0;
    }

    record.gibberishCount++;
    record.lastGibberish = now;

    if (record.gibberishCount >= 5) {
      record.cooldownUntil = now + 5 * 60 * 1000; // 5 min soft timeout
      return {
        timeout: true,
        warn: false,
        message: "I'll be here when you're ready. Send *Hi* to start fresh. 🙏",
      };
    }

    if (record.gibberishCount >= 3) {
      return {
        timeout: false,
        warn: true,
        message: "I'm having trouble understanding. Try tapping the buttons, or type *help*. 🤔",
      };
    }

    return { timeout: false, warn: false, message: '' };
  }

  recordProfanity(phone: string, category: BusinessCategory = 'restaurant'): AbuseResult {
    this.pruneIfNeeded();
    const now = Date.now();
    let record = this.abuseMap.get(phone);

    if (!record) {
      record = { gibberishCount: 0, profanityCount: 0, lastGibberish: 0, lastProfanity: 0, cooldownUntil: 0 };
      this.abuseMap.set(phone, record);
    }

    record.profanityCount++;
    record.lastProfanity = now;

    if (record.profanityCount >= 4) {
      record.cooldownUntil = now + 30 * 60 * 1000; // 30 min cooldown
      return {
        timeout: true,
        warn: false,
        message: "I'm going to take a short break. You can message again in 30 minutes. 🙏",
      };
    }

    if (record.profanityCount >= 2) {
      return {
        timeout: false,
        warn: true,
        message: "I want to help, but let's keep things friendly. What can I assist you with? 🙏",
      };
    }

    // First offense — pick a witty category-aware response
    const pool = PROFANITY_RESPONSES[category] || PROFANITY_RESPONSES.other;
    const message = pool[Math.floor(Math.random() * pool.length)];
    return { timeout: false, warn: false, message };
  }

  resetAbuse(phone: string): void {
    this.abuseMap.delete(phone);
  }

  getCooldownRemaining(phone: string): number {
    const record = this.abuseMap.get(phone);
    if (!record || !record.cooldownUntil) return 0;
    return Math.max(0, Math.ceil((record.cooldownUntil - Date.now()) / 60000));
  }

  private pruneIfNeeded(): void {
    if (this.abuseMap.size <= 1000) return;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [phone, record] of this.abuseMap) {
      if (record.lastGibberish < oneHourAgo && record.lastProfanity < oneHourAgo) {
        this.abuseMap.delete(phone);
      }
    }
  }

  // ── 1D. Validation Retry Tracking ─────────────────────

  recordValidationFailure(phone: string, stepId: string): { showHelp: boolean } {
    const key = `${phone}:${stepId}`;
    const now = Date.now();
    let record = this.retryMap.get(key);

    if (!record || record.stepId !== stepId) {
      record = { stepId, failureCount: 0, lastFailure: 0 };
      this.retryMap.set(key, record);
    }

    // Reset if more than 5 minutes since last failure
    if (now - record.lastFailure > 5 * 60 * 1000) {
      record.failureCount = 0;
    }

    record.failureCount++;
    record.lastFailure = now;

    if (record.failureCount >= 3) {
      record.failureCount = 0; // reset after showing help
      return { showHelp: true };
    }

    return { showHelp: false };
  }

  resetValidationRetry(phone: string, stepId: string): void {
    this.retryMap.delete(`${phone}:${stepId}`);
  }

  // Prune old retry records (called from pruneIfNeeded could be overkill, so standalone)
  pruneRetryMap(): void {
    if (this.retryMap.size <= 2000) return;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, record] of this.retryMap) {
      if (record.lastFailure < fiveMinAgo) {
        this.retryMap.delete(key);
      }
    }
  }

  // ── 1E. Contextual Help ───────────────────────────────

  getContextualHelp(currentStep: string): string {
    return STEP_HELP[currentStep] || "Type *help* to see what I can do, or send *Hi* to start over.";
  }

  getHelpText(isStandalone: boolean, restaurantName?: string, alias?: string, category: BusinessCategory = 'restaurant'): string {
    const name = alias || 'NaijaDine Bot';
    const cat = CATEGORY_LABELS[category] || CATEGORY_LABELS.restaurant;

    const lines = [
      `*${name}* can help you with:`,
      '',
      `${cat.emoji} *${cat.action}* — start a new ${cat.noun}`,
      `📋 *My ${cat.plural}* — view & manage ${cat.plural}`,
      `❌ *Cancel ${cat.noun}* — cancel a ${cat.noun}`,
      '📍 *Location* — get directions',
      '💰 *Pricing* — learn about costs',
    ];

    if (!isStandalone) {
      lines.push('🔍 *Browse* — explore options by city');
    }

    lines.push('', '🔄 Send *Hi* to start over anytime.');
    return lines.join('\n');
  }

  // ── 1F. Persona ───────────────────────────────────────

  getPersonaGreeting(alias: string | null, restaurantName: string, category: BusinessCategory = 'restaurant'): string {
    const cat = CATEGORY_LABELS[category] || CATEGORY_LABELS.restaurant;

    if (alias) {
      return `Hi! I'm ${alias}, your assistant at ${restaurantName}. ${cat.emoji} How can I help?`;
    }
    return `Welcome to ${restaurantName}! ${cat.emoji}\n\nLet's get you started.`;
  }
}
