import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — NaijaDine',
  description: 'NaijaDine privacy policy — how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Information We Collect</h2>
          <p className="mt-3">When you use NaijaDine, we may collect the following information:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Account information:</strong> name, email address, phone number, and city.</li>
            <li><strong>Booking information:</strong> restaurant, date, time, party size, special requests, and payment details.</li>
            <li><strong>Usage data:</strong> pages visited, features used, and interaction patterns to improve our service.</li>
            <li><strong>Device information:</strong> browser type, operating system, and IP address.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. How We Use Your Information</h2>
          <p className="mt-3">We use your information to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Process and manage your restaurant reservations.</li>
            <li>Send booking confirmations, reminders, and updates via email, SMS, or WhatsApp.</li>
            <li>Improve our platform, features, and user experience.</li>
            <li>Communicate with you about your account and our services.</li>
            <li>Process payments and deposits securely through our payment providers.</li>
            <li>Prevent fraud, abuse, and enforce our terms of service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Information Sharing</h2>
          <p className="mt-3">
            We share your information only as necessary to provide our services:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Restaurants:</strong> your name, phone number, party size, and special requests are shared with the restaurant when you make a booking.</li>
            <li><strong>Payment processors:</strong> payment information is securely handled by Paystack. We do not store your full card details.</li>
            <li><strong>Service providers:</strong> we use trusted providers for email delivery, SMS, and hosting.</li>
          </ul>
          <p className="mt-3">We do not sell your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Data Security</h2>
          <p className="mt-3">
            We implement industry-standard security measures to protect your data, including
            encrypted connections (HTTPS), secure authentication, and access controls. However,
            no method of transmission over the internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Your Rights</h2>
          <p className="mt-3">You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access and review the personal information we hold about you.</li>
            <li>Update or correct your information through your account settings.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Opt out of marketing communications at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. Cookies</h2>
          <p className="mt-3">
            We use essential cookies to keep you signed in and maintain your session.
            We may also use analytics cookies to understand how our platform is used.
            You can control cookies through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this privacy policy from time to time. We will notify you of
            any significant changes by posting a notice on our platform or sending you
            an email.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this privacy policy or your personal data, please
            contact us at{' '}
            <a href="mailto:privacy@naijadine.com" className="text-brand hover:underline">
              privacy@naijadine.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
