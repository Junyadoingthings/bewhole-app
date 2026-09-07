'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BookOpen, CalendarPlus, HeartHandshake, House, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

/**
 * The dock — a floating tab bar for moving between pages.
 *
 * ── On the glass ─────────────────────────────────────────────────────────
 * This is the one place in the app that uses a backdrop blur on a persistent
 * bar, and that is a deliberate exception to a rule set after a real bug: a
 * blurred full-width sticky header made body text scrolling underneath look
 * broken, and it was reported as one.
 *
 * A floating pill is a different case. It is inset from every edge, so content
 * passes beside it as much as under it; the blurred region is small and
 * bounded; and the rounded edge plus a lit top edge reads as a physical object
 * rather than a smear. The header remains blur-free.
 *
 * ── Where it appears ─────────────────────────────────────────────────────
 * Marketing pages only. The portal and admin have their own navigation, the
 * booking wizard has its own sticky footer, and stacking two bars at the
 * bottom of a phone is worse than having none.
 */

const TABS = [
  { href: '/', label: 'Home', icon: House, exact: true },
  { href: '/services', label: 'Services', icon: HeartHandshake },
  { href: '/book', label: 'Book', icon: CalendarPlus, primary: true },
  // "Resources", not "Reading" — the page carries the podcast as well as
  // written material now, so the narrower word was wrong.
  { href: '/resources', label: 'Resources', icon: BookOpen },
] as const;

export function SiteDock({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  const suppressed =
    pathname.startsWith('/book') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/pay') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');

  if (suppressed) return null;

  const accountHref = user ? (user.role === 'CLIENT' ? '/portal' : '/admin') : '/sign-in';
  const accountActive = pathname.startsWith('/portal') || pathname.startsWith('/admin');

  return (
    <nav
      aria-label="Quick navigation"
      className="no-print fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="glass glass-sheen flex items-center gap-0.5 rounded-full p-1.5 shadow-dock">
        {TABS.map((tab) => {
          const active = 'exact' in tab && tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <DockLink
              key={tab.href}
              href={tab.href}
              label={tab.label}
              icon={tab.icon}
              active={active}
              primary={'primary' in tab && tab.primary}
            />
          );
        })}

        <DockLink
          href={accountHref}
          label={user ? 'You' : 'Sign in'}
          icon={UserRound}
          active={accountActive}
          /*
            Glows only while signed out. Once someone has an account and is
            just switching between pages, "Sign in" no longer needs to
            compete for attention the way it does for a first-time visitor
            deciding whether to make one.
          */
          glow={!user}
        />
      </div>
    </nav>
  );
}

function DockLink({
  href,
  label,
  icon: Icon,
  active,
  primary = false,
  glow = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  primary?: boolean;
  /**
   * A white beam calling attention to this tab — built for "Sign in", which
   * otherwise reads as just another icon in a row of five and is easy to
   * scroll straight past. Two parts, matching the WhatsApp button elsewhere
   * in the app: an expanding ring behind the tab, and the tab's own glow
   * pulsing in sympathy. Both `motion-safe:` only — this animates forever,
   * and permanent motion is exactly what reduced-motion settings exist to
   * suppress. Without it the tab is simply a normal, static tab.
   */
  glow?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-11 w-[3.9rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full',
        'transition-[transform,color] duration-200 ease-calm active:scale-90 sm:w-[4.4rem]',
        primary
          ? 'text-cream-100'
          : active
            ? 'text-forest-800 dark:text-forest-200'
            : 'text-ink-soft hover:text-ink',
        glow && !active && 'motion-safe:animate-beacon-core-white',
      )}
    >
      {/* The Book action is filled at all times — it is the thing the whole
          site exists to get someone to do, so it does not wait to be selected. */}
      {primary && (
        <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-forest-800" />
      )}

      {/* One shared pill slides between tabs instead of three fading in place. */}
      {active && !primary && (
        <motion.span
          layoutId="dock-active"
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-forest-50 dark:bg-forest-900/60"
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      {/* The expanding ring. `-z-10` keeps it behind the icon/label;
          pointer-events-none so it never steals the tap it exists to invite. */}
      {glow && !active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-white/80 motion-safe:animate-beacon"
        />
      )}

      <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active || primary ? 2.2 : 1.8} />
      <span className="text-[0.6rem] font-medium leading-none tracking-tight">{label}</span>
    </Link>
  );
}
