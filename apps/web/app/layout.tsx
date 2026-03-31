import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'NaijaDine — Discover. Reserve. Dine.',
    template: '%s | NaijaDine',
  },
  description:
    'Discover and book the best restaurants in Lagos, Abuja, and Port Harcourt. Reserve tables instantly, earn loyalty rewards, and enjoy exclusive deals.',
  metadataBase: new URL('https://naijadine.com'),
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: 'NaijaDine',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1B4332',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
