// ═══════════════════════════════════════════════════════
// DineRoot Shared Constants
// Used across web, dashboard, api, and mobile apps
// ═══════════════════════════════════════════════════════

export const APP_NAME = 'DineRoot';
export const APP_TAGLINE = 'Discover. Reserve. Dine.';
export const BOOKING_REF_PREFIX = 'DR';
export const ORDER_REF_PREFIX = 'FO';

// ── Category-Specific Reference Prefixes ──
export const RESERVATION_PREFIX_MAP: Record<string, string> = {
  barber: 'BAR',
  salon: 'SAL',
  spa: 'SPA',
  gym: 'GYM',
  car_wash: 'CWS',
  mechanic: 'MCH',
  hotel: 'HTL',
  clinic: 'CLN',
  tutor: 'TUT',
  photography: 'PHT',
  cleaning: 'CLG',
  coworking: 'CWK',
};

export const ORDER_PREFIX_MAP: Record<string, string> = {
  beauty: 'BTY',
  laundry: 'LDY',
  catering: 'CTR',
  tailor: 'TLR',
  printing: 'PRT',
  logistics: 'LGS',
  bakery: 'BKR',
  church: 'CHR',
  cinema: 'CIN',
  events: 'EVT',
  shop: 'SHP',
};

export const ORDER_DEFAULTS = {
  maxItemQuantity: 10,
  maxCartItems: 20,
} as const;

// ── Cities & Neighborhoods ──
export const CITIES = {
  // ── Nigeria ──
  lagos: {
    name: 'Lagos',
    country: 'NG',
    neighborhoods: ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Lekki Phase 2', 'Ikeja GRA', 'Yaba', 'Surulere', 'Ajah', 'Maryland', 'Magodo', 'Banana Island', 'Eko Atlantic', 'Gbagada', 'Anthony Village'],
  },
  abuja: {
    name: 'Abuja',
    country: 'NG',
    neighborhoods: ['Wuse', 'Wuse 2', 'Maitama', 'Garki', 'Asokoro', 'Jabi', 'Gwarinpa', 'Utako', 'Central Area', 'Katampe', 'Life Camp', 'Lugbe'],
  },
  port_harcourt: {
    name: 'Port Harcourt',
    country: 'NG',
    neighborhoods: ['GRA Phase 1', 'GRA Phase 2', 'Trans-Amadi', 'Old GRA', 'Rumuola', 'Elekahia', 'Rumuokwurusi', 'Peter Odili Road'],
  },
  ibadan: {
    name: 'Ibadan',
    country: 'NG',
    neighborhoods: ['Bodija', 'Ring Road', 'Dugbe', 'UI Area', 'Oluyole', 'Challenge', 'Jericho', 'Alalubosa'],
  },
  enugu: {
    name: 'Enugu',
    country: 'NG',
    neighborhoods: ['Independence Layout', 'New Haven', 'GRA', 'Trans-Ekulu', 'Achara Layout', 'Ogui Road'],
  },
  calabar: {
    name: 'Calabar',
    country: 'NG',
    neighborhoods: ['State Housing', 'Marian Road', 'Satellite Town', 'Diamond Hill', 'Ekpo Abasi'],
  },
  benin: {
    name: 'Benin City',
    country: 'NG',
    neighborhoods: ['GRA', 'Ring Road', 'Uselu', 'Ugbowo', 'Sapele Road', 'Airport Road'],
  },
  kano: {
    name: 'Kano',
    country: 'NG',
    neighborhoods: ['Nassarawa GRA', 'Bompai', 'Zoo Road', 'Ibrahim Taiwo Road', 'Sabon Gari'],
  },
  // ── Ghana ──
  accra: {
    name: 'Accra',
    country: 'GH',
    neighborhoods: ['Osu', 'East Legon', 'Airport Residential', 'Cantonments', 'Labone', 'Ridge', 'Dzorwulu', 'Spintex Road', 'Tema'],
  },
  kumasi: {
    name: 'Kumasi',
    country: 'GH',
    neighborhoods: ['Ahodwo', 'Bantama', 'Nhyiaeso', 'Adum', 'Danyame', 'Ridge'],
  },
  // ── Kenya ──
  nairobi: {
    name: 'Nairobi',
    country: 'KE',
    neighborhoods: ['Westlands', 'Karen', 'Kilimani', 'Lavington', 'Hurlingham', 'Gigiri', 'Kileleshwa', 'CBD', 'Langata'],
  },
  mombasa: {
    name: 'Mombasa',
    country: 'KE',
    neighborhoods: ['Nyali', 'Bamburi', 'Diani', 'Old Town', 'Shanzu', 'Mtwapa'],
  },
  // ── South Africa ──
  johannesburg: {
    name: 'Johannesburg',
    country: 'ZA',
    neighborhoods: ['Sandton', 'Rosebank', 'Braamfontein', 'Melville', 'Parkhurst', 'Fourways', 'Maboneng', 'Greenside'],
  },
  cape_town: {
    name: 'Cape Town',
    country: 'ZA',
    neighborhoods: ['Camps Bay', 'Clifton', 'Waterfront', 'Gardens', 'Sea Point', 'Stellenbosch', 'Franschhoek', 'Constantia'],
  },
  // ── Tanzania ──
  dar_es_salaam: {
    name: 'Dar es Salaam',
    country: 'TZ',
    neighborhoods: ['Masaki', 'Oysterbay', 'Mikocheni', 'Msasani', 'Kariakoo', 'Upanga'],
  },
  // ── Rwanda ──
  kigali: {
    name: 'Kigali',
    country: 'RW',
    neighborhoods: ['Kiyovu', 'Kimihurura', 'Nyarutarama', 'Remera', 'Kacyiru', 'Gisozi'],
  },
} as const;

// ── Countries served ──
export const COUNTRIES = {
  NG: { name: 'Nigeria', currency: 'NGN', flag: '🇳🇬' },
  GH: { name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  KE: { name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  ZA: { name: 'South Africa', currency: 'ZAR', flag: '🇿🇦' },
  TZ: { name: 'Tanzania', currency: 'TZS', flag: '🇹🇿' },
  RW: { name: 'Rwanda', currency: 'RWF', flag: '🇷🇼' },
} as const;

// ── Cuisine Types ──
export const CUISINE_TYPES = [
  'nigerian', 'continental', 'asian', 'mediterranean', 'fast_casual',
  'grill_bbq', 'seafood', 'italian', 'chinese', 'indian', 'lebanese', 'other',
] as const;

// ── Loyalty Tiers ──
export const LOYALTY_TIERS = {
  bronze: { name: 'Bronze', minBookings: 0, discountPct: 0, color: '#CD7F32' },
  silver: { name: 'Silver', minBookings: 5, discountPct: 5, color: '#C0C0C0' },
  gold: { name: 'Gold', minBookings: 15, discountPct: 10, color: '#E8A817' },
  platinum: { name: 'Platinum', minBookings: 30, discountPct: 15, color: '#8B5CF6' },
} as const;

// ── Pricing ──
export const PRICING = {
  marketplace: {
    free: { name: 'Free', price: 0, maxBookings: 50 },
    standard: { name: 'Standard', price: 25_000, maxBookings: Infinity },
    premium: { name: 'Premium', price: 75_000, maxBookings: Infinity },
  },
  whatsapp_standalone: {
    starter: { name: 'Starter', price: 15_000, maxBookings: 100, whitelabel: false },
    professional: { name: 'Professional', price: 35_000, maxBookings: Infinity, whitelabel: true },
    enterprise: { name: 'Enterprise', price: null, maxBookings: Infinity, whitelabel: true },
  },
} as const;

// ── WhatsApp Bot Product ──
export const WHATSAPP_BOT = {
  name: 'DineRoot WhatsApp',
  tagline: 'WhatsApp automation for every business.',
} as const;

// ── Platform Fees ──
export const FEES = {
  commissionRate: 10, // percentage
  vatRate: 7.5, // Nigerian VAT
  paystackLocalRate: 1.5, // percentage
  paystackLocalFlat: 100, // Naira
  paystackLocalCap: 2_000, // Naira
} as const;

// ── No-Show Policy ──
export const NO_SHOW_POLICY = {
  strikeLimit: 4,
  rollingMonths: 12,
  suspensionDays: 30,
} as const;

// ── Booking Defaults ──
export const BOOKING_DEFAULTS = {
  maxPartySize: 20,
  maxAdvanceDays: 30,
  defaultCancellationHours: 4,
  defaultWalkInRatio: 60,
  defaultSlotDurationMinutes: 120,
  reminderHours: [24, 2],
} as const;

// ── Notification Limits ──
export const NOTIFICATION_LIMITS = {
  whatsappMarketingPerWeek: 2,
  smsMarketingPerMonth: 4,
  emailMarketingPerWeek: 3,
} as const;

// ── Time Slots ──
export function generateTimeSlots(
  openTime: string = '12:00',
  closeTime: string = '22:00',
  intervalMinutes: number = 30,
): string[] {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;

  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    current += intervalMinutes;
  }
  return slots;
}

// ── Slug Generator ──
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ── Format Naira ──
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Format Time (12-hour) ──
export function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

// ── Brand Colors ──
export const COLORS = {
  brand: '#F04E37',
  accent: '#D93A24',
  gold: '#E8A817',
  orange: '#E07F00',
  success: '#10B981',
  danger: '#EF4444',
  info: '#3B82F6',
  whatsapp: '#25D366',
} as const;

// ── Business Categories ──
export const BUSINESS_CATEGORIES = [
  { key: 'restaurant', label: 'Restaurant', group: 'food', icon: '🍽️' },
  { key: 'bakery', label: 'Bakery', group: 'food', icon: '🧁' },
  { key: 'catering', label: 'Catering', group: 'food', icon: '🍱' },
  { key: 'barber', label: 'Barber', group: 'beauty', icon: '💈' },
  { key: 'salon', label: 'Salon', group: 'beauty', icon: '💇' },
  { key: 'beauty', label: 'Beauty', group: 'beauty', icon: '💄' },
  { key: 'spa', label: 'Spa', group: 'beauty', icon: '🧖' },
  { key: 'gym', label: 'Gym', group: 'health', icon: '🏋️' },
  { key: 'clinic', label: 'Clinic', group: 'health', icon: '🏥' },
  { key: 'hotel', label: 'Hotel', group: 'hospitality', icon: '🏨' },
  { key: 'coworking', label: 'Coworking', group: 'hospitality', icon: '💻' },
  { key: 'church', label: 'Church', group: 'community', icon: '⛪' },
  { key: 'cinema', label: 'Cinema', group: 'community', icon: '🎬' },
  { key: 'events', label: 'Events', group: 'community', icon: '🎉' },
  { key: 'shop', label: 'Shop', group: 'community', icon: '🛍️' },
  { key: 'laundry', label: 'Laundry', group: 'services', icon: '👔' },
  { key: 'car_wash', label: 'Car Wash', group: 'services', icon: '🚗' },
  { key: 'mechanic', label: 'Mechanic', group: 'services', icon: '🔧' },
  { key: 'cleaning', label: 'Cleaning', group: 'services', icon: '🧹' },
  { key: 'tailor', label: 'Tailor', group: 'services', icon: '🪡' },
  { key: 'printing', label: 'Printing', group: 'services', icon: '🖨️' },
  { key: 'logistics', label: 'Logistics', group: 'services', icon: '📦' },
  { key: 'tutor', label: 'Tutor', group: 'services', icon: '📚' },
  { key: 'photography', label: 'Photography', group: 'services', icon: '📸' },
  { key: 'other', label: 'Other', group: 'services', icon: '🏢' },
] as const;

export type BusinessCategoryKey = (typeof BUSINESS_CATEGORIES)[number]['key'];
export type BusinessGroup = (typeof BUSINESS_CATEGORIES)[number]['group'];

/** Shape of a row in the `business_categories` DB table */
export interface BusinessCategoryRow {
  key: string;
  label: string;
  group: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  default_greeting: string | null;
  booking_type: 'appointment' | 'order' | 'general';
  created_at: string;
}

export const BUSINESS_CATEGORY_KEYS = BUSINESS_CATEGORIES.map(c => c.key);

const GROUP_GREETINGS: Record<string, string> = {
  food: 'Welcome! I can help you place an order or book a table.',
  beauty: 'Welcome! I can help you book an appointment.',
  health: 'Welcome! I can help you book a session.',
  hospitality: 'Welcome! How can I assist you today?',
  services: 'Welcome! How can I help you today?',
  community: 'Welcome! How can I assist you?',
};

export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  food: 'Food & Dining',
  beauty: 'Beauty & Wellness',
  health: 'Health & Fitness',
  hospitality: 'Hospitality',
  services: 'Services',
  community: 'Entertainment & Community',
};

export function getDefaultGreeting(categoryKey: string, businessName: string): string {
  const cat = BUSINESS_CATEGORIES.find(c => c.key === categoryKey);
  const base = GROUP_GREETINGS[cat?.group || 'services'] || GROUP_GREETINGS.services;
  return `Welcome to ${businessName}! ${base}`;
}

// ── Bot Code Generator ──
export function generateBotCode(name: string): string {
  const stopWords = new Set(['the', 'and', 'restaurant', 'kitchen', 'bar', 'lounge', 'cafe', 'eatery', 'by']);
  return name
    .toUpperCase()
    .replace(/&/g, '')
    .replace(/[^A-Z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()))
    .join('-')
    .replace(/-+/g, '-')
    .slice(0, 30);
}

export { t, LOCALES, type Locale } from './i18n';
