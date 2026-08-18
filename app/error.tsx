'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { ArcMotif } from '@/components/site/decor';
import { Button, ButtonLink } from '@/components/ui/button';
import { BUSINESS } from '@/config/business';

/**
 * Client-facing error boundary.
 *
 * Never shows a stack trace or a provider message — those go to the server log.
 * The client gets a plain explanation and a way forward.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[bwc] unhandled error', error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
      <ArcMotif className="-right-24 -top-24 h-96 w-96 text-forest-300/25" />

      <div className="relative">
        <Logo className="mx-auto" />

        <h1 className="mt-12 font-display text-3xl text-ink text-balance">
          Something went wrong on our side
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-ink-soft text-pretty">
          Nothing you did caused this, and nothing has been lost. Try again — if it keeps happening,
          give us a call and we’ll sort it out with you directly.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            Back to home
          </ButtonLink>
        </div>

        <p className="mt-10 text-sm text-ink-faint">
          <a href={`tel:${BUSINESS.phone}`} className="text-forest-700 dark:text-forest-300">
            {BUSINESS.phone}
          </a>{' '}
          ·{' '}
          <Link href="/contact" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
            contact us
          </Link>
          {error.digest && <span className="ml-2 text-ink-faint/70">ref {error.digest}</span>}
        </p>
      </div>
    </div>
  );
}
