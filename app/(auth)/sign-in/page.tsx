import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/forms';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'CLIENT' ? '/portal' : '/admin');

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Sign in to see your appointments, session links and payments.
      </p>

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
