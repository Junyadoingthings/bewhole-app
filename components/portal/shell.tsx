'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  Home,
  LogOut,
  Repeat,
  Settings,
  User,
} from 'lucide-react';

import { Logo, LeafMark } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { logout } from '@/app/actions/auth';
import { cn, initials } from '@/lib/utils';
import type { SessionUser } from '@/types';

const NAV = [
  { href: '/portal', label: 'Overview', icon: Home, exact: true },
  { href: '/portal/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/portal/follow-ups', label: 'Follow-ups', icon: Repeat },
  { href: '/portal/payments', label: 'Payments', icon: CreditCard },
  { href: '/portal/resources', label: 'Resources', icon: BookOpen },
  { href: '/portal/profile', label: 'Profile', icon: User },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
];

/** Mobile keeps four destinations; the rest live under Profile. */
const MOBILE_NAV = [
  { href: '/portal', label: 'Home', icon: Home, exact: true },
  { href: '/portal/appointments', label: 'Sessions', icon: CalendarDays },
  { href: '/portal/resources', label: 'Resources', icon: BookOpen },
  { href: '/portal/profile', label: 'Profile', icon: User },
];

export function PortalShell({
  user,
  unreadCount,
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-cream-50 dark:bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="px-6 py-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Portal">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors duration-200',
                  active ? 'text-forest-900 dark:text-forest-200' : 'text-ink-soft hover:bg-cream-50 dark:hover:bg-canvas hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="portal-active"
                    className="absolute inset-0 -z-10 rounded-2xl bg-cream-200/70 dark:bg-cream-100/10"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <ButtonLink href="/book" full size="sm" className="mb-3">
            Book a session
          </ButtonLink>
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-medium text-cream-100">
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full p-2 text-ink-faint transition-colors hover:bg-cream-100 dark:hover:bg-card hover:text-ink"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-cream-50/95 dark:bg-card/95 lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <LeafMark className="h-7 w-7 text-forest-700 dark:text-forest-300" />
            <span className="font-display text-base font-semibold text-ink">Be Whole Care</span>
          </Link>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="rounded-full bg-cream-200 dark:bg-canvas-sunk px-2 py-1 text-2xs font-medium text-forest-800 dark:text-forest-200">
                {unreadCount} new
              </span>
            )}
            {/* Booking lives in the header rather than a floating button, which
                would sit on top of links at this width. */}
            <ButtonLink href="/book" size="sm">
              <CalendarPlus className="h-4 w-4" />
              Book
            </ButtonLink>
            <Link
              href="/portal/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-800 text-xs font-medium text-cream-100"
              aria-label="Your profile"
            >
              {initials(user.firstName, user.lastName)}
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        {/* Bottom padding clears the mobile bottom navigation. */}
        <main id="main" className="px-5 pb-32 pt-6 sm:px-8 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav + floating book action */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 lg:hidden"
        aria-label="Portal"
      >
        <div className="grid grid-cols-4 pb-safe">
          {MOBILE_NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-3 text-2xs transition-colors duration-200',
                  active ? 'text-forest-800 dark:text-forest-200' : 'text-ink-faint',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {active && (
                    <motion.span
                      layoutId="portal-mobile-active"
                      className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-forest-700"
                    />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
