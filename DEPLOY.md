# DineRoot Deployment Guide

## Architecture
```
dineroot.com          → Vercel (apps/web)
dashboard.dineroot.com → Vercel (apps/dashboard)
api.dineroot.com      → Render (apps/api)
Database              → Supabase (hosted PostgreSQL)
```

## Pre-Deployment Checklist

### 1. Supabase (Production Project)
- [ ] Create a new Supabase project for production
- [ ] Run all migrations: `supabase db push --linked`
- [ ] Verify RLS policies are enabled on all tables
- [ ] Set up Supabase Auth: enable phone (Termii) + email providers
- [ ] Create storage buckets (auto-created by migration 005)
- [ ] Note: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 2. Third-Party API Keys
- [ ] **Paystack**: Create account at paystack.com, get `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY`
- [ ] **Termii**: Create account at termii.com, get `TERMII_API_KEY` for OTP SMS
- [ ] **Resend**: Create account at resend.com, verify domain, get `RESEND_API_KEY`
- [ ] **Gupshup**: Create WhatsApp Business account, get `GUPSHUP_API_KEY`
- [ ] **Upstash Redis**: Create at upstash.com, get `UPSTASH_REDIS_REST_URL` + `TOKEN`
- [ ] **Sentry**: Create project at sentry.io, get `SENTRY_DSN`

### 3. Deploy Web App (Vercel)
```bash
# From project root
vercel --prod
# Or connect GitHub repo to Vercel dashboard
```
- Set root directory: `.` (monorepo root)
- Build command: `npx turbo run build --filter=@dineroot/web`
- Output directory: `apps/web/.next`
- Framework: Next.js
- Environment variables: all `NEXT_PUBLIC_*` vars

### 4. Deploy Dashboard (Vercel - separate project)
```bash
cd apps/dashboard && vercel --prod
```
- Build command: `npx turbo run build --filter=@dineroot/dashboard`
- Output directory: `.next`
- Environment variables: same Supabase vars

### 5. Deploy API (Render)
- Connect GitHub repo
- Root directory: `.`
- Build: `npm install && npm run build --workspace=apps/api`
- Start: `npm run start:prod --workspace=apps/api`
- Set all env vars from render.yaml

### 6. DNS
- `dineroot.com` → Vercel (web)
- `dashboard.dineroot.com` → Vercel (dashboard)
- `api.dineroot.com` → Render (API)

### 7. Post-Deploy Verification
- [ ] Visit dineroot.com — homepage loads with restaurants
- [ ] Sign up with phone number — OTP received
- [ ] Browse restaurants — images load, search works
- [ ] Make a test booking — confirmation page shows
- [ ] Login to dashboard — restaurant overview loads
- [ ] Check /api/v1 on API domain — responds
- [ ] Check Sentry — no errors

## Environment Variables (Full List)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
GUPSHUP_API_KEY=
GUPSHUP_APP_NAME=DineRoot
GUPSHUP_PHONE_NUMBER=
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@dineroot.com
RESEND_REPLY_TO=support@dineroot.com
TERMII_API_KEY=
TERMII_SENDER_ID=DineRoot
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
SENTRY_DSN=
NODE_ENV=production
APP_NAME=DineRoot
APP_URL=https://dineroot.com
DASHBOARD_URL=https://dashboard.dineroot.com
API_URL=https://api.dineroot.com
```
