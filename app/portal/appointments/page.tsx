import type { Metadata } from 'next';
import { CalendarPlus } from 'lucide-react';

import { AppointmentCard } from '@/components/portal/appointment-card';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { hydrateAppointments, listAppointments } from '@/lib/db';

export const metadata: Metadata = { title: 'Appointments', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  const user = await requireUser();
  // Scoped by the session's user id — never by a parameter.
  const appointments = await listAppointments({ clientUserId: user.id });
  const views = await hydrateAppointments(appointments);

  const now = new Date().toISOString();
  const upcoming = views
    .filter((a) => a.startAt >= now && a.status !== 'cancelled' && a.status !== 'completed')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = views
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Appointments</h1>
            <p className="mt-2 text-ink-soft">Everything you’ve booked, past and upcoming.</p>
          </div>
          <ButtonLink href="/book" size="sm">
            Book a session
          </ButtonLink>
        </div>
      </Reveal>

      <section className="mt-9">
        <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">Upcoming</h2>
        <div className="mt-4 space-y-3">
          {upcoming.length > 0 ? (
            upcoming.map((a) => <AppointmentCard key={a.id} appointment={a} />)
          ) : (
            <EmptyState
              compact
              icon={<CalendarPlus className="h-5 w-5" />}
              title="No upcoming appointments"
              description="Ready when you are — booking takes about two minutes."
              action={
                <ButtonLink href="/book" size="sm">
                  Book an appointment
                </ButtonLink>
              }
            />
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Past & cancelled
          </h2>
          <div className="mt-4 space-y-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} showPrice={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
