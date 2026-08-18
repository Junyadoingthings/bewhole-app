import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forms';
import { BUSINESS } from '@/config/business';

export const metadata: Metadata = { title: 'Set or reset password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Set or reset your password</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        If you booked without creating an account, this is how you get into your portal for the
        first time.
      </p>

      <ForgotPasswordForm />

      <p className="mt-8 text-sm leading-relaxed text-ink-soft">
        Prefer to speak to someone? Call or WhatsApp {BUSINESS.phone}.{' '}
        <Link href="/sign-in" className="font-medium text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
