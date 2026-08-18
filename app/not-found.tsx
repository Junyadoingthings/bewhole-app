import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { ArcMotif, BotanicalLines } from '@/components/site/decor';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS } from '@/config/business';

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
      <ArcMotif className="-left-32 -top-20 h-96 w-96 text-forest-300/25" />
      <BotanicalLines className="-right-16 bottom-0 h-2/3 text-forest-400/10" />

      <div className="relative">
        <Logo className="mx-auto" />
        <p className="mt-12 font-display text-6xl text-forest-700 dark:text-forest-300">404</p>
        <h1 className="mt-4 font-display text-3xl text-ink text-balance">
          We couldn’t find that page
        </h1>
        <p className="mx-auto mt-4 max-w-sm leading-relaxed text-ink-soft text-pretty">
          It may have moved, or the link may be out of date. Everything else is where you left it.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            Back to Be Whole Care
          </ButtonLink>
          <ButtonLink href="/book" variant="secondary" size="lg">
            Book an appointment
          </ButtonLink>
        </div>

        <p className="mt-10 text-sm text-ink-faint">
          Looking for something specific? Call or WhatsApp{' '}
          <a href={`tel:${BUSINESS.phone}`} className="text-forest-700 dark:text-forest-300">
            {BUSINESS.phone}
          </a>{' '}
          ·{' '}
          <Link href="/contact" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
            contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
