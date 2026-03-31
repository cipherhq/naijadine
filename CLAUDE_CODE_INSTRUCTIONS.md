# NaijaDine — Claude Code Build Instructions

## CRITICAL RULES FOR CLAUDE CODE

**READ THESE RULES BEFORE DOING ANYTHING:**

1. **NEVER hallucinate.** If you are unsure about an API, library method, or configuration — search the official documentation FIRST. Do not guess.
2. **NEVER skip security.** Every endpoint must be authenticated. Every database query must go through RLS. Every user input must be validated and sanitized.
3. **NEVER store sensitive data in plaintext.** No card numbers, no passwords, no API keys in code. Use environment variables for ALL secrets.
4. **VERIFY before proceeding.** After each step, run the relevant test/lint/build command. Fix ALL errors before moving to the next step.
5. **ASK if unclear.** If any instruction is ambiguous, ask the user for clarification rather than making assumptions.
6. **Follow the exact tech stack specified.** Do not substitute libraries unless explicitly told to.
7. **Write tests for every module.** Minimum: unit tests for business logic, integration tests for API endpoints.
8. **Check for vulnerabilities.** Run `npm audit` after every dependency install. Fix critical/high issues before continuing.

---

## PROJECT OVERVIEW

**NaijaDine** is a restaurant reservation platform for Nigeria, serving Lagos, Abuja, and Port Harcourt. It has TWO products:

1. **NaijaDine Marketplace** — Full platform where diners discover, book, and pay at restaurants via mobile app, web app, and WhatsApp chatbot. Restaurants get a dashboard to manage reservations, guests, and finances.

2. **WhatsApp Standalone** — A separate SaaS product where restaurants get their own WhatsApp booking bot + simplified dashboard, WITHOUT being listed on the NaijaDine marketplace. Three tiers: Starter (₦15K/mo, NaijaDine branded), Professional (₦35K/mo, white-label), Enterprise (custom).

Both products share the same codebase and database. The `restaurants.product_type` column differentiates them.

---

## TECH STACK — DO NOT DEVIATE

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Database | **Supabase PostgreSQL** | Latest | Hosted PostgreSQL with Auth, Realtime, Storage, Edge Functions |
| Auth | **Supabase Auth** | Included | Phone OTP (custom via Termii), Google OAuth, Apple Sign-In |
| Backend API | **NestJS** | v10+ | TypeScript, deployed on Vercel Serverless |
| Diner Web App | **Next.js** | v14+ (App Router) | SSR/SSG, deployed on Vercel |
| Restaurant Dashboard + Admin Portal | **Next.js** | v14+ (App Router) | Same framework, separate Vercel project |
| Mobile App | **Flutter** | v3.x | Single codebase iOS + Android (built separately, not in this sprint) |
| Styling | **Tailwind CSS** | v3.4+ | All web apps |
| WhatsApp API | **Gupshup** BSP | REST API | $0 monthly + $0.001/msg markup over Meta rates |
| Payments (Primary) | **Paystack** | v2 API | 1.5% + ₦100 per transaction (capped ₦2,000) |
| Payments (Fallback) | **Flutterwave** | v3 API | Redundancy only |
| Email | **Resend** | REST API | Transactional + marketing emails |
| SMS / OTP | **Termii** | v1 API | DND bypass for Nigerian numbers |
| Push Notifications | **Firebase Cloud Messaging** | Admin SDK | Free, unlimited |
| Cache | **Upstash Redis** | REST API | Serverless Redis for distributed locks |
| Search | **Meilisearch Cloud** | v1.x | Restaurant discovery with typo tolerance |
| CDN | **Vercel Edge Network** + **Cloudflare** | — | Automatic with Vercel |
| Monitoring | **Sentry** (free tier) | Latest | Error tracking + performance |
| CI/CD | **GitHub Actions** | — | Lint, test, deploy |

---

## MONOREPO STRUCTURE

```
naijadine/
├── apps/
│   ├── web/                    # Next.js — Diner web app (naijadine.com)
│   │   ├── app/                # App Router pages
│   │   │   ├── (auth)/         # Login, signup, OTP verification
│   │   │   ├── (main)/         # Home, search, restaurant detail
│   │   │   ├── booking/        # Booking flow
│   │   │   ├── account/        # Profile, bookings history, settings
│   │   │   └── api/            # Route handlers (webhooks)
│   │   ├── components/         # UI components
│   │   ├── lib/                # Supabase client, utils
│   │   └── public/             # Static assets
│   │
│   ├── dashboard/              # Next.js — Restaurant Dashboard + Admin Portal
│   │   ├── app/
│   │   │   ├── (auth)/         # Restaurant/admin login
│   │   │   ├── (restaurant)/   # Restaurant dashboard views
│   │   │   │   ├── overview/
│   │   │   │   ├── reservations/
│   │   │   │   ├── floor-plan/
│   │   │   │   ├── guests/
│   │   │   │   ├── analytics/
│   │   │   │   ├── communications/
│   │   │   │   ├── finance/
│   │   │   │   └── settings/
│   │   │   ├── (admin)/        # Admin portal views
│   │   │   │   ├── dashboard/
│   │   │   │   ├── restaurants/
│   │   │   │   ├── approvals/
│   │   │   │   ├── users/
│   │   │   │   ├── finance/
│   │   │   │   ├── support/
│   │   │   │   ├── moderation/
│   │   │   │   ├── promotions/
│   │   │   │   ├── communications/
│   │   │   │   ├── analytics/
│   │   │   │   ├── config/
│   │   │   │   └── audit-log/
│   │   │   └── (onboarding)/   # Restaurant onboarding flow
│   │   ├── components/
│   │   └── lib/
│   │
│   └── api/                    # NestJS — REST API
│       ├── src/
│       │   ├── auth/           # Auth module (OTP, JWT, social)
│       │   ├── restaurants/    # Restaurant CRUD, onboarding, search
│       │   ├── reservations/   # Booking engine, availability, double-booking prevention
│       │   ├── payments/       # Paystack integration, refunds
│       │   ├── notifications/  # Unified notification dispatcher
│       │   ├── whatsapp/       # Gupshup webhook handler, bot state machine
│       │   ├── finance/        # Payouts, invoices, bank accounts
│       │   ├── admin/          # Admin-only operations
│       │   ├── search/         # Meilisearch integration
│       │   ├── common/         # Guards, interceptors, pipes, filters
│       │   └── config/         # Environment config module
│       └── vercel.json         # Vercel serverless config
│
├── packages/
│   ├── db/                     # Supabase client + TypeScript types
│   │   └── src/
│   │       ├── index.ts        # Client factory (browser, server, edge)
│   │       └── types/          # Auto-generated database types
│   │
│   └── shared/                 # Constants, types, utilities
│       └── src/
│           └── index.ts        # Cities, cuisines, pricing, colors, helpers
│
├── supabase/
│   ├── config.toml
│   ├── migrations/             # 5 SQL migration files (ALREADY WRITTEN)
│   └── functions/              # Edge Functions
│       ├── dispatch-notification/  # Notification dispatcher
│       ├── whatsapp-webhook/       # Gupshup webhook handler
│       └── paystack-webhook/       # Payment webhook handler
│
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── turbo.json
├── tsconfig.json
└── README.md
```

---

## DATABASE — ALREADY BUILT

The database schema is ALREADY written in `supabase/migrations/`. **Do NOT modify these files unless explicitly asked.** The schema includes:

- **25+ tables** with all columns, types, constraints, and indexes
- **30+ ENUM types** for type safety
- **Row Level Security** on every table with helper functions
- **5 storage buckets** with access policies
- **Auto-triggers** for: profile creation on signup, updated_at timestamps, reference code generation, rating calculation
- **EXCLUSION constraint** for double-booking prevention
- **Seed data** for cities, system configs, feature flags, notification templates

**To deploy:** Run `supabase link --project-ref YOUR_REF` then `supabase db push`.

---

## BUILD ORDER — FOLLOW THIS EXACTLY

### Sprint 1: Project Setup & Auth (Week 1-2)

**1.1 Initialize Next.js Web App (`apps/web`)**
```
Create Next.js 14 app with App Router, Tailwind CSS, TypeScript.
Install: @supabase/supabase-js, @supabase/ssr
Configure Supabase middleware for auth session management.
Set up Tailwind with NaijaDine brand colors:
  - Brand: #1B4332
  - Accent: #2D6A4F
  - Gold: #E8A817
```

**1.2 Initialize Next.js Dashboard App (`apps/dashboard`)**
```
Same setup as web app but on port 3001.
Will serve both restaurant dashboard AND admin portal.
Route groups: (restaurant) for restaurant views, (admin) for admin views.
Auth middleware checks user role and redirects accordingly.
```

**1.3 Initialize NestJS API (`apps/api`)**
```
Create NestJS app with TypeScript.
Install: @nestjs/config, @supabase/supabase-js, class-validator, class-transformer, helmet, express-rate-limit
Configure for Vercel deployment (vercel.json with serverless function config).
Set up global validation pipe, CORS, Helmet security headers, rate limiting.
```

**1.4 Auth Module (NestJS API)**
```
Endpoints:
POST /api/v1/auth/otp/send     → Send OTP via Termii to phone number
POST /api/v1/auth/otp/verify   → Verify OTP, create/find Supabase user, return JWT
POST /api/v1/auth/refresh       → Refresh access token
POST /api/v1/auth/logout        → Invalidate session
POST /api/v1/auth/social/google → Google OAuth callback
POST /api/v1/auth/social/apple  → Apple Sign-In callback

Security requirements:
- Rate limit OTP sending: 3 per phone number per 10 minutes
- Rate limit OTP verification: 5 attempts per OTP, then invalidate
- OTP expires after 5 minutes
- Phone number validated with regex: /^\+234[0-9]{10}$/
- JWT access token: 1 hour expiry
- Refresh token: 7 days, single-use with rotation
- Brute force: 5 failed OTP attempts → 30 minute lockout
```

**1.5 Auth Pages (Next.js Web)**
```
Pages:
/login          → Phone number input + OTP flow
/signup         → Phone → OTP → Profile completion (name, city, dietary prefs)
/auth/callback  → OAuth callback handler

Components:
- PhoneInput with +234 prefix
- OTPInput (6 digits with auto-focus advance)
- ProfileForm (first name, last name, email, city selector, dietary preferences)
- SocialLoginButtons (Google, Apple)
```

**VERIFICATION CHECKPOINT 1:**
```bash
npm run lint          # 0 errors
npm run type-check    # 0 errors
npm run test          # All auth tests pass
npm audit             # 0 critical/high vulnerabilities
# Manual test: sign up with phone number, receive OTP, verify, complete profile
```

---

### Sprint 2: Restaurant Module (Week 3-4)

**2.1 Restaurant CRUD API**
```
Endpoints:
GET    /api/v1/restaurants              → Search/browse (public, paginated)
GET    /api/v1/restaurants/:slug        → Detail by slug (public)
GET    /api/v1/restaurants/:id/availability → Time slots for date (public)
POST   /api/v1/restaurants              → Create (authenticated, owner)
PUT    /api/v1/restaurants/:id          → Update (owner only)
POST   /api/v1/restaurants/:id/documents → Upload docs (owner, multer → Supabase Storage)
POST   /api/v1/restaurants/:id/photos   → Upload photos (owner)

Search powered by Meilisearch:
- Index: restaurants (id, name, cuisine_types, city, neighborhood, rating_avg, price_range)
- Filterable: city, neighborhood, cuisine_types, price_range, has_deals
- Sortable: rating_avg, total_bookings, created_at
- Geo sort: _geoPoint(lat, lng)
- Sync via Supabase database webhook → Edge Function → Meilisearch API
```

**2.2 Restaurant Onboarding Flow**
```
Step 1: Choose product (Marketplace vs WhatsApp Standalone)
Step 2: Restaurant details form (name, address, city, neighborhood, cuisine, phone)
Step 3: Document upload (CAC certificate, photos, menu PDF)
Step 4: Bank account setup (bank name, account number → Paystack Name Enquiry verification)
Step 5: Review & submit → status = 'pending'
Admin gets notification → reviews → approves/rejects
```

**2.3 Restaurant Pages (Next.js Web)**
```
/restaurants                → Search results with filters
/restaurants/[slug]         → Restaurant detail (SSG with ISR for SEO)
/restaurants/[slug]/book    → Booking flow
```

**VERIFICATION CHECKPOINT 2:**
```bash
# All Sprint 1 checks +
# Manual test: create restaurant, upload documents, search by name/city/cuisine
# Verify Meilisearch returns results in < 50ms
# Verify Supabase Storage uploads work with correct bucket policies
```

---

### Sprint 3: Reservation Engine (Week 5-6)

**3.1 Booking API — THIS IS THE MOST CRITICAL MODULE**
```
Endpoints:
POST   /api/v1/reservations              → Create booking
GET    /api/v1/reservations              → List user's bookings
GET    /api/v1/reservations/:ref         → Get by reference code
PUT    /api/v1/reservations/:id          → Modify (date/time/size)
POST   /api/v1/reservations/:id/cancel   → Cancel
POST   /api/v1/reservations/:id/confirm  → Restaurant confirms (staff only)
POST   /api/v1/reservations/:id/seat     → Mark seated (staff only)
POST   /api/v1/reservations/:id/complete → Mark completed (staff only)
POST   /api/v1/reservations/:id/no-show  → Mark no-show (staff only)

DOUBLE-BOOKING PREVENTION — IMPLEMENT EXACTLY AS FOLLOWS:
1. Receive booking request (restaurant_id, date, time, party_size)
2. Acquire Upstash Redis lock: SET restaurant:{id}:slot:{date}:{time} NX EX 10
3. If lock acquired:
   a. BEGIN PostgreSQL transaction (SERIALIZABLE isolation)
   b. SELECT count(*) FROM reservations WHERE restaurant_id = ? AND date = ? AND status NOT IN ('cancelled', 'no_show') AND time ranges overlap
   c. Compare count against restaurant capacity (accounting for walk_in_ratio)
   d. If available: INSERT reservation, COMMIT
   e. If not: ROLLBACK, return 409 Conflict
4. Release Redis lock: DEL key
5. If lock NOT acquired: retry with exponential backoff (100ms, 200ms, 400ms), max 3 retries
6. If all retries fail: return 409 Conflict

DO NOT skip the Redis lock. DO NOT use READ COMMITTED isolation. This MUST be SERIALIZABLE.
```

**3.2 Availability Calculator**
```
For a given restaurant + date + party_size:
1. Get restaurant operating hours for that day of week
2. Generate 30-minute time slots within operating hours
3. For each slot, query confirmed/pending reservations
4. Subtract reserved capacity from total capacity (accounting for walk_in_ratio)
5. Return slots with available = true/false and remaining_seats count
Cache result in Upstash Redis with 60-second TTL
Invalidate cache on any reservation INSERT/UPDATE for that restaurant+date
```

**3.3 No-Show Tracking**
```
When staff marks no-show:
1. Update reservation status = 'no_show'
2. Increment user.no_show_count
3. If deposit_status = 'paid', set deposit_status = 'forfeited'
4. If user.no_show_count >= system_config.no_show_strike_limit:
   - Set user.is_suspended = true
   - Send suspension notification (WhatsApp + email)
5. Else: send warning notification with strike count
```

**VERIFICATION CHECKPOINT 3:**
```bash
# Concurrent booking test: send 10 simultaneous booking requests for the same time slot
# Verify only 1 succeeds, 9 get 409 Conflict
# Verify availability cache invalidates correctly
# Verify no-show counter increments and suspension triggers at threshold
```

---

### Sprint 4: Payments (Week 7-8)

**4.1 Paystack Integration**
```
Endpoints:
POST /api/v1/payments/initialize   → Create Paystack transaction
POST /api/v1/payments/webhook      → Paystack webhook (verify signature!)
GET  /api/v1/payments/verify/:ref  → Verify payment status

Flow:
1. POST /initialize: create Paystack transaction with amount, email, callback_url
   - Generate idempotency_key (UUID v4) — store in payments table
   - Amount in KOBO (Naira × 100)
   - Include metadata: { reservation_id, user_id }
   - Return Paystack authorization_url
2. User pays on Paystack checkout page
3. Paystack sends webhook to /payments/webhook
   - VERIFY SIGNATURE: HMAC-SHA512 of raw request body with PAYSTACK_SECRET_KEY
   - Compare hash with x-paystack-signature header
   - If mismatch: return 400, log security alert
   - If match: process event
4. On 'charge.success':
   - Verify amount matches reservation deposit
   - Update payment.status = 'success'
   - Update reservation.deposit_status = 'paid'
   - Send confirmation notification (WhatsApp + email + push)
5. On 'charge.failed':
   - Update payment.status = 'failed'
   - Notify user of failure

SECURITY:
- NEVER trust client-side payment confirmation. ALWAYS verify via webhook + API call.
- Idempotency: if webhook fires twice with same reference, second is no-op.
- Store gateway_reference, NEVER store card numbers.
```

**4.2 Refund Processing**
```
POST /api/v1/payments/refund → Request refund

Auto-approved if:
- Cancelled within restaurant's cancellation_window_hours
- Cancelled_by = 'restaurant' or 'system'

Requires admin approval if:
- Cancelled outside window
- Dispute claim
- Policy exception

Refund via Paystack Refund API:
POST https://api.paystack.co/refund
Body: { transaction: gateway_reference, amount: refund_amount_in_kobo }
```

**4.3 Bank Account Verification**
```
When restaurant adds bank account:
1. Call Paystack Resolve Account Number:
   GET https://api.paystack.co/bank/resolve?account_number=XXXXXXXXXX&bank_code=XXX
2. If success: store verified account_name from response
3. Create Paystack Transfer Recipient:
   POST https://api.paystack.co/transferrecipient
4. Store recipient_code for future payouts
5. Admin reviews and approves

Bank account changes trigger:
- 48-hour payout hold
- Admin notification
- Audit log entry
```

**VERIFICATION CHECKPOINT 4:**
```bash
# Test payment with Paystack test keys (sk_test_...)
# Verify webhook signature validation works (reject tampered payload)
# Verify idempotency (duplicate webhook = no duplicate payment record)
# Verify refund creates Paystack refund and updates reservation status
# Verify bank account resolution returns correct account name
```

---

### Sprint 5: Notifications (Week 9-10)

**5.1 Unified Notification Dispatcher (Supabase Edge Function)**
```
File: supabase/functions/dispatch-notification/index.ts

Triggered by database webhooks on:
- reservations (INSERT, UPDATE on status column)
- payments (INSERT where status = 'success')
- reviews (INSERT)

Logic:
1. Determine notification type from event
2. Look up user's notification preferences
3. For each enabled channel, enqueue notification:
   - WhatsApp: call Gupshup API with template
   - Email: call Resend API with template
   - SMS: call Termii API (only for OTP or non-WhatsApp fallback)
   - Push: call Firebase Admin SDK
   - In-app: INSERT into notifications table (Supabase Realtime auto-delivers)
4. Log delivery status in notifications table
```

**5.2 Gupshup WhatsApp Integration**
```
Send template message:
POST https://api.gupshup.io/wa/api/v1/template/msg
Headers: {
  apikey: GUPSHUP_API_KEY,
  Content-Type: application/x-www-form-urlencoded
}
Body: {
  channel: 'whatsapp',
  source: GUPSHUP_PHONE_NUMBER,
  destination: user_phone_number,
  'template': JSON.stringify({
    id: template_id,
    params: [param1, param2, ...]
  })
}

Receive webhook (incoming messages):
POST /api/v1/webhook/whatsapp (or Supabase Edge Function)
- Validate Gupshup webhook signature
- Parse message type (text, interactive_reply, button_reply)
- Route to bot state machine
```

**5.3 Resend Email Integration**
```
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'NaijaDine <hello@naijadine.com>',
  to: user.email,
  subject: 'Booking Confirmed — Nok by Alara',
  react: BookingConfirmationEmail({ reservation }),
  // OR
  html: compiledHtmlTemplate,
});

Use React Email for templates:
- BookingConfirmation
- Reminder24h
- Welcome
- PaymentReceipt
- PayoutConfirmation
- WeeklyDigest
```

**5.4 Termii SMS Integration**
```
POST https://api.ng.termii.com/api/sms/otp/send
Body: {
  api_key: TERMII_API_KEY,
  message_type: 'NUMERIC',
  to: phone_number,
  from: 'NaijaDine',
  channel: 'dnd', // CRITICAL: DND bypass for Nigerian numbers
  pin_attempts: 5,
  pin_time_limit: 5,
  pin_length: 6,
  pin_placeholder: '< 1234 >',
  message_text: 'Your NaijaDine verification code is < 1234 >. Expires in 5 minutes.',
  pin_type: 'NUMERIC'
}

Verify OTP:
POST https://api.ng.termii.com/api/sms/otp/verify
Body: { api_key: TERMII_API_KEY, pin_id: pin_id_from_send, pin: user_entered_otp }
```

**5.5 Complete Notification Event Map**

| Event | WhatsApp | Email | SMS | Push | In-App |
|-------|----------|-------|-----|------|--------|
| User signs up | Welcome msg | Welcome email | OTP only | — | Welcome card |
| OTP verification | — | — | OTP (Termii) | — | — |
| Booking confirmed | Confirmation | Confirmation | Fallback | ✓ | ✓ |
| 24hr reminder | Reminder | Reminder | — | ✓ | ✓ |
| 2hr reminder | Directions | — | — | ✓ | ✓ |
| Booking cancelled | Cancellation | Cancellation | — | ✓ | ✓ |
| No-show marked | Warning | Warning | — | ✓ | ✓ |
| Payment received | Receipt | Receipt | — | ✓ | ✓ |
| Refund processed | Refund notice | Refund email | — | ✓ | ✓ |
| Deal alert | Deal (MARKETING) | Deal email | — | ✓ | ✓ |
| Restaurant approved | Congrats | Welcome email | — | — | — |
| Payout processed | Payout notice | Payout email | — | — | ✓ |
| New booking (restaurant) | Alert | Alert | — | — | Realtime |
| Weekly digest (restaurant) | — | Weekly email | — | — | — |

**VERIFICATION CHECKPOINT 5:**
```bash
# Send test WhatsApp via Gupshup → verify delivery
# Send test email via Resend → verify delivery + template rendering
# Send test OTP via Termii → verify DND bypass works
# Verify database webhook triggers Edge Function correctly
# Verify notification preferences are respected (opt-out channels skipped)
```

---

### Sprint 6: WhatsApp Bot (Week 11-12)

**6.1 Bot State Machine**
```
States:
  greeting → city_selection → neighborhood_selection → restaurant_selection →
  date_selection → time_selection → party_size → confirmation → payment → complete

Each state:
- Validates user input
- Stores selection in bot_sessions.session_data (JSONB)
- Sends next interactive message (list or buttons)
- Handles unexpected input gracefully ("I didn't catch that. Please tap one of the options.")

Session timeout: 24 hours (WhatsApp service window)
Session expired: "Your session has expired. Send 'Hi' to start again."
```

**6.2 Gupshup Webhook Handler**
```
File: supabase/functions/whatsapp-webhook/index.ts

1. Validate webhook signature
2. Parse incoming message
3. Find or create bot_session for this whatsapp_number
4. Route to current state handler
5. Process response + advance state
6. Send reply via Gupshup API
7. Update bot_session with new state + session_data

For WhatsApp Standalone:
- Route based on destination phone number (different restaurant bots)
- restaurant_id comes from matching the business phone number
- Branding (greeting message, bot name) loaded from restaurant.whatsapp_plan settings
```

**VERIFICATION CHECKPOINT 6:**
```bash
# Full end-to-end test: send "Hi" → complete booking → receive confirmation
# Test error handling: send garbage input at each step
# Test session timeout: wait > 24 hours, verify session resets
# Test standalone bot: send message to restaurant's WhatsApp number
```

---

### Sprint 7: Diner Web App — All Pages (Week 13-14)

**7.1 Pages to Build**
```
Public pages:
/                           → Home (deals, nearby restaurants, cuisine filters)
/restaurants                → Search results with filters (SSR)
/restaurants/[slug]         → Restaurant detail (SSG + ISR, revalidate: 3600)
/deals                      → Current deals and promotions

Authenticated pages:
/booking/[restaurant-slug]  → Booking flow (date → time → guests → payment)
/booking/confirmation/[ref] → Booking confirmed
/account                    → Profile settings
/account/bookings           → Booking history (upcoming + past)
/account/bookings/[ref]     → Booking detail with modify/cancel
/account/favorites          → Saved restaurants
/account/loyalty            → Loyalty points + tier

Auth pages:
/login                      → Phone OTP login
/signup                     → Registration flow
```

**7.2 SEO Requirements**
```
Every restaurant page must have:
- <title>: "{Restaurant Name} — Book a Table | NaijaDine"
- <meta name="description">: Generated from restaurant description + cuisine + neighborhood
- Open Graph tags (og:title, og:description, og:image)
- Schema.org Restaurant structured data (JSON-LD)
- Canonical URL
- generateStaticParams for all active restaurants
- ISR revalidation every 1 hour
```

**7.3 Performance Requirements**
```
- Lighthouse score: > 90 on mobile
- First Contentful Paint: < 2 seconds on 3G
- Total page weight: < 500KB initial load
- Images: next/image with WebP, lazy loading, blur placeholder
- Fonts: next/font with font-display: swap
```

---

### Sprint 8: Restaurant Dashboard (Week 15-16)

**8.1 Dashboard Views**
```
/dashboard                      → Overview (today's stats, upcoming reservations)
/dashboard/reservations         → Full reservation list with filters + actions
/dashboard/floor-plan           → Visual table management (drag-and-drop)
/dashboard/guests               → Guest CRM (profiles, tags, visit history)
/dashboard/analytics            → Charts (covers, channel mix, revenue, no-show rate)
/dashboard/communications       → Broadcast composer, sent history, templates
/dashboard/finance              → Revenue, payouts, bank account, statements
/dashboard/settings             → Restaurant profile, hours, deposit config, staff management
```

**8.2 Real-time Updates**
```
Use Supabase Realtime to subscribe to changes:
- reservations table (restaurant_id filter) → live booking updates
- tables table (dining_area restaurant_id filter) → table status changes

import { createBrowserClient } from '@naijadine/db';

const supabase = createBrowserClient();
supabase
  .channel('restaurant-bookings')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'reservations',
    filter: `restaurant_id=eq.${restaurantId}`,
  }, (payload) => {
    // Update UI in real-time
  })
  .subscribe();
```

---

### Sprint 9: Admin Portal (Week 17-18)

**9.1 Admin Views**
```
/admin                          → Platform dashboard (KPIs, trends)
/admin/restaurants              → Restaurant management + search
/admin/approvals                → Pending application queue
/admin/users                    → User management (diners + staff)
/admin/finance                  → Revenue reports, payouts, refunds, invoices, bank accounts
/admin/support                  → Support ticket management
/admin/moderation               → Content moderation queue (reviews, photos)
/admin/promotions               → Campaign management
/admin/communications           → Platform-wide messaging
/admin/analytics                → Cohorts, retention, revenue breakdown
/admin/config                   → Cities, fees, API keys, feature flags
/admin/audit-log                → Full audit trail
```

**9.2 Admin Auth**
```
Admin users have role = 'admin' or 'super_admin' in profiles table.
Middleware checks role on every admin route:
- If not admin → redirect to /login
- If admin but accessing super_admin route → 403
```

---

### Sprint 10: Flutter Mobile App (Week 19-20)

```
This sprint builds the Flutter mobile app.
Use the Supabase Flutter SDK (supabase_flutter package).
Target APK size: < 25MB.
Support Android 6.0+ and iOS 14+.
Optimize for budget devices (2-4GB RAM).
```

---

### Sprint 11: WhatsApp Standalone Product (Week 21-22)

```
- Multi-number Gupshup setup (one App per restaurant)
- Standalone dashboard (stripped-down reservation management)
- Starter vs Professional tier enforcement (branding, booking limits)
- White-label bot greeting and templates
```

---

### Sprint 12: QA & Security Audit (Week 23-24)

```
1. Run full security audit:
   - npm audit --audit-level=critical
   - OWASP ZAP scan on all endpoints
   - SQL injection testing (all user inputs)
   - XSS testing (all rendered content)
   - CSRF validation on all state-changing endpoints
   - Rate limiting verification on all endpoints
   - RLS bypass testing (try accessing other users' data)

2. Performance testing:
   - Load test: 100 concurrent bookings
   - Budget device testing (Tecno Spark, Infinix Hot)
   - 3G network simulation

3. NDPA compliance check:
   - Consent collection verified
   - Data export endpoint works
   - Data deletion endpoint works
   - Privacy policy accessible
   - 72-hour breach notification process documented

4. Penetration testing:
   - Auth bypass attempts
   - Payment manipulation attempts
   - Privilege escalation attempts
   - Webhook signature forgery attempts
```

---

## SECURITY REQUIREMENTS — NON-NEGOTIABLE

### Authentication
- [ ] Phone OTP with 5-minute expiry
- [ ] 6-digit numeric OTP only
- [ ] Rate limit: 3 OTP sends per phone per 10 minutes
- [ ] Rate limit: 5 verification attempts per OTP
- [ ] 30-minute lockout after 5 failed attempts
- [ ] JWT access tokens: 1 hour expiry
- [ ] Refresh tokens: 7 days, single-use rotation
- [ ] HTTPS only (Vercel provides this)

### API Security
- [ ] All endpoints behind authentication (except public restaurant browsing)
- [ ] Input validation on EVERY endpoint (class-validator decorators)
- [ ] Rate limiting: 100 req/min authenticated, 20 req/min unauthenticated
- [ ] CORS: only allow naijadine.com, dashboard.naijadine.com domains
- [ ] Helmet security headers on all responses
- [ ] No sensitive data in error messages (use error codes)
- [ ] Request body size limit: 10MB

### Database Security
- [ ] RLS enabled on EVERY table (already done in migrations)
- [ ] Service role key NEVER exposed to client
- [ ] Anon key used in browser with RLS enforcement
- [ ] Parameterized queries only (TypeORM/Supabase client handles this)
- [ ] No raw SQL in application code

### Payment Security
- [ ] NEVER store card numbers, CVVs, or PINs
- [ ] Webhook signature verification (HMAC-SHA512 for Paystack)
- [ ] Idempotency keys on all payment operations
- [ ] Amount verification: compare webhook amount with database amount
- [ ] Bank account changes require admin approval + 48-hour hold

### Data Protection (NDPA 2023)
- [ ] Explicit consent at registration
- [ ] Data export endpoint (GET /api/v1/account/export)
- [ ] Data deletion endpoint (DELETE /api/v1/account)
- [ ] Privacy policy page accessible without login
- [ ] Data stored in-region (Supabase EU or closest to Africa)
- [ ] Audit log for all admin actions
- [ ] 72-hour breach notification capability

### Content Security
- [ ] HTML entity encoding on all user-generated content
- [ ] Content Security Policy headers
- [ ] File upload validation: check MIME type + file signature (magic bytes)
- [ ] Image uploads: max 5MB, jpeg/png/webp only
- [ ] Document uploads: max 10MB, pdf/jpeg/png only

---

## ENVIRONMENT VARIABLES NEEDED

Before starting, create a `.env.local` with these values:

```
# Supabase (get from supabase.com dashboard)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paystack (get from paystack.com dashboard)
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...

# Gupshup (get from gupshup.io dashboard)
GUPSHUP_API_KEY=
GUPSHUP_APP_NAME=NaijaDine
GUPSHUP_PHONE_NUMBER=

# Resend (get from resend.com dashboard)
RESEND_API_KEY=re_...

# Termii (get from termii.com dashboard)
TERMII_API_KEY=TL...

# Upstash Redis (get from upstash.com dashboard)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Meilisearch (get from cloud.meilisearch.com)
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# Firebase (get from Firebase Console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## HOW TO START

1. Read this ENTIRE document first.
2. Confirm you understand the project structure, tech stack, and security requirements.
3. Check that all migration files exist in `supabase/migrations/`.
4. Ask the user to create accounts on: Supabase, Vercel, Paystack, Gupshup, Resend, Termii, Upstash, Meilisearch, Firebase.
5. Once .env.local is populated, begin Sprint 1.1.
6. After EVERY sprint, run the verification checkpoint.
7. Do NOT proceed to the next sprint if any checkpoint fails.

---

## REMEMBER

- You are building a PRODUCTION application that handles real money (Paystack payments) and real user data (NDPA protected).
- Security is not optional. Every shortcut creates a vulnerability.
- Test everything. Trust nothing from the client. Validate everything on the server.
- When in doubt, ASK the user rather than guessing.

Good luck. Build something Nigeria will love. 🍽️
