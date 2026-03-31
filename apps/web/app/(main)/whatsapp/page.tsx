import type { Metadata } from 'next';
import Link from 'next/link';
import { PRICING, formatNaira } from '@naijadine/shared';

export const metadata: Metadata = {
  title: 'WhatsApp Booking Bot for Restaurants — NaijaDine',
  description:
    'Give your restaurant its own AI-powered WhatsApp booking assistant. Accept reservations 24/7, reduce no-shows with deposits, and delight guests — no app download required.',
};

const standalone = PRICING.whatsapp_standalone;

export default function WhatsAppPage() {
  return (
    <>
      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden bg-brand py-20">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-gold/10" />

        <div className="relative mx-auto max-w-5xl px-4 text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            WhatsApp Booking Bot
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold leading-tight text-white sm:text-5xl">
            Your Restaurant&apos;s Own WhatsApp Booking Assistant
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-200">
            Let an AI-powered bot handle reservations 24/7 on WhatsApp — the app
            your guests already use. Built for Nigerian restaurants.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/whatsapp/get-started"
              className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-brand-800 transition hover:bg-gold-400"
            >
              Get Started
            </Link>
            <Link
              href="#pricing"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>

          <p className="mt-8 text-sm text-brand-200">
            Trusted by 50+ restaurants across Lagos, Abuja &amp; Port Harcourt
          </p>
        </div>
      </section>

      {/* ── 2. WhatsApp Conversation Demo ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            See It in Action
          </h2>
          <p className="mt-2 text-center text-gray-600">
            A typical booking takes under 60 seconds
          </p>

          <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
            {/* Chat mockup */}
            <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl shadow-xl">
              {/* WhatsApp header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: '#075E54' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                  ND
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">NaijaDine Bot</p>
                  <p className="text-xs text-green-200">online</p>
                </div>
              </div>

              {/* Chat body */}
              <div className="space-y-3 p-4" style={{ backgroundColor: '#ECE5DD' }}>
                <ChatBubble from="bot">
                  Welcome to Bukka Hut! 🍽️ How can I help you today?{'\n\n'}
                  1️⃣ Make a reservation{'\n'}
                  2️⃣ View our menu{'\n'}
                  3️⃣ Talk to staff
                </ChatBubble>
                <ChatBubble from="user">1</ChatBubble>
                <ChatBubble from="bot">
                  Great! When would you like to dine? Please share the date, time
                  and number of guests.
                </ChatBubble>
                <ChatBubble from="user">Tomorrow, 7pm, 4 guests</ChatBubble>
                <ChatBubble from="bot">
                  ✅ Booking confirmed!{'\n\n'}
                  📅 Tomorrow, 7:00 PM{'\n'}
                  👥 4 guests{'\n'}
                  📍 Bukka Hut — Victoria Island{'\n'}
                  🔖 Ref: ND-4821{'\n\n'}
                  We&apos;ll send a reminder 2 hours before. See you!
                </ChatBubble>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-8">
              <StepCallout
                number={1}
                title="Guest says hi"
                description="When a guest messages your WhatsApp number, the bot greets them with your restaurant's name and presents clear options."
              />
              <StepCallout
                number={2}
                title="Bot collects details"
                description="The AI asks for date, time, and party size in natural language — no forms, no links, just a quick chat."
              />
              <StepCallout
                number={3}
                title="Instant confirmation"
                description="The reservation is confirmed in seconds, complete with a reference code and automatic reminders."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Feature Grid ── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Everything You Need to Manage Reservations
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Powerful features designed for Nigerian restaurants
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              color="bg-green-100 text-green-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              }
              title="24/7 WhatsApp Bot"
              description="Accept bookings any time, day or night, even when your staff are busy or the restaurant is closed."
            />
            <FeatureCard
              color="bg-blue-100 text-blue-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              }
              title="Guest Intelligence"
              description="Track guest preferences, visit history, and special requests to deliver personal service every time."
            />
            <FeatureCard
              color="bg-purple-100 text-purple-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              }
              title="Reservation Dashboard"
              description="View, manage, and export all bookings from a clean web dashboard. No WhatsApp scrolling needed."
            />
            <FeatureCard
              color="bg-gold-100 text-gold-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              }
              title="Deposit Collection"
              description="Reduce no-shows by collecting deposits via Paystack — automatically prompted by the bot during booking."
            />
            <FeatureCard
              color="bg-red-100 text-red-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              }
              title="SMS & Email Reminders"
              description="Automatic reminders go out 24 hours and 2 hours before the reservation, cutting no-shows dramatically."
            />
            <FeatureCard
              color="bg-brand-100 text-brand-700"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              }
              title="Custom Bot Persona"
              description="Give the bot your restaurant's name and personality. Guests interact with your brand, not ours."
            />
          </div>
        </div>
      </section>

      {/* ── 4. Problem vs Solution ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Why Restaurants Switch to NaijaDine
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Without */}
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
              <h3 className="text-lg font-semibold text-red-800">Without NaijaDine</h3>
              <ul className="mt-4 space-y-3">
                {[
                  'Missed calls during peak hours = lost bookings',
                  'No-shows with no deposit to offset costs',
                  'Paper or spreadsheet booking chaos',
                  'Staff overwhelmed answering DMs manually',
                  'No guest history for repeat visitors',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-red-700">
                    <CrossIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* With */}
            <div className="rounded-2xl border border-green-100 bg-green-50/50 p-6">
              <h3 className="text-lg font-semibold text-green-800">With NaijaDine</h3>
              <ul className="mt-4 space-y-3">
                {[
                  '24/7 bot takes bookings even at 2 AM',
                  'Deposits collected automatically via Paystack',
                  'Clean dashboard with real-time availability',
                  'Bot handles 90% of booking conversations',
                  'Full guest profiles and visit history',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-green-700">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Stats Bar ── */}
      <section className="bg-brand py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {[
            { value: '50+', label: 'Restaurants' },
            { value: '10,000+', label: 'Bookings Processed' },
            { value: '60%', label: 'Fewer No-Shows' },
            { value: '24/7', label: 'Available' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-sm text-brand-200">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Pricing ── */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-2 text-center text-gray-600">
            No hidden fees. Cancel anytime.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {/* Starter */}
            <PlanCard
              name={standalone.starter.name}
              price={formatNaira(standalone.starter.price as number)}
              period="/month"
              features={[
                'Up to 100 bookings/month',
                'WhatsApp booking bot',
                'Reservation dashboard',
                'SMS & email notifications',
                'NaijaDine branding',
              ]}
              cta={{ label: 'Get Started', href: '/whatsapp/get-started?plan=starter' }}
            />

            {/* Professional */}
            <PlanCard
              name={standalone.professional.name}
              price={formatNaira(standalone.professional.price as number)}
              period="/month"
              highlight
              features={[
                'Unlimited bookings',
                'WhatsApp booking bot',
                'White-label (your brand)',
                'Custom bot persona',
                'Priority support',
                'Advanced analytics',
              ]}
              cta={{ label: 'Get Started', href: '/whatsapp/get-started?plan=professional', gold: true }}
            />

            {/* Enterprise */}
            <PlanCard
              name={standalone.enterprise.name}
              price="Custom"
              period=""
              features={[
                'Everything in Professional',
                'Multiple locations',
                'API access',
                'Custom integrations',
                'Dedicated support',
                'SLA guarantee',
              ]}
              cta={{ label: 'Contact Sales', href: '/contact' }}
            />
          </div>
        </div>
      </section>

      {/* ── 7. How to Get Started ── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Get Started in 3 Simple Steps
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Sign Up',
                description: 'Create your account and tell us about your restaurant.',
              },
              {
                step: '2',
                title: 'Connect WhatsApp',
                description: 'We set up a dedicated WhatsApp number for your bookings.',
              },
              {
                step: '3',
                title: 'Start Taking Bookings',
                description: 'Share your number with guests and let the bot do the rest.',
              },
            ].map((s) => (
              <div key={s.step}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {s.step}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-6">
            <FaqItem
              question="Do I need to be on the NaijaDine marketplace?"
              answer="No. The WhatsApp bot is a standalone product — you don't need a marketplace listing to use it. Of course, you can combine both for maximum reach."
            />
            <FaqItem
              question="Can I customise the bot's messages?"
              answer="Yes. On the Professional plan and above, you can set a custom bot name, greeting, and personality that matches your restaurant's brand."
            />
            <FaqItem
              question="How do deposit payments work?"
              answer="When a guest books, the bot can prompt them to pay a deposit via a secure Paystack link. Funds go directly to your account minus a small processing fee."
            />
            <FaqItem
              question="What happens outside operating hours?"
              answer="The bot works 24/7 — it will take bookings even at 2 AM. You can set operating hours in the dashboard so the bot only offers available time slots."
            />
            <FaqItem
              question="Is there a long-term contract?"
              answer="No. All plans are month-to-month with no lock-in. You can upgrade, downgrade, or cancel at any time."
            />
            <FaqItem
              question="Can I use it for multiple restaurant locations?"
              answer="Yes. The Enterprise plan supports multiple locations under a single account, each with its own WhatsApp number and settings."
            />
            <FaqItem
              question="What if a guest has a complex request?"
              answer="The bot handles standard bookings and common questions. For anything it can't answer, it seamlessly hands off to your staff via a notification."
            />
          </div>
        </div>
      </section>

      {/* ── 9. Final CTA ── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-2xl bg-brand p-10 text-center">
            <h2 className="text-2xl font-bold text-white">
              Ready to Automate Your Reservations?
            </h2>
            <p className="mt-2 text-brand-200">
              Join 50+ restaurants already saving time and reducing no-shows
              with NaijaDine&apos;s WhatsApp bot.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/whatsapp/get-started"
                className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-brand-800 transition hover:bg-gold-400"
              >
                Get Started Now
              </Link>
              <Link
                href="/contact"
                className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── Local Helper Components ─── */

function ChatBubble({
  from,
  children,
}: {
  from: 'bot' | 'user';
  children: React.ReactNode;
}) {
  const isBot = from === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
          isBot ? 'bg-white text-gray-800' : 'text-white'
        }`}
        style={!isBot ? { backgroundColor: '#DCF8C6', color: '#111' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function StepCallout({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  color,
  icon,
  title,
  description,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  highlight,
  cta,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
  cta: { label: string; href: string; gold?: boolean };
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-6 ${
        highlight
          ? 'border-brand bg-brand-50/30 ring-1 ring-brand'
          : 'border-gray-200 bg-white'
      }`}
    >
      {highlight && (
        <span className="mb-3 inline-block self-start rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-white">
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <div className="mt-3">
        <span className="text-3xl font-bold text-gray-900">{price}</span>
        {period && <span className="text-sm text-gray-500">{period}</span>}
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6 pt-2">
        <Link
          href={cta.href}
          className={`block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
            cta.gold
              ? 'bg-gold text-brand-800 hover:bg-gold-400'
              : highlight
                ? 'bg-brand text-white hover:bg-brand-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{question}</h3>
      <p className="mt-1 text-sm text-gray-600">{answer}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
