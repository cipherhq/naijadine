# 🍽️ NaijaDine

**Nigeria's Restaurant Reservation & Management Platform**

Discover, reserve, and dine at 500+ restaurants across Lagos, Abuja, and Port Harcourt.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database + Auth | [Supabase](https://supabase.com) (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Backend API | [NestJS](https://nestjs.com) on [Vercel](https://vercel.com) Serverless |
| Web Apps | [Next.js 14](https://nextjs.org) on Vercel |
| Mobile App | [Flutter](https://flutter.dev) |
| WhatsApp | [Gupshup](https://gupshup.io) BSP (Meta Cloud API) |
| Payments | [Paystack](https://paystack.com) + [Flutterwave](https://flutterwave.com) |
| Email | [Resend](https://resend.com) |
| SMS / OTP | [Termii](https://termii.com) |
| Push | [Firebase Cloud Messaging](https://firebase.google.com/products/cloud-messaging) |
| Cache | [Upstash Redis](https://upstash.com) |
| Search | [Meilisearch](https://meilisearch.com) |

## Monorepo Structure

```
naijadine/
├── apps/
│   ├── web/                  # Diner-facing Next.js app (naijadine.com)
│   ├── dashboard/            # Restaurant dashboard + Admin portal (dashboard.naijadine.com)
│   └── api/                  # NestJS API on Vercel (api.naijadine.com)
├── packages/
│   ├── db/                   # Supabase client + auto-generated types
│   └── shared/               # Shared constants, types, utilities
├── supabase/
│   ├── config.toml           # Supabase project config
│   ├── migrations/           # SQL migration files
│   └── functions/            # Supabase Edge Functions
├── .github/
│   └── workflows/            # CI/CD pipelines
├── turbo.json                # Turborepo config
├── package.json              # Root workspace config
└── .env.example              # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Vercel CLI](https://vercel.com/docs/cli) (optional)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/naijadine.git
cd naijadine
npm install
```

### 2. Set Up Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (or create one at supabase.com)
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Generate TypeScript types
npm run db:generate-types
```

### 3. Configure Environment

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 4. Run Development

```bash
# Start all apps in development mode
npm run dev

# Or run individual apps
cd apps/web && npm run dev       # Diner web app → localhost:3000
cd apps/dashboard && npm run dev # Dashboard → localhost:3001
cd apps/api && npm run dev       # API → localhost:3002
```

### 5. Open Supabase Studio

```bash
npm run studio
# Opens at localhost:54323
```

## Database Migrations

Migrations are in `supabase/migrations/` and run in order:

| Migration | Contents |
|-----------|----------|
| `001_core_tables.sql` | Extensions, enums, profiles, restaurants, dining areas, tables |
| `002_reservations_finance.sql` | Reservations, payments, refunds, bank accounts, payouts, invoices |
| `003_notifications_crm_admin.sql` | Notifications, broadcasts, CRM, reviews, bot sessions, support, audit |
| `004_rls_policies.sql` | Row Level Security policies for all tables |
| `005_storage_seeds.sql` | Storage buckets, cities, system config, feature flags, notification templates |

## Products

### NaijaDine Marketplace
Full platform: app + web + WhatsApp + discovery + deals + loyalty.

### WhatsApp Standalone
Standalone WhatsApp booking bot + dashboard for restaurants.
- **Starter** (₦15K/mo): NaijaDine branded, 100 bookings/month
- **Professional** (₦35K/mo): White-label, unlimited, CRM
- **Enterprise** (Custom): Multi-location, API, POS integration

## Key Commands

```bash
npm run dev              # Start all apps
npm run build            # Build all apps
npm run lint             # Lint all apps
npm run test             # Run all tests
npm run db:migrate       # Push migrations to Supabase
npm run db:generate-types # Regenerate TypeScript types
npm run db:reset         # Reset database (⚠️ destructive)
```

## Documentation

- [PRD](./docs/NaijaDine_PRD_v2.docx)
- [Technical Architecture](./docs/NaijaDine_TechArch_v2.docx)
- [User Flows & Wireframes](./docs/NaijaDine_UserFlows_v1.docx)

## License

Proprietary — All rights reserved.
