import type { Metadata, Viewport } from 'next';
import { Lexend, Poppins } from 'next/font/google';

import { BUSINESS } from '@/config/business';
import { PwaRegistrar } from '@/components/pwa/register';
import { ToastProvider } from '@/components/ui/toast';
import { AdminEditProvider } from '@/app/context/AdminEditContext';
import { EditModeToggle } from '@/components/admin/EditModeToggle';
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
    throw new Error(
      `NEXT_PUBLIC_APP_URL is not a valid URL (${raw.length} characters). ` +
        'It should look like https://bewholecare.vercel.app — with the ' +
        'protocol, no trailing slash, and no quotes around it.',
    );
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
  openGraph: {
    type: 'website',
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — ${BUSINESS.tagline}`,
    description: BUSINESS.promise,
    locale: 'en_ZA',
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
  },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Secure check: Only render the edit toggle for authorized admin sessions
  const isAdmin = true; // Change this to evaluate your auth session when ready

  return (
    <html lang="en-ZA" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest-900 focus:px-5 focus:py-3 focus:text-sm focus:text-cream-100"
        >
          Skip to content
        </a>
        <AdminEditProvider>
          <ToastProvider>
            {children}
            <PwaRegistrar />
            {isAdmin && <EditModeToggle />}
          </ToastProvider>
        </AdminEditProvider>
      </body>
    </html>
  );
}