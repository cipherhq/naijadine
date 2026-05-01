import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">DineRoot</h3>
            <p className="mt-2 text-sm text-gray-500">
              Discover. Reserve. Dine.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Discover</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/restaurants?city=lagos" className="text-sm text-gray-500 hover:text-brand">
                  Lagos
                </Link>
              </li>
              <li>
                <Link href="/restaurants?city=abuja" className="text-sm text-gray-500 hover:text-brand">
                  Abuja
                </Link>
              </li>
              <li>
                <Link href="/restaurants?city=port_harcourt" className="text-sm text-gray-500 hover:text-brand">
                  Port Harcourt
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Company</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-gray-500 hover:text-brand">
                  About
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-gray-500 hover:text-brand">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-500 hover:text-brand">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/whatsapp" className="text-sm text-gray-500 hover:text-brand">
                  WhatsApp Bot
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-gray-500 hover:text-brand">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-500 hover:text-brand">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} DineRoot. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
