'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarDays, RefreshCw, Users } from 'lucide-react';

/**
 * Scoped error boundary for the admin console.
 *
 * Before this file, an exception on the dashboard bubbled to the root error
 * page — a full-screen "Something went wrong on our side" that replaced the
 * entire console, sidebar and all. Signing in then looked like it had failed,
 * when in fact the session was fine and only the summary page was broken.
 *
 * Now the failure is contained: the shell stays, the message says which part
 * broke, and the rest of the console is one tap away. A practice should not
 * lose access to today's appointments because a revenue chart threw.
 *
 * `reset()` re-renders the segment without a full page load, so a transient
 * failure (a dropped connection, a cold start) recovers on one tap.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaces in the runtime logs with the digest shown to the user, so a
    // reported reference can be matched to the actual stack.
    console.error('[bwc:admin] segment error', error.digest, error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-3xl border border-line bg-card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-state-dangerSoft text-state-danger">
          <AlertCircle className="h-6 w-6" />
        </span>

        <h1 className="mt-5 font-display text-xl font-semibold text-ink">
          This page didn’t load
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          You are still signed in, and nothing has been lost. The rest of the console is working —
          this one page failed to build its summary.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-forest-900"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/admin/appointments"
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-forest-300"
          >
            <CalendarDays className="h-4 w-4" />
            Appointments
          </Link>
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-forest-300"
          >
            <Users className="h-4 w-4" />
            Clients
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-ink-faint">Reference {error.digest}</p>
        )}
      </div>
    </div>
  );
}
