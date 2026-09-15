
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, PRACTITIONER } from '@/config/business';
import { PHOTOS } from '@/config/photos';

/**
 * The welcome.
 *
 * ── Two layouts, one DOM order ────────────────────────────────────────────
 * Three blocks — words, portrait, action — in that order in the markup:
 *
 *    phone/tablet  a centred column, read top to bottom: headline, face,
 *                  button. The face arrives before the ask.
 *    desktop (lg)  a two-column grid. Words and button stack in the left
 *                  column; the portrait spans both rows on the right.
 *
 * Desktop placement is done with explicit `col-start`/`row-start` rather than
 * `order-*`, so the reading order never diverges from the DOM order — a screen
 * reader and a sighted visitor get the same sequence.
 *
 * The centred phone layout used to be reused unchanged on a laptop, leaving a
 * narrow ribbon of centred text stranded in a wide screen with the headline
 * looking undersized. Desktop now has room to put the words beside the face.
 *
 * ── Type scale ────────────────────────────────────────────────────────────
 * The headline clamp runs to 4.75rem instead of 3.75rem, and the supporting
 * lines step up at `lg`. The clamp's lower bound is untouched, so the phone
 * layout — which fits headline, face and button on one screen — is unchanged.
 */
export function Hero() {
  const portrait = PHOTOS.practitionerAlt;

  return (
    <section className="bg-canvas-sunk">
      <div className="shell flex flex-col items-center py-8 text-center sm:py-14 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24 lg:text-left xl:gap-20">
        {/* 1 — Words. Left column on desktop. */}
        <div className="lg:col-start-1 lg:row-start-1">
          <h1 className="font-display text-[clamp(2.125rem,6vw,4.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-ink">
            <span>Welcome to</span>
            <br />
            <span className="text-forest-800">Be Whole Care.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl font-display text-sm font-semibold uppercase leading-snug tracking-[0.02em] text-forest-700 sm:text-base lg:mx-0 lg:mt-6 lg:text-xl">
            Professional counselling services & psychological support
          </p>

          {/*
            Hidden on phones. It is the most expensive block up here — four
            lines — and without it the headline, her face and the booking
            button fit a small phone's screen together. The same sentence
            opens the About page and the footer, so nothing is lost.
          */}
          <p className="mx-auto mt-4 hidden max-w-xl leading-relaxed text-ink-muted text-pretty sm:block sm:text-base lg:mx-0 lg:mt-6 lg:text-lg">
            {BUSINESS.promise}
          </p>
        </div>

        {/* 2 — Portrait and credential. Right column on desktop, spanning both rows. */}
        <div className="mt-7 flex flex-col items-center sm:mt-9 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
          <div className="relative aspect-[4/5] w-full max-w-[13.5rem] overflow-hidden rounded-[1.75rem] bg-canvas shadow-lifted sm:max-w-[15rem] lg:max-w-[22rem] xl:max-w-[24rem]">
            <Image
              src={portrait.src}
              alt={`${PRACTITIONER.name}, ${PRACTITIONER.title}`}
              fill
              priority
              quality={90}
              sizes="(min-width: 1280px) 24rem, (min-width: 1024px) 22rem, (min-width: 640px) 15rem, 13.5rem"
              style={{ objectPosition: portrait.position }}
              className="object-cover"
            />
          </div>

          {/* The name tag. Small on purpose — it identifies, it does not sell. */}
          <div className="mt-4 text-center">
            <p className="font-display text-base font-semibold text-ink sm:text-lg lg:text-xl">
              {PRACTITIONER.name} ({PRACTITIONER.qualification})
            </p>
            <p className="mt-0.5 text-xs text-ink-muted sm:text-sm lg:text-base">
              {PRACTITIONER.title} ({PRACTITIONER.council})
            </p>
            <p className="mt-0.5 text-2xs text-ink-soft sm:text-xs lg:text-sm">
              Pr.No. {PRACTITIONER.practiceNumber}
            </p>
          </div>
        </div>

        {/*
          3 — The action. Under the words in the left column on desktop.
          `lg:self-start` matters: the portrait spans both grid rows and is
          taller than the copy, so row 2 is tall. Without self-start the
          button centres in that row and floats in a pocket of dead space
          well below the paragraph it belongs to.
        */}
        <div className="w-full lg:col-start-1 lg:row-start-2 lg:w-auto lg:self-start">
          <ButtonLink
            href="/book"
            size="lg"
            className="group mt-7 w-full sm:w-auto lg:mt-8 lg:text-base"
          >
            <span>Schedule your session here</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:translate-x-1" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}