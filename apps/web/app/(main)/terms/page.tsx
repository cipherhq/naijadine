import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — NaijaDine',
  description: 'NaijaDine terms of service — the rules and guidelines for using our platform.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using NaijaDine (&ldquo;the Platform&rdquo;), you agree to be bound by these
            Terms of Service. If you do not agree to these terms, please do not use our platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Our Service</h2>
          <p className="mt-3">
            NaijaDine provides a platform for discovering restaurants and making reservations
            in Nigeria. We act as an intermediary between diners and restaurants. We do not
            operate any restaurants ourselves.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Account Registration</h2>
          <p className="mt-3">
            To make reservations, you must create an account with accurate information.
            You are responsible for maintaining the security of your account and for all
            activities under your account. You must be at least 18 years old to create an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Reservations</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Reservations are subject to availability and restaurant confirmation.</li>
            <li>You agree to honour your reservations or cancel within the restaurant&apos;s cancellation window.</li>
            <li>Repeated no-shows may result in account suspension.</li>
            <li>Some restaurants require a deposit to secure your booking. Deposits are processed securely via Paystack.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Deposits & Payments</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Deposits are collected on behalf of restaurants and are applied to your dining bill.</li>
            <li>Cancellations made within the restaurant&apos;s cancellation window are eligible for a full refund.</li>
            <li>Late cancellations or no-shows may result in deposit forfeiture, at the restaurant&apos;s discretion.</li>
            <li>Refunds are processed within 5-10 business days to your original payment method.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. User Conduct</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Provide false or misleading information.</li>
            <li>Use the platform for any unlawful purpose.</li>
            <li>Attempt to access other users&apos; accounts or data.</li>
            <li>Submit abusive, offensive, or spam content in reviews or messages.</li>
            <li>Interfere with the platform&apos;s operation or security.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Reviews</h2>
          <p className="mt-3">
            By submitting a review, you grant NaijaDine a non-exclusive licence to display
            your review on our platform. Reviews must be honest, based on genuine dining
            experiences, and free of offensive content. We reserve the right to moderate
            or remove reviews that violate these guidelines.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. Restaurant Partners</h2>
          <p className="mt-3">
            Restaurant information, including menus, photos, and prices, is provided by the
            restaurants themselves. While we strive for accuracy, NaijaDine is not responsible
            for the accuracy of restaurant-provided content or the quality of dining experiences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Limitation of Liability</h2>
          <p className="mt-3">
            NaijaDine is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable
            for any damages arising from your use of the platform, including but not limited
            to dining experiences, payment disputes, or service interruptions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">10. Changes to Terms</h2>
          <p className="mt-3">
            We may update these terms from time to time. Continued use of the platform
            after changes constitutes acceptance of the updated terms. We will notify
            you of significant changes via email or platform notification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">11. Governing Law</h2>
          <p className="mt-3">
            These terms are governed by the laws of the Federal Republic of Nigeria.
            Any disputes shall be resolved in the courts of Lagos, Nigeria.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">12. Contact</h2>
          <p className="mt-3">
            For questions about these terms, contact us at{' '}
            <a href="mailto:legal@naijadine.com" className="text-brand hover:underline">
              legal@naijadine.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
