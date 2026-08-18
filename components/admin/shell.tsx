'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat,
  Search,
  Settings,
  Sprout,
  Users,
  UserCog,
  BookOpen,
  X,
} from 'lucide-react';

import { LeafMark } from '@/components/brand/logo';
import { logout } from '@/app/actions/auth';
import { cn, initials } from '@/lib/utils';
import type { SessionUser } from '@/types';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/follow-ups', label: 'Follow-ups', icon: Repeat },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/services', label: 'Services', icon: Sprout },
  { href: '/admin/resources', label: 'Resources', icon: BookOpen },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/staff', label: 'Staff', icon: UserCog, minRole: 'ADMIN' as const },
  { href: '/admin/settings', label: 'Settings', icon: Settings, minRole: 'ADMIN' as const },
];

export interface CommandItem {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: string;
}

export function AdminShell({
  user,
  unread,
  commands,
  children,
}: {
  user: SessionUser;
  unread: number;
  commands: CommandItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const items = NAV.filter((item) => !item.minRole || isAdmin);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // ⌘K / Ctrl-K opens the command palette from anywhere in the dashboard.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <LeafMark className="h-8 w-8 text-forest-300" />
        <div>
          <p className="font-display text-sm font-semibold text-cream-100">Be Whole Care</p>
          <p className="text-2xs uppercase tracking-[0.14em] text-forest-300">Practice console</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="mx-3 flex items-center gap-2.5 rounded-2xl border border-cream-100/10 bg-cream-100/5 px-3.5 py-2.5 text-sm text-cream-100/55 transition-colors hover:border-cream-100/25 hover:text-cream-100"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-cream-100/15 px-1.5 py-0.5 text-2xs">⌘K</kbd>
      </button>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors duration-200',
                active ? 'text-cream-100' : 'text-cream-100/55 hover:text-cream-100',
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-active"
                  className="absolute inset-0 -z-10 rounded-2xl bg-cream-100/10"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === '/admin/notifications' && unread > 0 && (
                <span className="rounded-full bg-forest-400 px-1.5 py-0.5 text-2xs font-medium text-forest-950 dark:text-forest-100">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-cream-100/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-100/15 text-xs font-medium text-cream-100">
            {initials(user.firstName, user.lastName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-cream-100">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-2xs uppercase tracking-[0.1em] text-forest-300">
              {user.role.replace('_', ' ').toLowerCase()}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full p-2 text-cream-100/45 transition-colors hover:bg-cream-100/10 hover:text-cream-100"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream-50 dark:bg-canvas">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-forest-900 lg:block">{sidebar}</aside>

      {/*
        Mobile navigation sheet.

        Refactored so `AnimatePresence`'s direct children are motion components
        with keys — the previous plain `<div>` wrapper caused the exit lifecycle
        to fire inconsistently, and on iOS could leave the sheet in a state
        where a subsequent tap on the hamburger appeared to do nothing. Each
        motion element also carries `key`, which is what AnimatePresence
        actually tracks.
      */}
      {/*
        The exit animations here used to be the reason the top-bar buttons
        felt broken after navigating between pages. The backdrop and sheet
        remained in the DOM for up to 320ms after `mobileOpen` flipped to
        false, and their z-index sat ABOVE the sticky header — so every tap
        during that window landed on an invisible, closing sheet and did
        nothing. `pointer-events-none` on both elements while exiting frees
        the header instantly. The animation still plays for the eye; it just
        stops eating input.
      */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              key="mobile-nav-backdrop"
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0, pointerEvents: 'auto' }}
              animate={{ opacity: 1, pointerEvents: 'auto' }}
              exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0 } }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              style={{ touchAction: 'manipulation' }}
              className="fixed inset-0 z-[60] cursor-default bg-forest-950/45 lg:hidden"
            />
            <motion.aside
              key="mobile-nav-sheet"
              initial={{ x: '-100%', pointerEvents: 'auto' }}
              animate={{ x: 0, pointerEvents: 'auto' }}
              exit={{ x: '-100%', pointerEvents: 'none' }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-[61] h-full w-72 max-w-[85vw] bg-forest-900 lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/*
        Mobile top bar.

        Raised to z-50 (was z-40) so nothing rendered by a page can accidentally
        sit above it. The hamburger button gets `h-11 w-11` (iOS' 44pt minimum
        tap target) and `touch-action: manipulation` so taps register instantly
        instead of waiting for the browser's double-tap-to-zoom timeout.
      */}
      <header className="sticky top-0 z-50 border-b border-line bg-cream-50/95 dark:bg-card/95 lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          {/*
            Three things about these buttons make them reliable across every
            device and every navigation state:

            1. `onPointerDown` AND `onClick` — pointerdown fires the instant a
               finger touches, before the synthetic click, and is immune to the
               click-suppression quirks in-app WebViews (WhatsApp's especially)
               exhibit around sticky/animated headers. Opening is idempotent,
               so both firing is harmless. `onClick` stays for keyboard.
            2. `flushSync` — Next.js navigations use React's transition API,
               which deprioritises regular state updates. Without this, a tap
               moments after clicking a sidebar link could be deferred behind
               the still-pending navigation and appear to do nothing. Wrapping
               in flushSync forces the state to commit immediately.
            3. `touch-action: manipulation` — skips the browser's 300ms wait
               for a double-tap-to-zoom, so taps register instantly.
          */}
          <button
            type="button"
            onPointerDown={() => flushSync(() => setMobileOpen(true))}
            onClick={() => flushSync(() => setMobileOpen(true))}
            style={{ touchAction: 'manipulation' }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink active:bg-cream-100"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-sheet"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-sm font-semibold text-ink">Practice console</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => flushSync(() => setPaletteOpen(true))}
              onClick={() => flushSync(() => setPaletteOpen(true))}
              style={{ touchAction: 'manipulation' }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink active:bg-cream-100"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        <main id="main" className="px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}

/* ------------------------------------------------------------ command palette */

function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? commands.filter(
          (c) => c.label.toLowerCase().includes(q) || (c.sub ?? '').toLowerCase().includes(q),
        )
      : commands;
    return pool.slice(0, 12);
  }, [commands, query]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === 'Enter' && results[index]) {
        event.preventDefault();
        router.push(results[index].href);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, index, router, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-forest-950/35 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-white shadow-float"
            role="dialog"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="h-4 w-4 shrink-0 text-ink-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                placeholder="Search clients, appointments, sections…"
                aria-label="Search"
                className="h-14 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-ink-faint hover:bg-cream-100 dark:hover:bg-card hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-soft">
                  Nothing matches “{query}”.
                </p>
              ) : (
                results.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition-colors',
                      i === index ? 'bg-cream-100 dark:bg-card' : 'hover:bg-cream-50 dark:hover:bg-canvas',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{item.label}</span>
                      {item.sub && (
                        <span className="mt-0.5 block truncate text-xs text-ink-faint">
                          {item.sub}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-2xs uppercase tracking-[0.12em] text-ink-faint">
                      {item.group}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
