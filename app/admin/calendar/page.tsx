import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Lock, MapPin, Video } from 'lucide-react';

import { BlockTimeControl } from '@/components/admin/block-time';
import { CalendarImport, type CalendarImportStatus } from '@/components/admin/calendar-import';
import { CalendarSubscribe } from '@/components/admin/calendar-subscribe';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import {
  addISODays,
  dayName,
  displayTime,
  formatFullDate,
  formatShortDate,
  monthGrid,
  monthLabel,
  parts,
  startOfWeek,
  timeToMinutes,
  today,
} from '@/lib/date';
import { getCounter, getSettings, hydrateAppointments, listAppointments, listAvailabilityBlocks } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { calendarFeedUrls } from '@/lib/links';
import { cn } from '@/lib/utils';
import { periodsToBlocks, readExternalCalendar } from '@/services/external-calendar.service';
import type { AppointmentStatus, AppointmentView, AvailabilityBlock } from '@/types';

export const metadata: Metadata = { title: 'Calendar', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Status is carried by a bar and a fill. The bar is an inset element rather
 * than a left border so it stays a straight line inside the rounded corner.
 */
const STATUS_FILL: Record<AppointmentStatus, string> = {
  confirmed: 'bg-forest-50/70 dark:bg-forest-900/35',
  pending_payment: 'bg-state-warningSoft/60',
  pending_medical_aid: 'bg-state-infoSoft/60',
  completed: 'bg-cream-100/70 dark:bg-card/70',
  cancelled: 'bg-state-dangerSoft/50',
  no_show: 'bg-state-dangerSoft/50',
};

const STATUS_BAR: Record<AppointmentStatus, string> = {
  confirmed: 'bg-forest-600',
  pending_payment: 'bg-state-warning',
  pending_medical_aid: 'bg-state-info',
  completed: 'bg-ink-faint',
  cancelled: 'bg-state-danger',
  no_show: 'bg-state-danger',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Awaiting payment',
  pending_medical_aid: 'Medical aid — verifying',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

const DAY_START = 7 * 60;

/** Cancelled and missed sessions stay in Appointments but are hidden here unless asked for. */
const HIDDEN_BY_DEFAULT = new Set<AppointmentStatus>(['cancelled', 'no_show']);

type DayItem =
  | { kind: 'block'; key: string; sort: number; block: AvailabilityBlock }
  | { kind: 'appointment'; key: string; sort: number; appointment: AppointmentView };

/**
 * One list per day, in time order: whole-day blocks first, then timed blocks
 * and sessions together from morning to evening.
 */
function dayItems(date: string, appointments: AppointmentView[], blocks: AvailabilityBlock[]): DayItem[] {
  const items: DayItem[] = [
    ...blocks
      .filter((b) => b.date === date)
      .map((b) => ({
        kind: 'block' as const,
        key: b.id,
        sort: b.start && b.end ? timeToMinutes(b.start) : -1,
        block: b,
      })),
    ...appointments
      .filter((a) => parts(a.startAt).date === date)
      .map((a) => ({
        kind: 'appointment' as const,
        key: a.id,
        sort: timeToMinutes(parts(a.startAt).time),
        appointment: a,
      })),
  ];
  // Equal times: a block is shown before the session that sits in it.
  return items.sort((x, y) => x.sort - y.sort || (x.kind === 'block' ? -1 : 1));
}
const DAY_END = 18 * 60;

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string; cancelled?: string };
}) {
  const user = await requireStaff();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const showCancelled = searchParams.cancelled === '1';
  // The subscription link shows client names, so only the administrator sees it.
  const feed =
    isAdmin
      ? await withTimeout(
          getCounter('calendar_feed').then((version) => calendarFeedUrls(version)),
          null,
          9000,
        )
      : null;

  const view = (searchParams.view ?? 'week') as 'day' | 'week' | 'month';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '')
    ? (searchParams.date as string)
    : today();

  // Data loads are capped so the calendar cannot hang. If either times out we
  // render an empty grid — practical enough to see the week and correct itself
  // on a refresh.
  const appointments = await withTimeout(listAppointments(), [], 9000);
  const blocks = await withTimeout<AvailabilityBlock[]>(listAvailabilityBlocks(), [], 9000);
  const allViews = await withTimeout<AppointmentView[]>(hydrateAppointments(appointments), [], 9000);
  const views = showCancelled ? allViews : allViews.filter((a) => !HIDDEN_BY_DEFAULT.has(a.status));
  const hiddenCount = allViews.length - views.length;

  // Busy time from the practitioner's own calendar. Titles are private, so
  // only administrators see them; other staff see "Busy".
  const external = await withTimeout(readExternalCalendar(), null, 9000);
  const externalBlocks = periodsToBlocks(external?.periods ?? []).map((b) =>
    isAdmin ? b : { ...b, reason: 'Busy' },
  );
  const shownBlocks = [...blocks, ...externalBlocks];
  let importHost: string | null = null;
  if (isAdmin) {
    const settings = await withTimeout(getSettings(), null, 9000);
    try {
      importHost = settings?.calendarImport?.url ? new URL(settings.calendarImport.url).hostname : null;
    } catch {
      importHost = null;
    }
  }
  const importStatus: CalendarImportStatus = {
    ...(external?.status ?? { connected: false, ok: true, events: 0, checkedAt: null }),
    host: importHost,
  };
  const keep = (extra: string) =>
    `/admin/calendar?${extra}${showCancelled ? '&cancelled=1' : ''}`;

  const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;
  const prev = addISODays(anchor, -step);
  const next = addISODays(anchor, step);

  const title =
    view === 'day'
      ? formatFullDate(anchor)
      : view === 'week'
        ? `${formatShortDate(startOfWeek(anchor))} – ${formatShortDate(addISODays(startOfWeek(anchor), 6))}`
        : monthLabel(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1);

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Calendar</h1>
            <p className="mt-2 text-ink-soft">{title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-line bg-white p-1">
              {(['day', 'week', 'month'] as const).map((v) => (
                <Link
                  key={v}
                  href={keep(`view=${v}&date=${anchor}`)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm capitalize transition-colors duration-200',
                    view === v ? 'bg-forest-800 text-cream-100' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {v}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={keep(`view=${view}&date=${prev}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={keep(`view=${view}&date=${today()}`)}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
              >
                Today
              </Link>
              <Link
                href={keep(`view=${view}&date=${next}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <BlockTimeControl
              blocks={blocks.map((b) => ({
                id: b.id,
                date: b.date,
                start: b.start ?? null,
                end: b.end ?? null,
                reason: b.reason,
              }))}
            />
            {isAdmin && <CalendarImport status={importStatus} />}
            {feed && <CalendarSubscribe https={feed.https} webcal={feed.webcal} />}
          </div>
        </div>
      </Reveal>

      <div className="mt-6">
        {view === 'day' && <DayView date={anchor} appointments={views} blocks={shownBlocks} />}
        {view === 'week' && <WeekView anchor={anchor} appointments={views} blocks={shownBlocks} />}
        {view === 'month' && <MonthView anchor={anchor} appointments={views} blocks={shownBlocks} />}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <Link
          href={`/admin/calendar?view=${view}&date=${anchor}${showCancelled ? '' : '&cancelled=1'}`}
          className="text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {showCancelled
            ? 'Hide cancelled and missed'
            : hiddenCount > 0
              ? `Show cancelled and missed (${hiddenCount})`
              : 'Show cancelled and missed'}
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- views */

function DayView({
  date,
  appointments,
  blocks,
}: {
  date: string;
  appointments: AppointmentView[];
  blocks: AvailabilityBlock[];
}) {
  const items = dayItems(date, appointments, blocks);

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      {hours.map((minute) => {
        const label = `${String(Math.floor(minute / 60)).padStart(2, '0')}:00`;
        // A block is listed in the hour it starts (whole-day blocks in the first
        // hour), so nothing repeats and each hour reads in time order.
        const inHourItems = items.filter((it) =>
          it.kind === 'block' && it.sort < 0
            ? minute === DAY_START
            : (it.sort >= minute && it.sort < minute + 60) ||
              // anything before opening or after closing goes in the first / last row
              (minute === DAY_START && it.sort >= 0 && it.sort < DAY_START) ||
              (minute === DAY_END - 60 && it.sort >= DAY_END),
        );

        return (
          <div key={minute} className="flex border-b border-line-soft last:border-0">
            <div className="w-20 shrink-0 border-r border-line-soft px-4 py-4 text-xs tabular text-ink-faint">
              {displayTime(label)}
            </div>
            <div className="flex-1 space-y-2 p-3">
              {inHourItems.length === 0 ? (
                <div className="h-8" />
              ) : (
                inHourItems.map((it) =>
                  it.kind === 'block' ? (
                    <BlockEventBlock key={it.key} block={it.block} />
                  ) : (
                    <EventBlock key={it.key} appointment={it.appointment} detailed />
                  ),
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  anchor,
  appointments,
  blocks,
}: {
  anchor: string;
  appointments: AppointmentView[];
  blocks: AvailabilityBlock[];
}) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addISODays(start, i));

  return (
    <div className="scrollbar-slim overflow-x-auto rounded-3xl border border-line bg-white">
      <div className="grid min-w-[52rem] grid-cols-7">
        {days.map((date) => {
          const isToday = date === today();
          const items = dayItems(date, appointments, blocks);

          return (
            <div key={date} className="min-h-[26rem] border-r border-line-soft last:border-0">
              <div
                className={cn(
                  'sticky top-0 border-b border-line-soft px-3 py-3 text-center',
                  isToday ? 'bg-forest-50 dark:bg-forest-900/30' : 'bg-cream-50/60 dark:bg-card/60',
                )}
              >
                <p className="text-2xs uppercase tracking-[0.1em] text-ink-faint">
                  {dayName(date).slice(0, 3)}
                </p>
                <p
                  className={cn(
                    'mt-1 font-display text-lg tabular',
                    isToday ? 'text-forest-700 dark:text-forest-300' : 'text-ink',
                  )}
                >
                  {Number(date.slice(8))}
                </p>
              </div>
              <div className="space-y-2 p-2">
                {items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-2xs text-ink-faint">—</p>
                ) : (
                  items.map((it) =>
                    it.kind === 'block' ? (
                      <BlockEventBlock key={it.key} block={it.block} compact />
                    ) : (
                      <EventBlock key={it.key} appointment={it.appointment} compact />
                    ),
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  anchor,
  appointments,
  blocks,
}: {
  anchor: string;
  appointments: AppointmentView[];
  blocks: AvailabilityBlock[];
}) {
  const year = Number(anchor.slice(0, 4));
  const monthIndex = Number(anchor.slice(5, 7)) - 1;
  const cells = monthGrid(year, monthIndex);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line-soft bg-cream-50/60 dark:bg-card/60">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-3 py-3 text-center text-2xs uppercase tracking-[0.1em] text-ink-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="min-h-28 border-b border-r border-line-soft bg-cream-50/40 dark:bg-card/40" />;
          const items = dayItems(date, appointments, blocks);
          const rows = items.flatMap((it) => (it.kind === 'appointment' ? [it.appointment] : []));
          const dayBlocks = items.flatMap((it) => (it.kind === 'block' ? [it.block] : []));
          const isToday = date === today();

          return (
            <div
              key={date}
              className="min-h-28 border-b border-r border-line-soft p-2 last:border-r-0"
            >
              <Link
                href={`/admin/calendar?view=day&date=${date}`}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm tabular transition-colors',
                  isToday ? 'bg-forest-800 text-cream-100' : 'text-ink hover:bg-cream-100 dark:hover:bg-card',
                )}
              >
                {Number(date.slice(8))}
              </Link>
              {/* On a phone a month cell is too narrow for text — show dots. */}
              {(rows.length > 0 || dayBlocks.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                  {dayBlocks.map((b) => (
                    <span
                      key={b.id}
                      className="h-1.5 w-1.5 rounded-full bg-state-danger"
                      title={`Blocked: ${b.reason ?? 'Unavailable'}`}
                    />
                  ))}
                  {rows.slice(0, 4).map((a) => (
                    <span
                      key={a.id}
                      className={cn('h-1.5 w-1.5 rounded-full', STATUS_BAR[a.status])}
                      title={`${displayTime(parts(a.startAt).time)} ${a.client?.name ?? ''}`}
                    />
                  ))}
                </div>
              )}

              <div className="mt-1.5 hidden space-y-1 sm:block">
                {items.slice(0, 3).map((it) => {
                  if (it.kind === 'block') {
                    const b = it.block;
                    return (
                      <div
                        key={it.key}
                        className="relative block truncate rounded-md bg-stone-100 py-1 pl-2.5 pr-1.5 text-2xs text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                        title={`${b.source === 'external' ? 'Your calendar' : 'Blocked'}: ${b.reason ?? 'Unavailable'}`}
                      >
                        <span className="absolute inset-y-1 left-1 w-0.5 rounded-full bg-stone-400" />
                        {b.start ? `${b.start} ` : ''}{b.reason || 'Blocked'}
                      </div>
                    );
                  }
                  const a = it.appointment;
                  return (
                  <Link
                    key={a.id}
                    href={`/admin/appointments?ref=${a.reference}`}
                    className={cn(
                      'relative block truncate rounded-md py-1 pl-2.5 pr-1.5 text-2xs',
                      STATUS_FILL[a.status],
                    )}
                  >
                    <span
                      className={cn(
                        'absolute inset-y-1 left-1 w-0.5 rounded-full',
                        STATUS_BAR[a.status],
                      )}
                    />
                    {displayTime(parts(a.startAt).time).replace(':00', '')} {a.client?.name}
                  </Link>
                  );
                })}
                {items.length > 3 && (
                  <Link
                    href={`/admin/calendar?view=day&date=${date}`}
                    className="block px-1.5 text-2xs text-ink-faint hover:text-ink"
                  >
                    +{items.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockEventBlock({ block, compact }: { block: AvailabilityBlock; compact?: boolean }) {
  return (
    <div
      className={cn(
        'relative block rounded-xl border border-dashed border-stone-300 bg-stone-50 py-2 pl-4 pr-3 text-stone-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-300',
      )}
    >
      <span className="absolute inset-y-2 left-1.5 w-[3px] rounded-full bg-stone-400" />
      <p className={cn('font-medium', compact ? 'text-2xs' : 'text-sm')}>
        {block.start && block.end ? `${block.start} – ${block.end}` : 'Full Day Block'}
      </p>
      <p className={cn('truncate opacity-80', compact ? 'text-2xs' : 'text-sm flex items-center gap-1.5')}>
        {block.source === 'external' ? <CalendarDays className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {block.reason || 'Time Blocked'}
      </p>
      {block.source === 'external' && !compact && (
        <p className="mt-0.5 text-2xs uppercase tracking-[0.08em] opacity-60">From your calendar</p>
      )}
    </div>
  );
}

function EventBlock({
  appointment,
  compact,
  detailed,
}: {
  appointment: AppointmentView;
  compact?: boolean;
  detailed?: boolean;
}) {
  const when = parts(appointment.startAt);
  return (
    <Link
      href={`/admin/appointments?ref=${appointment.reference}`}
      className={cn(
        'relative block rounded-xl py-2 pl-4 pr-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-subtle',
        STATUS_FILL[appointment.status],
      )}
    >
      <span
        className={cn(
          'absolute inset-y-2 left-1.5 w-[3px] rounded-full',
          STATUS_BAR[appointment.status],
        )}
      />
      <p className={cn('font-medium text-ink', compact ? 'text-2xs' : 'text-sm')}>
        {displayTime(when.time)}
      </p>
      <p className={cn('truncate text-ink-muted', compact ? 'text-2xs' : 'text-sm')}>
        {appointment.client?.name ?? 'Client'}
      </p>
      {!compact && (
        <p className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
          {appointment.mode === 'online' ? (
            <Video className="h-3 w-3" />
          ) : (
            <MapPin className="h-3 w-3" />
          )}
          {appointment.service.name}
          {detailed && (
            <Badge tone="neutral" size="sm" className="ml-1">
              {STATUS_LABEL[appointment.status]}
            </Badge>
          )}
        </p>
      )}
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-soft">
      {(
        [
          ['confirmed', 'Confirmed'],
          ['pending_payment', 'Awaiting payment'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled or missed'],
        ] as const
      ).map(([status, label]) => (
        <span key={status} className="flex items-center gap-2">
          <span className={cn('h-3 w-[3px] rounded-full', STATUS_BAR[status])} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-2">
        <span className="h-3 w-[3px] rounded-full bg-stone-400" />
        Blocked or busy in your calendar
      </span>
    </div>
  );
}