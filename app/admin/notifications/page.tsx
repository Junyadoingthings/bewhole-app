import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, Mail, MessageCircle, Smartphone } from 'lucide-react';

import { MarkAllRead } from '@/components/admin/mark-all-read';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { formatFullDate, parts, timeAgo } from '@/lib/date';
import { listNotificationLogs, listNotifications } from '@/lib/db';
import { activeChannels } from '@/services/notifications';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };
export const dynamic = 'force-dynamic';

const CHANNEL_ICON = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  push: Bell,
  in_app: Bell,
};

export default async function AdminNotificationsPage() {
  await requireStaff();
  const [notifications, logs] = await Promise.all([
    listNotifications({ audience: 'staff' }),
    listNotificationLogs(60),
  ]);

  const unread = notifications.filter((n) => !n.read);
  const channels = activeChannels();
  const queued = logs.filter((l) => l.status === 'queued');

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Notifications</h1>
            <p className="mt-2 text-ink-soft">
              {unread.length > 0 ? `${unread.length} unread` : 'All caught up'} ·{' '}
              {queued.length} scheduled for later
            </p>
          </div>
          {unread.length > 0 && <MarkAllRead ids={unread.map((n) => n.id)} />}
        </div>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Practice activity
          </h2>
          <div className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <EmptyState compact icon={<Bell className="h-5 w-5" />} title="Nothing yet" />
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href ?? '/admin'}
                  className={cn(
                    'block rounded-2xl border p-5 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-subtle',
                    n.read ? 'border-line bg-white/60' : 'border-forest-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-forest-600" />}
                        {n.title}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">{timeAgo(n.createdAt)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Delivery channels
          </h2>
          <div className="mt-4 space-y-2">
            {channels.map(({ channel, live }) => {
              const Icon = CHANNEL_ICON[channel];
              return (
                <div
                  key={channel}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4"
                >
                  <span className="flex items-center gap-3 text-sm capitalize text-ink">
                    <Icon className="h-4 w-4 text-forest-600 dark:text-forest-300" />
                    {channel.replace('_', '-')}
                  </span>
                  <Badge tone={live ? 'success' : 'neutral'} size="sm">
                    {live ? 'Live' : 'Logged only'}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Channels without credentials are recorded below rather than sent, so automation stays
            visible in development.
          </p>

          <h2 className="mt-8 text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Message log
          </h2>
          <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">
                Nothing sent yet.
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">{log.subject}</p>
                    <Badge
                      tone={
                        log.status === 'sent'
                          ? 'success'
                          : log.status === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {log.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-faint">
                    {log.channel} → {log.to}
                    {log.scheduledFor &&
                      log.status === 'queued' &&
                      ` · ${formatFullDate(parts(log.scheduledFor).date)}`}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
