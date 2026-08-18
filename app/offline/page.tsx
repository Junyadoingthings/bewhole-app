import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { ArcMotif } from '@/components/site/decor';
import { BUSINESS } from '@/config/business';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
      <ArcMotif className="-right-24 -top-24 h-96 w-96 text-forest-300/25" />

      <div className="relative">
        <Logo className="mx-auto" />

        <span className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-white text-forest-700 dark:text-forest-300 shadow-subtle">
          <WifiOff className="h-7 w-7" />
        </span>

        <h1 className="mt-8 font-display text-3xl text-ink text-balance">You’re offline</h1>
        <p className="mx-auto mt-4 max-w-sm leading-relaxed text-ink-soft text-pretty">
          We can’t reach Be Whole Care right now. Your appointments are safe — they’ll be here as
          soon as you’re back on a connection.
        </p>

        <div className="mt-8 space-y-2 text-sm">
          <p className="text-ink-muted">
            Need us urgently? Call or WhatsApp{' '}
            <a href={`tel:${BUSINESS.phone}`} className="font-medium text-forest-700 dark:text-forest-300">
              {BUSINESS.phone}
            </a>
          </p>
          <p className="text-ink-faint">
            In an emergency, contact emergency services on 112 or SADAG on 0800 456 789.
          </p>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream-100"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
