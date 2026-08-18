'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Route transition for the public site.
 *
 * A template remounts on every navigation, so this gives each page a short
 * settle instead of a hard swap. Deliberately brief — 220ms — because anything
 * longer starts to feel like waiting rather than arriving.
 */
export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
