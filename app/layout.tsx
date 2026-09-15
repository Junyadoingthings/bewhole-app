import type { Metadata, Viewport } from 'next';
import { Lexend, Poppins } from 'next/font/google';

import { BUSINESS } from '@/config/business';
import { PwaRegistrar } from '@/components/pwa/register';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const display = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const sans = Lexend({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
});

function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return new URL('http://localhost:5600');
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol.replace(/\/+$/, ''));
  } catch {
    return new URL('https://bewholecare.co.za');
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: `${BUSINESS.name} — ${BUSINESS.tagline}`,
    template: `%s · ${BUSINESS.name}`,
  },
  description: BUSINESS.promise,
  applicationName: BUSINESS.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: BUSINESS.name },
  formatDetection: { telephone: true },
  robots: { index: true, follow: true, nocache: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans">
        <ToastProvider>
          {children}
          <PwaRegistrar />
        </ToastProvider>
      </body>
    </html>
  );
}