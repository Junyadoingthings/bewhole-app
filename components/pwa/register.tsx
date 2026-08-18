'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';

import { LeafMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bwc_install_dismissed';

/**
 * Registers the service worker and, on browsers that support it, offers a
 * quiet install prompt. It appears once, is dismissible for good, and never
 * interrupts the booking flow.
 */
export function PwaRegistrar() {
  const [deferred, setDeferred] = React.useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  /**
   * The service worker is switched OFF, and any existing one is removed.
   *
   * A client reported the site loading forever on their laptop and never
   * finishing. A stale service worker is the classic cause: it had cached the
   * shell from an earlier deployment, and after several rebuilds it was
   * serving assets that no longer matched the page.
   *
   * What it bought us was an offline page. What it cost was a client who
   * could not open the site at all, with no way to tell them a fix beyond
   * "clear your browser data". That is a bad trade for a practice whose
   * visitors are often stressed and not technical.
   *
   * This block does not merely stop registering — it actively unregisters
   * workers already installed on people's devices and deletes their caches.
   * Removing the registration alone would leave every existing visitor stuck,
   * because their installed worker keeps running until something removes it.
   *
   * If offline support is wanted later, reintroduce it with a versioned cache
   * name and a network-first strategy for assets as well as navigations.
   */
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) registration.unregister();
      })
      .catch(() => undefined);

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => undefined);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
      // Let the page settle before asking for anything.
      window.setTimeout(() => setVisible(true), 6000);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private browsing — the prompt simply reappears next session.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="no-print fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-sm rounded-3xl border border-line bg-white p-5 shadow-float sm:left-auto sm:right-5"
          role="dialog"
          aria-label="Install Be Whole Care"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900">
              <LeafMark className="h-6 w-6 text-forest-300" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Add Be Whole Care to your phone</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Your sessions, links and reminders in one tap.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="-m-1 rounded-full p-1 text-ink-faint transition-colors hover:text-ink"
              aria-label="Not now"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" full onClick={install}>
              <Download className="h-4 w-4" />
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
