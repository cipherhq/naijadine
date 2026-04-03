import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Get Started - NaijaDine',
  description: 'Set up your business on NaijaDine with WhatsApp automation',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-brand">
            NaijaDine
          </Link>
          <span className="text-sm text-gray-500">Business Setup</span>
        </div>
      </header>
      {children}
    </div>
  );
}
