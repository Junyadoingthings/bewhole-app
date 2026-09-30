'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Inbox,
  Mail,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { MarkAllRead } from '@/components/admin/mark-all-read';
import { ButtonLink } from '@/components/ui/button';
import { Badge, StatTile } from '@/components/ui/primitives';
import { markNotificationsSeen } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export type ActivityCategory = 'bookings' | 'medical_aid' | 'payments' | 'messages' | 'other';

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  title: string;
  summary: string;
  details: { label: string; value: string }[];
  notes: string[];
  href: string | null;
  read: boolean;
  day: string;
  time: string;
  sortKey: string;
}

export interface EmailItem {
  id: string;
  subject: string;
  to: string;
  status: 'queued' | 'sent' | 'failed';
  error: string | null;
  day: string;
  time: string;
  sortKey: string;
}

const CATEGORY = {
  bookings: { label: 'Bookings', icon: CalendarCheck, tint: 'bg-forest-50 text-forest-700 dark:bg-forest-900/30 dark:text-forest-300' },
  medical_aid: { label: 'Medical aid', icon: ShieldCheck, tint: 'bg-state-infoSoft text-state-info' },
  payments: { label: 'Payments', icon: CreditCard, tint: 'bg-state-warningSoft text-state-warning' },
  messages: { label: 'Messages', icon: MessageSquare, tint: 'bg-cream-100 text-ink-muted dark:bg-card' },
  other: { label: 'Other', icon: Bell, tint: 'bg-cream-100 text-ink-muted dark:bg-card' },
} as const;

type ActivityFilter = 'all' | 'unread' | Exclude<ActivityCategory, 'other'>;
type EmailFilter = 'all' | 'sent' | 'queued' | 'failed';

/** Consecutive items that share a day label, in the order given. */
function groupByDay<T extends { day: string }>(items: T[]) {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }
  return groups;
}

export function NotificationsInbox({
  activity,
  emails,
  stats,
  emailLive,
}: {
  activity: ActivityItem[];
  emails: EmailItem[];
  stats: { unread: number; sentToday: number; scheduled: number; failed: number };
  emailLive: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<'activity' | 'emails'>('activity');
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>('all');
  const [emailFilter, setEmailFilter] = React.useState<EmailFilter>('all');
  const [openId, setOpenId] = React.useState<string | null>(null);
  // Marked read in this visit, before the server has caught up.
  const [seen, setSeen] = React.useState<Set<string>>(() => new Set());

  const isRead = (item: ActivityItem) => item.read || seen.has(item.id);
  const unreadIds = activity.filter((a) => !isRead(a)).map((a) => a.id);

  function toggle(item: ActivityItem) {
    setOpenId((current) => (current === item.id ? null : item.id));
    if (!isRead(item)) {
      setSeen((s) => new Set(s).add(item.id));
      void markNotificationsSeen([item.id]).then(() => router.refresh());
    }
  }

  const visibleActivity = activity.filter((a) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'unread') return !isRead(a);
    return a.category === activityFilter;
  });

  const scheduled = emails
    .filter((e) => e.status === 'queued')
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const history = emails
    .filter((e) => e.status !== 'queued')
    .filter((e) => emailFilter === 'all' || e.status === emailFilter)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const showScheduled = emailFilter === 'all' || emailFilter === 'queued';

  const count = (f: ActivityFilter) =>
    f === 'all'
      ? activity.length
      : f === 'unread'
        ? unreadIds.length
        : activity.filter((a) => a.category === f).length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Unread" value={unreadIds.length} icon={<Bell className="h-4 w-4" />} />
        <StatTile
          label="Emails sent today"
          value={stats.sentToday}
          tone="positive"
          icon={<Mail className="h-4 w-4" />}
        />
        <StatTile
          label="Scheduled emails"
          value={stats.scheduled}
          hint="Reminders waiting to go out"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatTile
          label="Failed emails"
          value={stats.failed}
          tone={stats.failed > 0 ? 'danger' : 'neutral'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Notifications" className="inline-flex rounded-full border border-line bg-white p-1">
          <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity
            {unreadIds.length > 0 && (
              <span className="ml-2 rounded-full bg-forest-700 px-1.5 py-0.5 text-2xs font-medium text-cream-100">
                {unreadIds.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === 'emails'} onClick={() => setTab('emails')}>
            Emails sent
          </TabButton>
        </div>
        {tab === 'activity' && unreadIds.length > 0 && <MarkAllRead ids={unreadIds} />}
      </div>

      {tab === 'activity' ? (
        <div role="tabpanel" className="mt-5">
          <Chips
            value={activityFilter}
            onChange={setActivityFilter}
            options={[
              { value: 'all', label: 'All', count: count('all') },
              { value: 'unread', label: 'Unread', count: count('unread') },
              { value: 'bookings', label: 'Bookings', count: count('bookings') },
              { value: 'medical_aid', label: 'Medical aid', count: count('medical_aid') },
              { value: 'payments', label: 'Payments', count: count('payments') },
              { value: 'messages', label: 'Messages', count: count('messages') },
            ]}
          />

          {visibleActivity.length === 0 ? (
            <Empty
              title={activityFilter === 'unread' ? 'You are all caught up' : 'Nothing here yet'}
              body="New bookings, medical aid requests, payments and messages appear here as they happen."
            />
          ) : (
            <div className="mt-5 space-y-6">
              {groupByDay(visibleActivity).map((group) => (
                <section key={group.day}>
                  <h2 className="px-1 text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                    {group.day}
                  </h2>
                  <ul className="mt-2 divide-y divide-line-soft overflow-hidden rounded-3xl border border-line bg-white">
                    {group.items.map((item) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        read={isRead(item)}
                        open={openId === item.id}
                        onToggle={() => toggle(item)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-5">
          {!emailLive && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-state-warning/25 bg-state-warningSoft p-4 text-sm text-ink-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-state-warning" />
              Email sending is not set up on the server, so the messages below were recorded but not
              delivered.
            </div>
          )}

          <Chips
            value={emailFilter}
            onChange={setEmailFilter}
            options={[
              { value: 'all', label: 'All', count: emails.length },
              { value: 'sent', label: 'Sent', count: emails.filter((e) => e.status === 'sent').length },
              { value: 'queued', label: 'Scheduled', count: scheduled.length },
              { value: 'failed', label: 'Failed', count: emails.filter((e) => e.status === 'failed').length },
            ]}
          />

          {showScheduled && scheduled.length > 0 && (
            <section className="mt-5">
              <h2 className="px-1 text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                Scheduled — waiting to go out
              </h2>
              <ul className="mt-2 divide-y divide-line-soft overflow-hidden rounded-3xl border border-line bg-white">
                {scheduled.map((email) => (
                  <EmailRow key={email.id} email={email} />
                ))}
              </ul>
            </section>
          )}

          {emailFilter !== 'queued' &&
            (history.length === 0 ? (
              <Empty
                title={emailFilter === 'failed' ? 'No failed emails' : 'No emails yet'}
                body="Every email the website sends to clients and to the practice is listed here."
              />
            ) : (
              <div className="mt-5 space-y-6">
                {groupByDay(history).map((group) => (
                  <section key={group.day}>
                    <h2 className="px-1 text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                      {group.day}
                    </h2>
                    <ul className="mt-2 divide-y divide-line-soft overflow-hidden rounded-3xl border border-line bg-white">
                      {group.items.map((email) => (
                        <EmailRow key={email.id} email={email} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ))}

          {emailFilter === 'queued' && scheduled.length === 0 && (
            <Empty title="Nothing scheduled" body="Reminders for confirmed sessions are queued here until they are sent." />
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  item,
  read,
  open,
  onToggle,
}: {
  item: ActivityItem;
  read: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = CATEGORY[item.category];
  const Icon = meta.icon;
  const hasMore = item.details.length > 0 || item.notes.length > 0 || Boolean(item.href);

  return (
    <li className={cn(!read && 'bg-forest-50/40 dark:bg-forest-900/15')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-cream-50 dark:hover:bg-canvas"
      >
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.tint)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className={cn('text-sm text-ink', read ? 'font-normal' : 'font-semibold')}>{item.title}</span>
            <span className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="text-xs tabular text-ink-faint">{item.time}</span>
              {!read && <span className="h-2 w-2 rounded-full bg-forest-600" aria-label="Unread" />}
            </span>
          </span>
          {item.summary && (
            <span className={cn('mt-1 block text-sm leading-relaxed text-ink-soft', !open && 'line-clamp-2')}>
              {item.summary}
            </span>
          )}
          <span className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
            <span>{meta.label}</span>
            {hasMore && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  {open ? 'Hide details' : 'Show details'}
                  <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      {open && hasMore && (
        <div className="px-5 pb-5 pl-[4.25rem]">
          {item.details.length > 0 && (
            <dl className="divide-y divide-line-soft rounded-2xl border border-line">
              {item.details.map((d, i) => (
                <div key={i} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-ink-faint">{d.label}</dt>
                  <dd className="break-words text-ink">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.notes.map((note, i) => (
            <p key={i} className="mt-3 text-sm leading-relaxed text-ink-soft">
              {note}
            </p>
          ))}
          {item.href && (
            <ButtonLink href={item.href} size="sm" className="mt-4">
              Open
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          )}
        </div>
      )}
    </li>
  );
}

function EmailRow({ email }: { email: EmailItem }) {
  const status = {
    sent: { icon: CheckCircle2, className: 'text-forest-600 dark:text-forest-300', badge: 'success', label: 'Sent' },
    queued: { icon: Clock, className: 'text-state-warning', badge: 'warning', label: 'Scheduled' },
    failed: { icon: XCircle, className: 'text-state-danger', badge: 'danger', label: 'Failed' },
  }[email.status];
  const Icon = status.icon;

  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', status.className)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-medium text-ink">{email.subject}</p>
          <Badge tone={status.badge as 'success' | 'warning' | 'danger'} size="sm">
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-ink-faint">
          To {email.to} ·{' '}
          {email.status === 'queued' ? `${email.day}, ${email.time}` : email.time}
        </p>
        {email.status === 'failed' && email.error && (
          <p className="mt-1.5 break-words text-xs text-state-danger">{email.error}</p>
        )}
      </div>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
        active ? 'bg-forest-800 text-cream-100' : 'text-ink-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count: number }[];
}) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200',
            value === o.value
              ? 'border-forest-700 bg-forest-700 text-cream-100'
              : 'border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink',
          )}
        >
          {o.label}
          <span className={cn('tabular text-xs', value === o.value ? 'text-cream-100/70' : 'text-ink-faint')}>
            {o.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center">
      <Inbox className="h-6 w-6 text-ink-faint" />
      <p className="mt-3 font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
