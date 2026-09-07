'use client';

import * as React from 'react';

import { ConsentForm } from '@/components/consent/consent-form';

/**
 * Client wrapper for the standalone consent page.
 *
 * The consent form is interactive (checkboxes, print button), so it needs
 * client state — but the page around it stays a server component. Ticking
 * boxes here records nothing: this copy is for reading, printing and signing
 * on paper. The binding version is the one inside the booking flow, which is
 * stored against the client's record.
 */
export function ConsentPageBody() {
  const [value, setValue] = React.useState<Record<string, boolean>>({});

  return (
    <>
      <ConsentForm value={value} onChange={setValue} />
      <p className="no-print mt-8 rounded-2xl border border-line bg-canvas-sunk p-5 text-sm leading-relaxed text-ink-soft">
        Ticking the boxes on this page is for your own reading — nothing is
        submitted from here. You will be asked to confirm these same points when
        you book a session, and that is the copy the practice keeps on record.
      </p>
    </>
  );
}
