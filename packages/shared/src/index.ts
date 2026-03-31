// ═══════════════════════════════════════════════════════
// NaijaDine Shared Constants
// Used across web, dashboard, api, and mobile apps
// ═══════════════════════════════════════════════════════

export const APP_NAME = 'NaijaDine';
export const APP_TAGLINE = 'Discover. Reserve. Dine.';
export const BOOKING_REF_PREFIX = 'ND';

// ── Cities & Neighborhoods ──
export const CITIES = {
  lagos: {
    name: 'Lagos',
    neighborhoods: ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Lekki Phase 2', 'Ikeja GRA', 'Yaba', 'Surulere', 'Ajah', 'Maryland', 'Magodo'],
  },
  abuja: {
    name: 'Abuja',
    neighborhoods: ['Wuse', 'Wuse 2', 'Maitama', 'Garki', 'Asokoro', 'Jabi', 'Gwarinpa', 'Utako', 'Central Area', 'Katampe'],
  },
  port_harcourt: {
    name: 'Port Harcourt',
    neighborhoods: ['GRA Phase 1', 'GRA Phase 2', 'Trans-Amadi', 'Old GRA', 'Rumuola', 'Elekahia', 'Rumuokwurusi', 'Peter Odili Road'],
  },
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

// ── Brand Colors ──
export const COLORS = {
  brand: '#1B4332',
  accent: '#2D6A4F',
  gold: '#E8A817',
  orange: '#E07F00',
  success: '#10B981',
  danger: '#EF4444',
  info: '#3B82F6',
  whatsapp: '#25D366',
} as const;

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
