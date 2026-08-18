'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Skeleton } from '@/components/ui/primitives';
import { addISODays, monthGrid, monthLabel, today } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { DayAvailability } from '@/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Booking calendar.
 *
 * Availability is fetched per visible month and painted onto the grid: open,
 * limited, fully booked, closed, past. Nothing is selectable that the server
 * would refuse — and the server checks again at commit time regardless.
 */
export function BookingCalendar({
  serviceId,
  mode,
  locationId,
  selected,
  onSelect,
  maxAdvanceDays = 60,
}: {
  serviceId: string;
  mode: 'online' | 'in_person';
  locationId?: string | null;
  selected: string | null;
  onSelect: (date: string) => void;
  maxAdvanceDays?: number;
}) {
  const t = today();
  const [year, setYear] = React.useState(() => Number(t.slice(0, 4)));
  const [monthIndex, setMonthIndex] = React.useState(() => Number(t.slice(5, 7)) - 1);
  const [days, setDays] = React.useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = React.useState(true);
  const reduced = useReducedMotion();

  const cells = React.useMemo(() => monthGrid(year, monthIndex), [year, monthIndex]);
  const horizonEnd = addISODays(t, maxAdvanceDays);

  const first = cells.find(Boolean) as string;
  const last = [...cells].reverse().find(Boolean) as string;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ serviceId, mode, from: first, to: last });
    if (mode === 'in_person' && locationId) params.set('locationId', locationId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { days?: DayAvailability[] }) => {
        if (cancelled) return;
        const map: Record<string, DayAvailability> = {};
        for (const day of data.days ?? []) map[day.date] = day;
        setDays(map);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [serviceId, mode, locationId, first, last]);

  const canGoBack = `${year}-${String(monthIndex + 1).padStart(2, '0')}` > t.slice(0, 7);
  const canGoForward = last < horizonEnd;

  function shift(delta: number) {
    const next = monthIndex + delta;
    if (next < 0) {
      setMonthIndex(11);
      setYear((y) => y - 1);
    } else if (next > 11) {
      setMonthIndex(0);
      setYear((y) => y + 1);
    } else {
      setMonthIndex(next);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${year}-${monthIndex}`}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="font-display text-lg text-ink"
          >
            {monthLabel(year, monthIndex)}
          </motion.p>
        </AnimatePresence>

        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-2 text-center text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}

        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          if (loading) return <Skeleton key={date} className="aspect-square rounded-xl" />;

          const day = days[date];
          const status = day?.status ?? 'closed';
          const isToday = date === t;
          const isSelected = date === selected;
          const disabled = status === 'past' || status === 'closed' || status === 'full';

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              aria-label={`${date}${disabled ? ' — unavailable' : `, ${day?.openSlots ?? 0} times available`}`}
              aria-pressed={isSelected}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all duration-200 ease-calm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-forest-800 font-medium text-cream-100 shadow-subtle'
                  : disabled
                    ? 'cursor-not-allowed text-ink-faint/60'
                    : 'text-ink hover:-translate-y-0.5 hover:bg-cream-100 dark:hover:bg-card',
                !isSelected && isToday && 'ring-1 ring-inset ring-forest-400',
              )}
            >
              <span className="tabular">{Number(date.slice(8))}</span>
              {/* Availability is shown by a dot AND by disabled state — never colour alone. */}
              {!isSelected && (status === 'open' || status === 'limited') && (
                <span
                  className={cn(
                    'absolute bottom-1.5 h-1 w-1 rounded-full',
                    status === 'open' ? 'bg-forest-500' : 'bg-state-warning',
                  )}
                />
              )}
              {!isSelected && status === 'full' && (
                <span className="absolute bottom-1.5 h-px w-2.5 rounded-full bg-ink-faint/50" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-500" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-state-warning" /> Few times left
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-3 rounded-full bg-ink-faint/50" /> Fully booked
        </span>
        <span className="flex items-center gap-1.5 text-ink-faint">Greyed out — closed</span>
      </div>
    </div>
  );
}
