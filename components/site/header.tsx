'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS } from '@/config/business';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

const NAV = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/resources', label: 'Resources' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);


  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const portalHref = user ? (user.role === 'CLIENT' ? '/portal' : '/admin') : '/sign-in';

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-calm',
          scrolled ? 'py-2.5' : 'py-4',
        )}
      >
        {/*
          The header is a floating pill, so it does not span the top edge —
          which left page content visibly sliding through the gap around it and
          getting clipped at y=0. This fades the canvas in behind that gap so
          content dissolves as it approaches the top instead.

          It is a plain gradient, not a blur: text passing under a blur here is
          exactly the effect that got reported as a bug. See the note in
          globals.css on where glass is allowed.
        */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-canvas via-canvas/70 to-transparent',
            'transition-opacity duration-500 ease-calm',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />

        <div className="shell">
          {/*
            The bar's surface is its own layer behind the content, and it is the
            only thing that animates. Nothing that contains text changes size,
            position or filter on scroll — transform-scaling or backdrop-blurring
            type is what makes a header look like a rendering glitch.
          */}
          <div className="relative flex items-center justify-between rounded-full px-4 py-2.5">
            <div
              aria-hidden
              className={cn(
                'absolute inset-0 -z-10 rounded-full border',
                'transition-[background-color,border-color,box-shadow] duration-500 ease-calm',
                // No backdrop-filter: at this opacity a blur is invisible, but
                // it still costs a compositing layer and smears whatever scrolls
                // beneath. Colour and shadow alone carry the state change.
                scrolled
                  ? 'border-line bg-cream-50/95 dark:bg-card/95 shadow-card'
                  : 'border-transparent bg-transparent shadow-none',
              )}
            />

            <Link
              href="/"
              className="rounded-full transition-opacity hover:opacity-80"
              aria-label={`${BUSINESS.name} home`}
            >
              <Logo />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative rounded-full px-4 py-2 text-sm transition-colors duration-200',
                      active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 -z-10 rounded-full bg-canvas-sunk dark:bg-cream-100/10"

                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href={portalHref}
                className="hidden rounded-full px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink sm:block"
              >
                {user ? (user.role === 'CLIENT' ? 'My portal' : 'Dashboard') : 'Sign in'}
              </Link>
              <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
                Book an appointment
              </ButtonLink>
              {/* pointerdown + click: instant, quirk-proof touch response.
                  Opening is idempotent so both firing is harmless. */}
              <button
                type="button"
                onPointerDown={() => setOpen(true)}
                onClick={() => setOpen(true)}
                style={{ touchAction: 'manipulation' }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink active:bg-cream-100 lg:hidden"
                aria-label="Open menu"
                aria-expanded={open}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[70] lg:hidden"
          >
            <div className="absolute inset-0 bg-cream-50 dark:bg-canvas" />
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full flex-col"
            >
              <div className="shell flex items-center justify-between py-5">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="shell flex-1 overflow-y-auto pb-8 pt-4" aria-label="Mobile">
                <ul className="space-y-1">
                  {NAV.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center justify-between border-b border-line py-4 font-display text-2xl text-ink"
                      >
                        {item.label}
                        <ArrowUpRight className="h-5 w-5 text-ink-faint" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-8 space-y-3">
                  <ButtonLink href="/book" size="lg" full>
                    Book an appointment
                  </ButtonLink>
                  <ButtonLink href={portalHref} variant="secondary" size="lg" full>
                    {user ? (user.role === 'CLIENT' ? 'My portal' : 'Dashboard') : 'Sign in'}
                  </ButtonLink>
                </div>

                <div className="mt-8 space-y-2 text-sm text-ink-soft">
                  <p className="eyebrow mb-3">Get in touch</p>
                  <a href={`tel:${BUSINESS.phone}`} className="block hover:text-ink">
                    {BUSINESS.phone}
                  </a>
                  <a href={`mailto:${BUSINESS.email}`} className="block hover:text-ink">
                    {BUSINESS.email}
                  </a>
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
