import { AdminShell, type CommandItem } from '@/components/admin/shell';
import { requireStaff } from '@/lib/auth';
import { listNotifications } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import type { NotificationRecord } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Navigation commands for ⌘K. Static — no database, no cost.
 */
const NAV_COMMANDS: CommandItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', href: '/admin', group: 'Go to' },
  { id: 'nav-appointments', label: 'Appointments', href: '/admin/appointments', group: 'Go to' },
  { id: 'nav-calendar', label: 'Calendar', href: '/admin/calendar', group: 'Go to' },
  { id: 'nav-clients', label: 'Clients', href: '/admin/clients', group: 'Go to' },
  { id: 'nav-followups', label: 'Follow-ups', href: '/admin/follow-ups', group: 'Go to' },
  { id: 'nav-payments', label: 'Payments', href: '/admin/payments', group: 'Go to' },
  { id: 'nav-services', label: 'Services & pricing', href: '/admin/services', group: 'Go to' },
  { id: 'nav-resources', label: 'Resources', href: '/admin/resources', group: 'Go to' },
  { id: 'nav-notifications', label: 'Notifications', href: '/admin/notifications', group: 'Go to' },
  { id: 'nav-settings', label: 'Settings', href: '/admin/settings', group: 'Go to' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Staff gate for every /admin route. Individual pages re-check for actions
  // that need ADMIN, so a STAFF session can read but not reconfigure.
  const user = await requireStaff();

  /**
   * This layout is intentionally CHEAP now.
   *
   * It used to load clients, all appointments and all services on EVERY admin
   * page — four concurrent queries — purely to seed the ⌘K palette with
   * searchable client and appointment entries. That was the reliability
   * problem: with a small connection pool, those four queries competed with
   * the page's own queries (the dashboard and calendar each fire another
   * ~6 through `hydrateAppointments`), the pool starved, and the page hung
   * until it timed out and showed the error card.
   *
   * The layout now runs ONE lightweight query — the unread count for the bell —
   * and the palette is navigation-only. Every page therefore gets the
   * connection pool to itself. Searching clients by name from ⌘K is a nice-to
   * have that was never worth making every page unreliable; it can come back
   * later as a dedicated, on-demand search endpoint.
   */
  // Short cap on purpose. The shell — sidebar, the mobile menu button, search
  // — cannot become interactive until this async layout resolves, so a slow
  // notifications query directly delays every tap working. The unread badge is
  // the least important thing on the page; 2.5s is the most we will make the
  // whole console wait for it. If it times out the badge shows nothing and the
  // page is fully usable.
  const notifications = await withTimeout<NotificationRecord[]>(
    listNotifications({ audience: 'staff' }),
    [],
    2500,
  );

  return (
    <AdminShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      commands={NAV_COMMANDS}
    >
      {children}
    </AdminShell>
  );
}
