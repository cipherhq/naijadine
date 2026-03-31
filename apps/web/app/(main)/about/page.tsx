import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us — NaijaDine',
  description: 'Learn about NaijaDine — Nigeria\'s premier restaurant discovery and reservation platform.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">About NaijaDine</h1>
      <p className="mt-4 text-lg text-gray-600">
        Discover. Reserve. Dine.
      </p>

      <div className="mt-10 space-y-8 text-gray-600">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">Our Mission</h2>
          <p className="mt-3">
            NaijaDine is Nigeria&apos;s premier restaurant discovery and reservation platform.
            We connect diners with the best restaurants across Lagos, Abuja, and Port Harcourt,
            making it effortless to find and book a table at your perfect dining spot.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">What We Offer</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 p-5">
              <h3 className="font-medium text-gray-900">For Diners</h3>
              <ul className="mt-2 space-y-2 text-sm">
                <li>Browse restaurants by cuisine, location, and price</li>
                <li>Book tables instantly online or via WhatsApp</li>
                <li>Access exclusive deals and promotions</li>
                <li>Manage your reservations in one place</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-100 p-5">
              <h3 className="font-medium text-gray-900">For Restaurants</h3>
              <ul className="mt-2 space-y-2 text-sm">
                <li>Reach new customers across Nigeria</li>
                <li>Manage reservations with a powerful dashboard</li>
                <li>Accept bookings via web, WhatsApp, and phone</li>
                <li>Reduce no-shows with deposit collection</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">Our Cities</h2>
          <p className="mt-3">
            We&apos;re currently live in Lagos, Abuja, and Port Harcourt, with plans to
            expand to more cities across Nigeria. From fine dining to beloved local
            spots, we curate the best dining experiences in every city we serve.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">Get in Touch</h2>
          <p className="mt-3">
            Have questions or want to partner with us?{' '}
            <Link href="/contact" className="font-medium text-brand hover:underline">
              Contact our team
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
