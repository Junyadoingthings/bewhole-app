'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

import { BUSINESS } from '@/config/business';

/**
 * WhatsApp, sitting under the assistant launcher.
 *
 * Most people in South Africa would rather send a WhatsApp than fill in a
 * form, and someone deciding whether to ask for help should not have to
 * compose an email to do it.
 *
 * The message is pre-filled but plain — nothing that would embarrass someone
 * if a colleague glanced at their screen while they sent it.
 */

const WHATSAPP_NUMBER = '27638837170'; // 063 883 7170 in international form
const PREFILLED = 'Hi Be Whole Care, I would like to ask about an appointment.';

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.9 9.9 0 0 0 4.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96C22 6.46 17.54 2 12.04 2Zm5.8 15.76a8.28 8.28 0 0 1-5.8 2.4h-.01a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.25 8.25 0 0 1-1.27-4.42c0-4.57 3.72-8.29 8.3-8.29a8.29 8.29 0 0 1 5.78 14.17Z" />
    </svg>
  );
}

export function WhatsAppButton() {
  const reduced = useReducedMotion();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED)}`;

  /**
   * Held back until the home hero has been scrolled past.
   *
   * On a phone the hero's buttons run the full width, and a floating button
   * pinned bottom-right lands directly on top of them. The same rule already
   * applies to the assistant launcher.
   */
  const pathname = usePathname();
  const [pastHero, setPastHero] = React.useState(true);

  React.useEffect(() => {
    if (pathname !== '/') {
      setPastHero(true);
      return;
    }
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{
        opacity: pastHero ? 1 : 0,
        scale: pastHero ? 1 : 0.85,
        pointerEvents: pastHero ? 'auto' : 'none',
      }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={{ scale: 0.94 }}
      aria-hidden={!pastHero}
      tabIndex={pastHero ? 0 : -1}
      aria-label={`WhatsApp Be Whole Care on ${BUSINESS.phone}`}
      title={`WhatsApp ${BUSINESS.phone}`}
      /**
       * Three things float at the bottom right, and they must not collide:
       *
       *   dock       0    – ~70px   (centred pill, full width)
       *   WhatsApp   96   – 152px   (this)
       *   assistant  176  – 232px
       *
       * At bottom-8 this sat on top of the dock. WhatsApp goes below the
       * assistant, as asked, but still clear of the dock.
       */
      className="no-print fixed bottom-24 right-4 z-[74] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-float transition-colors hover:bg-[#1FBE5A] motion-safe:animate-beacon-core sm:right-5"
    >
      {/*
        The beam: a ring pushing outward behind the button, plus a soft glow on
        the button itself. `-z-10` keeps it behind the glyph, and
        `pointer-events-none` means the expanding ring never eats a tap aimed
        at something beside it.

        `motion-safe:` on both — this pulses forever, and a permanently moving
        element is exactly what someone with vestibular sensitivity turns
        reduced motion on to stop.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[#25D366] motion-safe:animate-beacon"
      />
      <WhatsAppGlyph className="relative h-7 w-7" />
    </motion.a>
  );
}
