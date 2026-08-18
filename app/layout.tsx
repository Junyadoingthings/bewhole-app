import type { Metadata, Viewport } from 'next';
import { Lexend, Poppins } from 'next/font/google';

import { BUSINESS } from '@/config/business';
import { PwaRegistrar } from '@/components/pwa/register';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

/**
 * Headings are a bold geometric sans, not a serif.
 *
 * This started on Fraunces, which gave the site an editorial, magazine voice.
 * The practice's own site sets its headings in a heavy uppercase sans — the
 * register of a clinic rather than a lifestyle brand — and that is the one we
 * follow. Poppins is the closest widely-available match to it.
 *
 * Lexend stays for body copy: it was designed for reading ease, which matters
 * for people reading terms and policies while stressed.
 */
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

/**
 * The public site URL, tolerant of how it is usually mistyped.
 *
 * `new URL('bewholecare.vercel.app')` throws — a bare hostname is not a URL —
 * and because this runs while collecting page data, it takes the whole build
 * down with `TypeError: Invalid URL`. Worse, if the variable is marked
 * Sensitive in the host's dashboard the offending value is printed as
 * [REDACTED], so the log cannot tell you what was wrong.
 *
 * So: accept a bare host by assuming https, trim a trailing slash, and if it
 * still will not parse, fail with a message that names the variable instead of
 * a stack trace from deep inside Node.
 */
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
    // Client surfaces must never be indexed.
    nocache: true,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png' }],
  },
};

export const viewport: Viewport = {
  // Matches the white canvas, so the iOS status bar blends into the page
  // instead of banding against it.
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Light only. A dark theme was built and then removed: this is a clinical
    // service whose own brand is a white page, and a second palette doubled the
    // surface area of every visual change for no benefit anyone asked for.
    // The `dark:` variants left in the markup are inert — nothing adds the
    // class now — and are harmless to leave until they are next touched.
    <html lang="en-ZA" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest-900 focus:px-5 focus:py-3 focus:text-sm focus:text-cream-100"
        >
          Skip to content
        </a>
        <ToastProvider>
          {children}
          <PwaRegistrar />
        </ToastProvider>
      </body>
    </html>
  );
}
