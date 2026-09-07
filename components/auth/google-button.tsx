import Link from 'next/link';

import { googleOAuthConfigured } from '@/lib/auth/google';

/**
 * "Continue with Google".
 *
 * A server component on purpose: it reads whether OAuth is configured on the
 * server and renders NOTHING when it is not. A visible button that fails is
 * worse than no button — especially on a sign-in page, where a dead control
 * reads as "this site is broken" rather than "this option is unavailable".
 *
 * It is a plain link, not a form or a fetch: the OAuth flow is a full-page
 * redirect to Google and back, so there is no client-side state to manage and
 * nothing to hydrate. It works before React loads.
 */
export function GoogleButton({ next, label }: { next?: string; label?: string }) {
  if (!googleOAuthConfigured()) return null;

  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';

  return (
    <div className="mt-6">
      <Link
        href={href}
        prefetch={false}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-card text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-canvas-sunk"
      >
        {/* Google's mark, drawn inline so the button needs no network request
            and cannot be blocked by a tracker blocker. */}
        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.06 12.25c0-.83-.07-1.62-.21-2.39H12v4.51h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.5Z"
          />
          <path
            fill="#34A853"
            d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
          />
          <path
            fill="#FBBC05"
            d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.7a11.5 11.5 0 0 0 0 10.32l3.85-2.98Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.3 15.11.25 12 .25A11.5 11.5 0 0 0 1.7 6.84l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z"
          />
        </svg>
        {label ?? 'Continue with Google'}
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
