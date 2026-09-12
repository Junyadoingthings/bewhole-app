import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Video } from 'lucide-react';

import { BlockTimeControl } from '@/components/admin/block-time';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
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
import { hydrateAppointments, listAppointments, listAvailabilityBlocks } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { cn } from '@/lib/utils';
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
const DAY_END = 18 * 60;

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string };
}) {
  await requireStaff();

  const view = (searchParams.view ?? 'week') as 'day' | 'week' | 'month';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '')
    ? (searchParams.date as string)
    : today();

  // Data loads are capped so the calendar cannot hang. If either times out we
  // render an empty grid — practical enough to see the week and correct itself
  // on a refresh.
  const appointments = await withTimeout(listAppointments(), [], 9000);
  const blocks = await withTimeout<AvailabilityBlock[]>(listAvailabilityBlocks(), [], 9000);
  const views = await withTimeout<AppointmentView[]>(hydrateAppointments(appointments), [], 9000);

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
                  href={`/admin/calendar?view=${v}&date=${anchor}`}
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
                href={`/admin/calendar?view=${view}&date=${prev}`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={`/admin/calendar?view=${view}&date=${today()}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
              >
                Today
              </Link>
              <Link
                href={`/admin/calendar?view=${view}&date=${next}`}
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
            <ButtonLink
              href="https://outlook.live.com/calendar/0/view/month"
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              <ExternalLink className="h-4 w-4" />
              Open Outlook
            </ButtonLink>
          </div>
        </div>
      </Reveal>

      <div className="mt-6">
        {view === 'day' && <DayView date={anchor} appointments={views} />}
        {view === 'week' && <WeekView anchor={anchor} appointments={views} />}
        {view === 'month' && <MonthView anchor={anchor} appointments={views} />}
      </div>

      <Legend />
    </div>
  );
}

/* ------------------------------------------------------------------- views */

function DayView({ date, appointments }: { date: string; appointments: AppointmentView[] }) {
  const rows = appointments
    .filter((a) => parts(a.startAt).date === date)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      {hours.map((minute) => {
        const label = `${String(Math.floor(minute / 60)).padStart(2, '0')}:00`;
        const inHour = rows.filter((a) => {
          const start = timeToMinutes(parts(a.startAt).time);
          return start >= minute && start < minute + 60;
        });
        return (
          <div key={minute} className="flex border-b border-line-soft last:border-0">
            <div className="w-20 shrink-0 border-r border-line-soft px-4 py-4 text-xs tabular text-ink-faint">
              {displayTime(label)}
            </div>
            <div className="flex-1 space-y-2 p-3">
              {inHour.length === 0 ? (
                <div className="h-8" />
              ) : (
                inHour.map((a) => <EventBlock key={a.id} appointment={a} detailed />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ anchor, appointments }: { anchor: string; appointments: AppointmentView[] }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addISODays(start, i));

  return (
    <div className="scrollbar-slim overflow-x-auto rounded-3xl border border-line bg-white">
      <div className="grid min-w-[52rem] grid-cols-7">
        {days.map((date) => {
          const isToday = date === today();
          const rows = appointments
            .filter((a) => parts(a.startAt).date === date)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));

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
                {rows.length === 0 ? (
                  <p className="px-1 py-4 text-center text-2xs text-ink-faint">—</p>
                ) : (
                  rows.map((a) => <EventBlock key={a.id} appointment={a} compact />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ anchor, appointments }: { anchor: string; appointments: AppointmentView[] }) {
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
          const rows = appointments
            .filter((a) => parts(a.startAt).date === date)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
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
              {rows.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
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
                {rows.slice(0, 3).map((a) => (
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
                ))}
                {rows.length > 3 && (
                  <p className="px-1.5 text-2xs text-ink-faint">+{rows.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-soft">
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
    </div>
  );
}
