import { PortalShell } from '@/components/portal/shell';
import { requireUser } from '@/lib/auth';
import { listNotifications } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import type { NotificationRecord } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Every portal route is gated here; each page also scopes its own queries by
  // the authenticated user id, never by anything the client sends.
  const user = await requireUser('/sign-in?next=/portal');
  // The unread badge must never hang the client's whole portal — if the count
  // can't load in time, show none and let the page render.
  const notifications = await withTimeout<NotificationRecord[]>(
    listNotifications({ audience: 'client', userId: user.id }),
    [],
    7000,
  );
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <PortalShell user={user} unreadCount={unread}>
      {children}
    </PortalShell>
  );
}
