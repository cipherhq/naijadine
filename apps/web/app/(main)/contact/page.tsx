import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — DineRoot',
  description: 'Get in touch with the DineRoot team. We\'d love to hear from you.',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
      <p className="mt-4 text-gray-600">
        Have a question, feedback, or want to list your restaurant? We&apos;d love to hear from you.
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">General Enquiries</h2>
            <p className="mt-1 text-sm text-gray-600">
              <a href="mailto:hello@dineroot.com" className="text-brand hover:underline">
                hello@dineroot.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">Restaurant Partnerships</h2>
            <p className="mt-1 text-sm text-gray-600">
              Want to list your restaurant on DineRoot?
            </p>
            <p className="mt-1 text-sm text-gray-600">
              <a href="mailto:partners@dineroot.com" className="text-brand hover:underline">
                partners@dineroot.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">Support</h2>
            <p className="mt-1 text-sm text-gray-600">
              Need help with a reservation or your account?
            </p>
            <p className="mt-1 text-sm text-gray-600">
              <a href="mailto:support@dineroot.com" className="text-brand hover:underline">
                support@dineroot.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">WhatsApp</h2>
            <p className="mt-1 text-sm text-gray-600">
              Chat with us on WhatsApp for quick support.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Send a Message</h2>
          <form className="mt-4 space-y-4" action="mailto:hello@dineroot.com" method="GET">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="subject"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="from"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
              <textarea
                name="body"
                rows={4}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
