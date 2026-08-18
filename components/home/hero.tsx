import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { BUSINESS } from '@/config/business';
import { PHOTOS } from '@/config/photos';

/**
 * The welcome.
 *
 * ── Layout ────────────────────────────────────────────────────────────────
 * Three blocks — words, photographs, actions — placed explicitly on a grid
 * rather than reordered with `order-*`:
 *
 *   phone    words → photographs → actions   (DOM order, single column)
 *   desktop  words and actions stacked left, photographs spanning both rows
 *            on the right
 *
 * Putting the photographs before the buttons on a phone is the point: someone
 * sees who they would be talking to *before* they are asked to book, and both
 * arrive without scrolling. Explicit `col-start`/`row-start` at `lg` means the
 * DOM order never has to lie about the visual order.
 *
 * ── The portrait ──────────────────────────────────────────────────────────
 * One photograph, capped at 15rem on a phone. That cap is what lets the
 * headline, her face and the booking button share a single screen; at full
 * width the portrait alone filled the viewport and pushed the call to action
 * out of sight.
 */
export function Hero() {
  // The pink portrait only. The second, darker portrait was removed at the
  // practice's request — one photograph, used consistently everywhere.
  const portrait = PHOTOS.practitionerAlt;

  return (
    <section className="bg-canvas-sunk">
      <div className="shell grid gap-6 py-6 sm:gap-10 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:py-20">
        <div className="lg:col-start-1 lg:row-start-1">
          <h1 className="font-display text-[clamp(2.125rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            Welcome to
            <br />
            <span className="text-forest-800">Be Whole Care.</span>
          </h1>

          <p className="mt-4 max-w-md font-display text-sm font-semibold uppercase leading-snug tracking-[0.02em] text-forest-700 sm:text-base lg:text-lg">
            Professional counselling services &amp; psychological support
          </p>

          {/*
            Hidden on phones. It is the single most expensive block up here —
            four lines — and without it the headline, both faces and the
            booking button fit a small phone's screen together, which is the
            whole point of this layout. The same sentence opens the About page
            and the footer, so nothing is lost.
          */}
          <p className="mt-4 hidden max-w-md leading-relaxed text-ink-muted text-pretty sm:block sm:text-base">
            {BUSINESS.promise}
          </p>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {/*
            One portrait, capped so it stays clear of the fold on a phone —
            the headline, the photograph and the booking button share a screen.
          */}
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[15rem] overflow-hidden rounded-[1.75rem] bg-canvas shadow-lifted sm:max-w-xs lg:max-w-sm">
            <Image
              src={portrait.src}
              alt={portrait.alt}
              fill
              priority
              quality={88}
              sizes="(min-width: 1024px) 24rem, (min-width: 640px) 20rem, 15rem"
              style={{ objectPosition: portrait.position }}
              className="object-cover"
            />
          </div>
        </div>

        {/*
          One action. The terms button that sat beside it was removed — the
          terms are still one tap away from their own section further down and
          from the footer, and are acknowledged inside the booking flow where
          they actually bind.
        */}
        <div className="lg:col-start-1 lg:row-start-2">
          <ButtonLink href="/book" size="lg" className="group w-full sm:w-auto">
            Schedule your session here
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:translate-x-1" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
