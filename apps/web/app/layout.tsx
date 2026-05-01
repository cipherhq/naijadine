import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'DineRoot — Discover. Reserve. Dine.',
    template: '%s | DineRoot',
  },
  description:
    'Discover and book the best restaurants across Africa. Nigeria, Ghana, Kenya, South Africa and more. Reserve tables instantly, earn loyalty rewards, and enjoy exclusive deals.',
  metadataBase: new URL('https://dineroot.com'),
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: 'DineRoot',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F04E37',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DineRoot" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ToastProvider>
          <div id="main-content">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
