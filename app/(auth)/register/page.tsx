import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/forms';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'CLIENT' ? '/portal' : '/admin');

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Create your account</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        So you can manage appointments, see session links and book again in a tap.
      </p>

      <RegisterForm next={searchParams.next} />

      <p className="mt-8 text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
