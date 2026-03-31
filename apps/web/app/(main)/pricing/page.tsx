import type { Metadata } from 'next';
import Link from 'next/link';
import { PRICING, FEES } from '@naijadine/shared';

export const metadata: Metadata = {
  title: 'Pricing — NaijaDine',
  description: 'NaijaDine pricing plans for restaurants. List your restaurant and start accepting reservations.',
};

function formatPrice(price: number | null) {
  if (price === null) return 'Custom';
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);
}

export default function PricingPage() {
  const marketplace = PRICING.marketplace;
  const standalone = PRICING.whatsapp_standalone;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Simple, Transparent Pricing</h1>
        <p className="mt-3 text-gray-600">
          Choose the plan that fits your restaurant. No hidden fees.
        </p>
      </div>

      {/* Marketplace Plans */}
      <div className="mt-14">
        <h2 className="text-center text-xl font-semibold text-gray-900">Marketplace</h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Get discovered by diners on naijadine.com
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {/* Free */}
          <PlanCard
            name={marketplace.free.name}
            price={formatPrice(marketplace.free.price)}
            period="/month"
            features={[
              'Up to 50 bookings/month',
              'Listed on NaijaDine',
              'Reservation dashboard',
              'Email confirmations',
              `${FEES.commissionRate}% commission on deposits`,
            ]}
          />

          {/* Standard */}
          <PlanCard
            name={marketplace.standard.name}
            price={formatPrice(marketplace.standard.price)}
            period="/month"
            highlight
            features={[
              'Unlimited bookings',
              'Priority listing',
              'Deals & promotions',
              'Review management',
              `${FEES.commissionRate}% commission on deposits`,
              'Analytics dashboard',
            ]}
          />

          {/* Premium */}
          <PlanCard
            name={marketplace.premium.name}
            price={formatPrice(marketplace.premium.price)}
            period="/month"
            features={[
              'Everything in Standard',
              'Featured placement',
              'Dedicated account manager',
              'Custom branding',
              'Priority support',
              'Advanced analytics',
            ]}
          />
        </div>
      </div>

      {/* WhatsApp Standalone Plans */}
      <div className="mt-20">
        <h2 className="text-center text-xl font-semibold text-gray-900">WhatsApp Booking Bot</h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Your own WhatsApp number for direct bookings
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {/* Starter */}
          <PlanCard
            name={standalone.starter.name}
            price={formatPrice(standalone.starter.price)}
            period="/month"
            features={[
              'Up to 100 bookings/month',
              'WhatsApp booking bot',
              'Reservation dashboard',
              'SMS & email notifications',
              'NaijaDine branding',
            ]}
          />

          {/* Professional */}
          <PlanCard
            name={standalone.professional.name}
            price={formatPrice(standalone.professional.price)}
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
          />

          {/* Enterprise */}
          <PlanCard
            name={standalone.enterprise.name}
            price={formatPrice(standalone.enterprise.price)}
            period=""
            features={[
              'Everything in Professional',
              'Multiple locations',
              'API access',
              'Custom integrations',
              'Dedicated support',
              'SLA guarantee',
            ]}
          />
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-20">
        <h2 className="text-center text-xl font-semibold text-gray-900">Common Questions</h2>
        <div className="mx-auto mt-8 max-w-2xl space-y-6">
          <FaqItem
            question="How does the commission work?"
            answer={`We charge a ${FEES.commissionRate}% commission on deposits collected through the platform. If your restaurant doesn\u2019t collect deposits, there\u2019s no commission to pay.`}
          />
          <FaqItem
            question="Can I switch plans?"
            answer="Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle."
          />
          <FaqItem
            question="Is there a contract?"
            answer="No long-term contracts. All plans are month-to-month and you can cancel anytime."
          />
          <FaqItem
            question="What payment methods do you accept?"
            answer="We accept bank transfers and card payments via Paystack for plan subscriptions."
          />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-2xl bg-brand p-10 text-center">
        <h2 className="text-2xl font-bold text-white">Ready to grow your restaurant?</h2>
        <p className="mt-2 text-brand-200">
          Join hundreds of restaurants already using NaijaDine.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/contact"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand transition hover:bg-gray-100"
          >
            Contact Sales
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-brand bg-brand-50/30 ring-1 ring-brand'
          : 'border-gray-200 bg-white'
      }`}
    >
      {highlight && (
        <span className="mb-3 inline-block rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-white">
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
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
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
