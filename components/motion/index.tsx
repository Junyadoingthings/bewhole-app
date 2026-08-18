'use client';

import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * Motion primitives.
 *
 * One easing curve and three durations for the whole product, so nothing ever
 * feels like it came from a different app.
 *
 * Scroll reveals are deliberately NOT JS animations. An IntersectionObserver
 * flips a data attribute and CSS transitions do the work on the compositor.
 * That means: content is visible by default, the hidden state only exists once
 * JS has confirmed it is running, and a page whose animation frames never
 * arrive still renders completely. It is also markedly cheaper than running a
 * spring per section on scroll.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;
export const DURATION = { fast: 0.24, base: 0.45, slow: 0.7 } as const;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Shared observer wiring for Reveal and Stagger. */
function useRevealOnScroll(
  attribute: 'reveal' | 'stagger',
  { once = true, margin = '-64px 0px' }: { once?: boolean; margin?: string } = {},
) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;

    element.dataset[attribute] = 'hidden';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset[attribute] = 'shown';
          if (once) observer.disconnect();
        } else if (!once) {
          element.dataset[attribute] = 'hidden';
        }
      },
      { rootMargin: margin },
    );

    observer.observe(element);

    // Safety net: if the observer never fires for any reason, show the content.
    const failsafe = window.setTimeout(() => {
      if (element.dataset[attribute] !== 'shown') element.dataset[attribute] = 'shown';
    }, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [attribute, once, margin]);

  return ref;
}

/* --------------------------------------------------------------- reveal */

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRevealOnScroll('reveal', { once });

  return (
    <div
      ref={ref}
      className={className}
      style={
        {
          '--reveal-delay': `${delay}s`,
          '--reveal-y': `${y}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- stagger */

export function Stagger({
  children,
  className,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Kept for call-site compatibility; spacing is set in CSS. */
  gap?: number;
  delay?: number;
  once?: boolean;
}) {
  const ref = useRevealOnScroll('stagger', { once, margin: '-48px 0px' });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** A stagger child. Timing comes from its position, set in CSS. */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/* ---------------------------------------------------------- transitions */

/** Wraps route content so a navigation reads as a settle, not a jump. */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------- floating */

/**
 * Slow vertical drift for the hero's floating chips. Starts at its resting
 * position, so a frozen animation simply means a chip that does not bob.
 */
export function Float({
  children,
  className,
  amplitude = 8,
  duration = 6,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amplitude, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------- card hover */

/** Lift + settle used on interactive cards. Resting state is the real state. */
export function HoverCard({
  children,
  className,
  lift = 4,
}: {
  children: React.ReactNode;
  className?: string;
  lift?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      whileHover={{ y: -lift }}
      whileTap={{ y: -1 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------- success animation */

/** Draws a tick inside a ring. Used on the booking confirmation screen. */
export function SuccessMark({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn('relative flex h-20 w-20 items-center justify-center', className)}>
      <motion.span
        className="absolute inset-0 rounded-full bg-forest-100 dark:bg-forest-900/45"
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.base, ease: EASE }}
      />
      <svg viewBox="0 0 48 48" className="relative h-10 w-10" aria-hidden>
        <motion.path
          d="M12 25.5 L20.5 34 L36 15"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-forest-700 dark:text-forest-300"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
        />
      </svg>
    </div>
  );
}

export { motion, useReducedMotion };
