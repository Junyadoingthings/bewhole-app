import Link from 'next/link';
import { ArrowUpRight, Clock, MapPin, Video } from 'lucide-react';

import { Badge } from '@/components/ui/primitives';
import { displayTime, formatFullDate, parts, relativeDay } from '@/lib/date';
import { cn, money } from '@/lib/utils';
import type { AppointmentStatus, AppointmentView } from '@/types';

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }
> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  pending_payment: { label: 'Payment pending', tone: 'warning' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'Missed', tone: 'danger' },
};

export function AppointmentCard({
  appointment,
  href,
  showPrice = true,
}: {
  appointment: AppointmentView;
  href?: string;
  showPrice?: boolean;
}) {
  const when = parts(appointment.startAt);
  const status = STATUS_META[appointment.status];
  const target = href ?? `/portal/appointments/${appointment.id}`;

  return (
    <Link
      href={target}
      className={cn(
        'group flex items-start gap-4 rounded-3xl border border-line bg-white p-5 transition-all duration-300 ease-calm',
        'hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card',
        appointment.status === 'cancelled' && 'opacity-70',
      )}
    >
      {/* Date chip carries the scanning weight in a list. */}
      <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-cream-100 dark:bg-card py-2.5">
        <span className="text-2xs uppercase tracking-[0.08em] text-ink-faint">
          {formatFullDate(when.date).slice(0, 3)}
        </span>
        <span className="font-display text-xl tabular text-ink">{Number(when.date.slice(8))}</span>
        <span className="text-2xs uppercase tracking-[0.06em] text-ink-faint">
          {formatFullDate(when.date).split(' ')[2].slice(0, 3)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{appointment.service.name}</p>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>

        <p className="mt-1.5 text-sm text-ink-soft">
          {relativeDay(when.date)} · {displayTime(when.time)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            {appointment.mode === 'online' ? (
              <>
                <Video className="h-3.5 w-3.5" /> Online
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" /> {appointment.location?.name ?? 'In person'}
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {appointment.durationMinutes} min
          </span>
          {showPrice && appointment.amountCents > 0 && (
            <span className="tabular">{money(appointment.amountCents)}</span>
          )}
        </div>
      </div>

      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest-600 dark:group-hover:text-forest-300" />
    </Link>
  );
}
