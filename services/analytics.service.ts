import 'server-only';

import {
  hydrateAppointments,
  listAppointments,
  listClients,
  listFollowUps,
  listPayments,
} from '@/lib/db';
import { addISODays, daysBetween, parts, today } from '@/lib/date';
import { bucketFollowUp } from './followup.service';
import type { AppointmentView } from '@/types';

/** Aggregations behind the admin dashboard. Kept as one pass over the data. */

export interface DashboardMetrics {
  todayAppointments: AppointmentView[];
  upcoming: AppointmentView[];
  pendingPayments: { count: number; totalCents: number };
  revenue: { last30Cents: number; previous30Cents: number; deltaPct: number };
  followUps: { due: number; overdue: number; awaitingPayment: number };
  clients: { total: number; newLast30: number };
  cancellations: { last30: number; noShows30: number };
  trend: { date: string; label: string; booked: number; completed: number }[];
  revenueByService: { name: string; cents: number }[];
  modeSplit: { online: number; inPerson: number };
}

/**
 * A safe zero-state, used as the fallback when the real metrics cannot be
 * loaded in time. Every field is present so the dashboard renders its normal
 * empty states instead of crashing on a missing property.
 */
export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  todayAppointments: [],
  upcoming: [],
  pendingPayments: { count: 0, totalCents: 0 },
  revenue: { last30Cents: 0, previous30Cents: 0, deltaPct: 0 },
  followUps: { due: 0, overdue: 0, awaitingPayment: 0 },
  clients: { total: 0, newLast30: 0 },
  cancellations: { last30: 0, noShows30: 0 },
  trend: [],
  revenueByService: [],
  modeSplit: { online: 0, inPerson: 0 },
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const t = today();
  const [appointments, payments, followUps, clients] = await Promise.all([
    listAppointments(),
    listPayments(),
    listFollowUps(),
    listClients(),
  ]);
  const views = await hydrateAppointments(appointments);

  const todayViews = views
    .filter((a) => parts(a.startAt).date === t && a.status !== 'cancelled')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const upcoming = views
    .filter((a) => a.startAt > new Date().toISOString() && ['confirmed', 'pending_payment'].includes(a.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 8);

  const pending = payments.filter((p) => p.status === 'pending' || p.status === 'processing');

  const windowStart = addISODays(t, -30);
  const previousStart = addISODays(t, -60);
  const paidIn = (from: string, to: string) =>
    payments
      .filter((p) => p.status === 'paid' && p.paidAt)
      .filter((p) => {
        const d = parts(p.paidAt as string).date;
        return d >= from && d < to;
      })
      .reduce((sum, p) => sum + p.amountCents, 0);

  const last30 = paidIn(windowStart, addISODays(t, 1));
  const previous30 = paidIn(previousStart, windowStart);
  const deltaPct = previous30 === 0 ? (last30 > 0 ? 100 : 0) : ((last30 - previous30) / previous30) * 100;

  const buckets = followUps.map(bucketFollowUp);

  // 14-day booking trend for the dashboard chart.
  const trend: DashboardMetrics['trend'] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addISODays(t, -i);
    const onDay = views.filter((a) => parts(a.startAt).date === date);
    trend.push({
      date,
      label: date.slice(8) + '/' + date.slice(5, 7),
      booked: onDay.filter((a) => a.status !== 'cancelled').length,
      completed: onDay.filter((a) => a.status === 'completed').length,
    });
  }

  const revenueMap = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== 'paid' || !p.appointmentId) continue;
    const appt = views.find((a) => a.id === p.appointmentId);
    const name = appt?.service?.name ?? 'Other';
    revenueMap.set(name, (revenueMap.get(name) ?? 0) + p.amountCents);
  }

  const active = views.filter((a) => a.status !== 'cancelled');

  return {
    todayAppointments: todayViews,
    upcoming,
    pendingPayments: {
      count: pending.length,
      totalCents: pending.reduce((s, p) => s + p.amountCents, 0),
    },
    revenue: { last30Cents: last30, previous30Cents: previous30, deltaPct },
    followUps: {
      due: buckets.filter((b) => b === 'due').length,
      overdue: buckets.filter((b) => b === 'overdue').length,
      awaitingPayment: buckets.filter((b) => b === 'awaiting_payment').length,
    },
    clients: {
      total: clients.length,
      newLast30: clients.filter((c) => daysBetween(parts(c.user.createdAt).date, t) <= 30).length,
    },
    cancellations: {
      last30: views.filter((a) => a.status === 'cancelled' && parts(a.startAt).date >= windowStart).length,
      noShows30: views.filter((a) => a.status === 'no_show' && parts(a.startAt).date >= windowStart).length,
    },
    trend,
    revenueByService: [...revenueMap.entries()]
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 5),
    modeSplit: {
      online: active.filter((a) => a.mode === 'online').length,
      inPerson: active.filter((a) => a.mode === 'in_person').length,
    },
  };
}
