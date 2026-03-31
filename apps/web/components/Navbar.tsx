'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-brand">
          NaijaDine
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/restaurants"
            className={`text-sm font-medium transition ${
              pathname.startsWith('/restaurants')
                ? 'text-brand'
                : 'text-gray-600 hover:text-brand'
            }`}
          >
            Restaurants
          </Link>
          <Link
            href="/whatsapp"
            className={`text-sm font-medium transition ${
              pathname === '/whatsapp'
                ? 'text-brand'
                : 'text-gray-600 hover:text-brand'
            }`}
          >
            For Restaurants
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              <NotificationBell userId={user.id} />
              <Link
                href="/account"
                className="text-sm font-medium text-gray-600 hover:text-brand"
              >
                My Account
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/restaurants"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-gray-700"
            >
              Restaurants
            </Link>
            <Link
              href="/whatsapp"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-gray-700"
            >
              For Restaurants
            </Link>
            {user ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-gray-700"
                >
                  My Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left text-sm font-medium text-red-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-brand"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
