import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarX2,
  CreditCard,
  Repeat,
  TrendingUp,
  UserPlus,
  Video,
  MapPin,
} from 'lucide-react';

import { BookingTrendChart, ModeSplit, RevenueByServiceChart } from '@/components/admin/charts';
import { STATUS_META } from '@/components/portal/appointment-card';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState, StatTile } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { displayTime, formatFullDate, greeting, parts, today } from '@/lib/date';
import { EMPTY_DASHBOARD_METRICS, getDashboardMetrics } from '@/services/analytics.service';
import { withTimeout } from '@/lib/db/with-timeout';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const user = await requireStaff();
  // Never let the summary hang the page. If the metrics query cannot complete
  // in time the dashboard renders its empty state — the console stays usable
  // and, crucially, sign-in (which waits for this page) completes.
  const m = await withTimeout(getDashboardMetrics(), EMPTY_DASHBOARD_METRICS, 8000);
  const up = m.revenue.deltaPct >= 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-soft">{greeting()},</p>
            <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{user.firstName}</h1>
            <p className="mt-2 text-sm text-ink-soft">{formatFullDate(today())}</p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/admin/calendar" variant="secondary" size="sm">
              Open calendar
            </ButtonLink>
            <ButtonLink href="/admin/follow-ups" size="sm">
              Create follow-up
            </ButtonLink>
          </div>
        </div>
      </Reveal>

      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Today"
            value={m.todayAppointments.length}
            hint={
              m.todayAppointments.length === 0
                ? 'No sessions scheduled'
                : `${m.todayAppointments.filter((a) => a.mode === 'online').length} online · ${m.todayAppointments.filter((a) => a.mode === 'in_person').length} in person`
            }
            icon={<CalendarCheck className="h-4 w-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Awaiting payment"
            value={m.pendingPayments.count}
            hint={money(m.pendingPayments.totalCents) + ' outstanding'}
            tone={m.pendingPayments.count > 0 ? 'warning' : 'neutral'}
            icon={<CreditCard className="h-4 w-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Follow-ups due"
            value={m.followUps.due + m.followUps.overdue}
            hint={
              m.followUps.overdue > 0
                ? `${m.followUps.overdue} overdue`
                : `${m.followUps.awaitingPayment} awaiting payment`
            }
            tone={m.followUps.overdue > 0 ? 'danger' : 'neutral'}
            icon={<Repeat className="h-4 w-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Revenue · 30 days"
            value={money(m.revenue.last30Cents)}
            hint={
              <span className={up ? 'text-forest-600 dark:text-forest-300' : 'text-state-danger'}>
                {up ? (
                  <ArrowUpRight className="inline h-3 w-3" />
                ) : (
                  <ArrowDownRight className="inline h-3 w-3" />
                )}{' '}
                {Math.abs(Math.round(m.revenue.deltaPct))}% vs previous 30
              </span>
            }
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Reveal>
          <section className="rounded-3xl border border-line bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg text-ink">Today’s sessions</h2>
                <p className="mt-1 text-sm text-ink-soft">{formatFullDate(today())}</p>
              </div>
              <Link
                href="/admin/appointments"
                className="group inline-flex items-center gap-1.5 text-sm text-forest-700 dark:text-forest-300"
              >
                All
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-5 space-y-2">
              {m.todayAppointments.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarCheck className="h-5 w-5" />}
                  title="A clear day"
                  description="Nothing booked for today. A good moment for follow-ups."
                  action={
                    <ButtonLink href="/admin/follow-ups" size="sm" variant="secondary">
                      Review follow-ups
                    </ButtonLink>
                  }
                />
              ) : (
                m.todayAppointments.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/clients/${a.clientUserId}`}
                    className="group flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5 transition-all duration-250 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-subtle"
                  >
                    <span className="w-16 shrink-0 font-display text-lg tabular text-ink">
                      {displayTime(parts(a.startAt).time).replace(' ', '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {a.client?.name ?? 'Client'}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                        {a.mode === 'online' ? (
                          <Video className="h-3 w-3" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        {a.service?.name ?? 'Session'}
                      </span>
                    </span>
                    <Badge tone={STATUS_META[a.status]?.tone ?? 'neutral'} size="sm">
                      {STATUS_META[a.status]?.label ?? a.status}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-lg text-ink">Bookings · last 14 days</h2>
            <p className="mt-1 text-sm text-ink-soft">Solid is booked, dashed is completed.</p>
            <div className="mt-5">
              <BookingTrendChart data={m.trend} />
            </div>
          </section>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Reveal>
          <section className="h-full rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-lg text-ink">Revenue by service</h2>
            <p className="mt-1 text-sm text-ink-soft">All payments received.</p>
            <div className="mt-5">
              {m.revenueByService.length > 0 ? (
                <RevenueByServiceChart data={m.revenueByService} />
              ) : (
                <p className="py-8 text-center text-sm text-ink-soft">No payments yet.</p>
              )}
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.05}>
          <section className="h-full rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-lg text-ink">Online vs in person</h2>
            <p className="mt-1 text-sm text-ink-soft">Across all active bookings.</p>
            <div className="mt-8">
              <ModeSplit online={m.modeSplit.online} inPerson={m.modeSplit.inPerson} />
            </div>

            <div className="mt-8 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-ink-soft">
                  <UserPlus className="h-3.5 w-3.5" /> New clients · 30 days
                </span>
                <span className="tabular text-ink">{m.clients.newLast30}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-ink-soft">
                  <CalendarX2 className="h-3.5 w-3.5" /> Cancellations · 30 days
                </span>
                <span className="tabular text-ink">{m.cancellations.last30}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-ink-soft">
                  <CalendarX2 className="h-3.5 w-3.5" /> Missed · 30 days
                </span>
                <span className="tabular text-ink">{m.cancellations.noShows30}</span>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.1}>
          <section className="h-full rounded-3xl border border-line bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg text-ink">Next up</h2>
              <Link href="/admin/calendar" className="text-sm text-forest-700 dark:text-forest-300">
                Calendar
              </Link>
            </div>
            <div className="mt-5 space-y-2">
              {m.upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">Nothing scheduled ahead.</p>
              ) : (
                m.upcoming.slice(0, 5).map((a) => (
                  <div key={a.id} className="rounded-2xl border border-line px-4 py-3">
                    <p className="text-sm font-medium text-ink">{a.client?.name ?? 'Client'}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatFullDate(parts(a.startAt).date).split(',')[0]} ·{' '}
                      {displayTime(parts(a.startAt).time)} · {a.service?.name ?? 'Session'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
