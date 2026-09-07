import type { Metadata } from 'next';

import { ConsentPageBody } from '@/components/consent/consent-page-body';

export const metadata: Metadata = {
  title: 'Informed consent',
  description:
    'The informed consent agreement for counselling with Be Whole Care — readable, printable, and given before your first session.',
};

/**
 * The consent form as a standalone, printable document.
 *
 * Exists separately from the copy inside the booking flow so that:
 *   - someone can read it BEFORE starting a booking, without committing to one
 *   - the practice can print blank copies for in-person sessions
 *   - a client can save their own copy at any time afterwards
 *
 * The clause text itself comes from config/business.ts, so this page and the
 * booking step can never drift apart.
 */
export default function ConsentPage() {
  return (
    <div className="shell max-w-3xl py-14 sm:py-20">
      <ConsentPageBody />
    </div>
  );
}
