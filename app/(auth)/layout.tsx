import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { BUSINESS } from '@/config/business';

/**
 * Sign in / register.
 *
 * A single centred card on the grey band, matching the rest of the site.
 *
 * This used to be a split screen: a full-height forest panel carrying a
 * vignetted photograph, botanical line art and the tagline, beside the form.
 * It was the last page still wearing the old editorial styling, and it made
 * the lightest page in the app one of the heaviest — a large image plus two
 * decorative components, loaded before anyone could type a password.
 *
 * Nothing here queries the database for a signed-out visitor, so the form is
 * on screen immediately.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas-sunk">
      <header className="shell flex items-center justify-between py-6">
        <Link href="/" aria-label={`${BUSINESS.name} home`}>
          <Logo className="h-10 w-auto" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to site</span>
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pb-24">
        <div className="w-full max-w-md rounded-3xl border border-line bg-card p-7 shadow-card sm:p-9">
          {children}
        </div>
      </main>

      <footer className="shell pb-8 text-center text-xs text-ink-soft">
        <a href={`tel:${BUSINESS.phone}`} className="hover:text-ink">
          {BUSINESS.phone}
        </a>
        {' · '}
        <a href={`mailto:${BUSINESS.email}`} className="hover:text-ink">
          {BUSINESS.email}
        </a>
      </footer>
    </div>
  );
}
