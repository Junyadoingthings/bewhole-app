import * as React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * Be Whole Care identity.
 *
 * `Logo` renders the practice's REGISTERED artwork — the actual file, not a
 * recreation. It was taken from the practice's own site, trimmed of its white
 * canvas and given a transparent background so it can sit on white, on the
 * grey band and on the forest footer.
 *
 * An earlier version of this file redrew the mark as hand-authored SVG paths.
 * That was wrong: a registered logo has a defined form, and "very close" is
 * not the same thing. Do not replace this <Image> with drawn paths again.
 *
 * The source is 186x112 with the leaves overlapping the "b" — that overlap is
 * part of the artwork, so nothing here needs to position it.
 */

/** Intrinsic size of public/logo.png after trimming. */
const LOGO_W = 186;
const LOGO_H = 112;

export function Logo({
  className,
  variant = 'dark',
}: {
  className?: string;
  /** `dark` for light backgrounds, `light` for forest panels. */
  variant?: 'dark' | 'light';
}) {
  return (
    <Image
      src="/logo.png"
      alt="Be Whole Care"
      width={LOGO_W}
      height={LOGO_H}
      priority
      className={cn(
        'h-11 w-auto',
        /**
         * On a forest panel the green-on-brown mark disappears. `brightness-0
         * invert` renders the exact same shapes in solid white, which is the
         * conventional treatment for a logo on a dark ground — and preserves
         * the artwork's form, unlike recolouring it by hand.
         */
        variant === 'light' && 'brightness-0 invert',
        className,
      )}
    />
  );
}

/** Single-line lockup for tight spaces. Same artwork, smaller. */
export function LogoCompact({
  className,
  variant = 'dark',
}: {
  className?: string;
  variant?: 'dark' | 'light';
}) {
  return <Logo variant={variant} className={cn('h-8 w-auto', className)} />;
}

/**
 * The leaves alone, as a square glyph.
 *
 * Used where a lockup would not fit and the words appear beside it anyway —
 * the portal and admin sidebars, the mobile bar. This one is drawn, because it
 * is an icon derived from the mark rather than the mark itself, and it needs
 * to take `currentColor` to tint against different panels.
 */
const LEAF = 'M0 0C5.2-8.4 14.2-14 24-15.4 22.2-5.9 13.8 0.7 0 0Z';

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 44" className={cn('h-8 w-8', className)} role="img" aria-label="Be Whole Care">
      <g fill="currentColor">
        <g transform="translate(21 34) rotate(-72)">
          <path d={LEAF} />
        </g>
        <g transform="translate(21.5 34) rotate(-107) scale(0.94)">
          <path d={LEAF} />
        </g>
        <g transform="translate(20 34) rotate(-158) scale(0.68)">
          <path d={LEAF} />
        </g>
      </g>
    </svg>
  );
}
