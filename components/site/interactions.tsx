'use client';

import * as React from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------ scroll rail */

/** A hairline reading-progress rail. Present, but easy to never notice. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.2 });
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[65] h-[2px] origin-left bg-gradient-to-r from-forest-600 via-forest-500 to-forest-300"
    />
  );
}

/* --------------------------------------------------------- magnetic button */

/**
 * The primary call to action leans very slightly toward the cursor.
 * Pointer-fine only, and disabled under reduced motion — on a phone it is an
 * ordinary button with no wasted listeners.
 */
export function Magnetic({
  children,
  strength = 6,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(window.matchMedia('(pointer: fine)').matches);
  }, []);

  if (reduced || !enabled) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={cn('inline-block', className)}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 0.4 }}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = event.clientX - (rect.left + rect.width / 2);
        const relY = event.clientY - (rect.top + rect.height / 2);
        setOffset({
          x: (relX / (rect.width / 2)) * strength,
          y: (relY / (rect.height / 2)) * strength,
        });
      }}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------ line reveal */

/**
 * Reveals a headline line by line from behind a mask.
 *
 * Pure CSS. The resting state is the visible one and the entrance is an
 * animation with `backwards` fill, so the most important sentence on the site
 * can never be left hidden by an animation that did not run. It also keeps the
 * H1 off the JavaScript critical path entirely.
 */
export function LineReveal({
  lines,
  className,
  lineClassName,
  delay = 0,
  as: Tag = 'h1',
}: {
  lines: React.ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p';
}) {
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <span
            className={cn('block motion-safe:animate-line-in', lineClassName)}
            style={{ animationDelay: `${delay + i * 0.09}s` }}
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
