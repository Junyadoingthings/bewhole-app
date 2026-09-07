import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/forms';
import { GoogleButton } from '@/components/auth/google-button';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

/**
 * Messages for the ways a Google sign-in can end badly. Each maps to a code
 * set by /api/auth/google/callback. Written to say what happened and what to
 * do next, without leaking whether an account exists.
 */
const OAUTH_ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not set up yet. Please use your email and password.',
  google_failed: 'We could not complete that Google sign-in. Please try again.',
  google_state: 'That sign-in link expired. Please try again.',
  google_unverified:
    'Your Google account’s email address is not verified, so we cannot use it to sign in.',
  account_disabled: 'That account is not active. Please give us a call and we will sort it out.',
  slow: 'Signing in is taking longer than usual right now. Please try again.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'CLIENT' ? '/portal' : '/admin');

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Sign in to see your appointments, session links and payments.
      </p>

      {searchParams.error && OAUTH_ERRORS[searchParams.error] && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-state-danger/25 bg-state-dangerSoft px-4 py-3 text-sm text-state-danger"
        >
          {OAUTH_ERRORS[searchParams.error]}
        </p>
      )}

      <GoogleButton next={searchParams.next} />

      <LoginForm next={searchParams.next} />

      <p className="mt-8 text-sm text-ink-soft">
        Don’t have an account yet?{' '}
        <Link href="/register" className="font-medium text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
          Create one
        </Link>
        {' — '}or{' '}
        <Link href="/book" className="font-medium text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
          book without signing in
        </Link>
        .
      </p>
    </div>
  );
}
