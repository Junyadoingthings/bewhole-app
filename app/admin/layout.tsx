import { AdminShell, type CommandItem } from '@/components/admin/shell';
import { requireStaff } from '@/lib/auth';

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
  { id: 'nav-settings', label: 'Settings', href: '/admin/settings', group: 'Go to' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Staff gate for every /admin route. Individual pages re-check for actions
  // that need ADMIN, so a STAFF session can read but not reconfigure.
  const user = await requireStaff();

  /**
   * This layout is intentionally CHEAP: no database queries at all.
   *
   * It used to load clients, appointments and services on every admin page to
   * seed the ⌘K palette, and later the unread count for the Notifications tab.
   * With a small connection pool those queries competed with the page's own
   * and could hang it. The palette is navigation-only, and the Notifications
   * tab has been removed at the practice's request, so every page now gets
   * the connection pool to itself.
   */
  return (
    <AdminShell user={user} commands={NAV_COMMANDS}>
      {children}
    </AdminShell>
  );
}
