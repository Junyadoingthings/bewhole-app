'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/** Animated tab strip used on the client profile. */
export function ClientTabs({
  tabs,
}: {
  tabs: { id: string; label: string; count?: number; content: React.ReactNode }[];
}) {
  const [active, setActive] = React.useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Client details"
        className="scrollbar-none flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={cn(
                'relative shrink-0 px-4 py-3 text-sm transition-colors duration-200',
                isActive ? 'text-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ml-2 rounded-full bg-cream-100 dark:bg-card px-1.5 py-0.5 text-2xs tabular text-ink-soft">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <motion.span
                  layoutId="client-tab"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-forest-700"
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current?.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {current?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
