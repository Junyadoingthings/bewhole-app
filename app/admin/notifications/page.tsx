import type { Metadata } from 'next';

import {
  NotificationsInbox,
  type ActivityCategory,
  type ActivityItem,
  type EmailItem,
} from '@/components/admin/notifications-inbox';
import { Reveal } from '@/components/motion';
import { requireStaff } from '@/lib/auth';
import { parts, relativeDay, today } from '@/lib/date';
import { listNotificationLogs, listNotifications } from '@/lib/db';
import { activeChannels } from '@/services/notifications';
import type { NotificationLog, NotificationRecord } from '@/types';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };
export const dynamic = 'force-dynamic';

function categoryOf(type: string): ActivityCategory {
  if (type.includes('medical_aid')) return 'medical_aid';
  if (type.includes('payment')) return 'payments';
  if (type.startsWith('contact.') || type.startsWith('nakedvows.')) return 'messages';
  if (/^(booking|appointment|reminder|followup)\./.test(type)) return 'bookings';
  return 'other';
}

/**
 * A staff notification's body is a summary paragraph followed by "Label:
 * value" lines. The inbox shows the summary and lays the rest out as details.
 */
function splitBody(body: string) {
  const [first = '', ...more] = body.split(/\n\s*\n/);
  const summary = first.replace(/\s*\n\s*/g, ' ').trim();
  const details: { label: string; value: string }[] = [];
  const notes: string[] = [];
  for (const raw of more.join('\n').split('\n')) {
    const line = raw.trim().replace(/^##\s+/, '');
    if (!line || /^\{\{.*\}\}$/.test(line)) continue;
    const match = /^([^:]{1,32}):\s+(.+)$/.exec(line);
    if (match) details.push({ label: match[1], value: match[2] });
    else notes.push(line);
  }
  return { summary, details, notes };
}

// Labels are worked out here, on the server, so the page and the browser can
// never disagree about what "Today" is.
function toActivity(n: NotificationRecord): ActivityItem {
  const when = parts(n.createdAt);
  return {
    id: n.id,
    category: categoryOf(n.type),
    title: n.title,
    ...splitBody(n.body),
    href: n.href ?? null,
    read: n.read,
    day: relativeDay(when.date),
    time: when.time,
    sortKey: n.createdAt,
  };
}

function toEmail(log: NotificationLog): EmailItem {
  const at =
    log.status === 'queued' ? (log.scheduledFor ?? log.createdAt) : (log.sentAt ?? log.createdAt);
  const when = parts(at);
  return {
    id: log.id,
    subject: log.subject,
    to: log.to,
    status: log.status,
    error: log.error ?? null,
    day: relativeDay(when.date),
    time: when.time,
    sortKey: at,
  };
}

export default async function AdminNotificationsPage() {
  await requireStaff();
  const [notifications, logs] = await Promise.all([
    listNotifications({ audience: 'staff' }),
    listNotificationLogs(250),
  ]);

  const activity = notifications.map(toActivity);
  // Emails only: WhatsApp and SMS are not connected, and listing messages that
  // were never sent would suggest otherwise.
  const emailLogs = logs.filter((l) => l.channel === 'email');
  const emails = emailLogs.map(toEmail);
  const emailLive = activeChannels().some((c) => c.channel === 'email' && c.live);
  const todayDate = today();

  const stats = {
    unread: activity.filter((a) => !a.read).length,
    sentToday: emailLogs.filter(
      (l) => l.status === 'sent' && l.sentAt && parts(l.sentAt).date === todayDate,
    ).length,
    scheduled: emails.filter((e) => e.status === 'queued').length,
    failed: emails.filter((e) => e.status === 'failed').length,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Notifications</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Everything happening in the practice — new bookings, medical aid, payments and messages
          — and every email the website has sent or is due to send.
        </p>
      </Reveal>

      <div className="mt-8">
        <NotificationsInbox activity={activity} emails={emails} stats={stats} emailLive={emailLive} />
      </div>
    </div>
  );
}
