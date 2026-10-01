import Link from 'next/link';
import { X } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { BUSINESS } from '@/config/business';

/**
 * The booking flow gets its own chrome. No site nav, no footer, no assistant —
 * one job on screen at a time, with an obvious way out.
 */
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream-50 dark:bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-cream-50/95 dark:bg-card/95">
        <div className="shell flex h-18 items-center justify-between">
          <Link href="/" aria-label={`${BUSINESS.name} home`}>
            <Logo />
          </Link>
          {/* The "Need help?" phone button was removed at the practice's request (2026-10). */}
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:text-ink"
            aria-label="Leave booking"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main id="main" className="shell flex-1 pb-32 pt-10 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
