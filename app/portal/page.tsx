import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  MapPin,
  Repeat,
  Video,
} from 'lucide-react';

import { AppointmentCard } from '@/components/portal/appointment-card';
import { ArcMotif, BotanicalLines } from '@/components/site/decor';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { displayTime, greeting, hoursUntil, parts, relativeDay } from '@/lib/date';
import {
  hydrateAppointments,
  hydrateFollowUps,
  listAppointments,
  listFollowUps,
  listNotifications,
  listPayments,
  listResources,
} from '@/lib/db';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Your portal', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PortalOverview() {
  const user = await requireUser();

  const [appointments, followUps, payments, resources, notifications] = await Promise.all([
    listAppointments({ clientUserId: user.id }),
    listFollowUps({ clientUserId: user.id }),
    listPayments({ clientUserId: user.id }),
    listResources(),
    listNotifications({ audience: 'client', userId: user.id }),
  ]);

  const views = await hydrateAppointments(appointments);
  const followUpViews = await hydrateFollowUps(followUps);
  const now = new Date().toISOString();

  const upcoming = views
    .filter((a) => a.startAt >= now && ['confirmed', 'pending_payment'].includes(a.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const next = upcoming[0];
  const rest = upcoming.slice(1, 4);
  const past = views
    .filter((a) => a.startAt < now || a.status === 'completed')
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  const outstanding = payments.filter((p) => p.status === 'pending' || p.status === 'processing');
  const openFollowUps = followUpViews.filter((f) =>
    ['scheduled', 'awaiting_payment'].includes(f.status),
  );
  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="mx-auto max-w-5xl">
      <Reveal>
        <p className="text-sm text-ink-soft">{greeting()},</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{user.firstName}</h1>
      </Reveal>

      {/* The next session is the single dominant element on this screen. */}
      <Reveal delay={0.05} className="mt-8">
        {next ? <NextSessionCard appointment={next} /> : <NoSessionCard />}
      </Reveal>

      {(outstanding.length > 0 || openFollowUps.length > 0 || unread.length > 0) && (
        <Stagger className="mt-5 grid gap-4 sm:grid-cols-3">
          {outstanding.length > 0 && (
            <StaggerItem>
              <AlertTile
                href="/portal/payments"
                icon={<CreditCard className="h-4.5 w-4.5" />}
                title={`${outstanding.length} payment${outstanding.length > 1 ? 's' : ''} outstanding`}
                detail={money(outstanding.reduce((s, p) => s + p.amountCents, 0))}
                tone="warning"
              />
            </StaggerItem>
          )}
          {openFollowUps.length > 0 && (
            <StaggerItem>
              <AlertTile
                href="/portal/follow-ups"
                icon={<Repeat className="h-4.5 w-4.5" />}
                title={`${openFollowUps.length} follow-up${openFollowUps.length > 1 ? 's' : ''}`}
                detail={`Next on ${relativeDay(openFollowUps[0].dueDate).toLowerCase()}`}
                tone="info"
              />
            </StaggerItem>
          )}
          {unread.length > 0 && (
            <StaggerItem>
              <AlertTile
                href="/portal/appointments"
                icon={<CalendarDays className="h-4.5 w-4.5" />}
                title={`${unread.length} update${unread.length > 1 ? 's' : ''}`}
                detail={unread[0].title}
                tone="neutral"
              />
            </StaggerItem>
          )}
        </Stagger>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-xl text-ink">Coming up</h2>
            <Link
              href="/portal/appointments"
              className="group inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-forest-700 dark:text-forest-300"
            >
              All appointments
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {rest.length > 0 ? (
              rest.map((a) => <AppointmentCard key={a.id} appointment={a} />)
            ) : (
              <EmptyState
                compact
                icon={<CalendarPlus className="h-5 w-5" />}
                title={next ? 'Nothing else booked yet' : 'Ready when you are'}
                description={
                  next
                    ? 'You can book your next session whenever you’re ready — there’s no obligation to book ahead.'
                    : 'Booking takes about two minutes and you’ll see real availability.'
                }
                action={
                  <ButtonLink href="/book" size="sm">
                    Book a session
                  </ButtonLink>
                }
              />
            )}
          </div>

          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-xl text-ink">Recent sessions</h2>
              <div className="mt-5 space-y-3">
                {past.slice(0, 3).map((a) => (
                  <AppointmentCard key={a.id} appointment={a} showPrice={false} />
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">For you</h2>
          <div className="mt-5 space-y-3">
            {resources.slice(0, 3).map((resource) => (
              <Link
                key={resource.id}
                href={`/portal/resources`}
                className="group block rounded-2xl border border-line bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-3.5 w-3.5 text-forest-600 dark:text-forest-300" />
                  <span className="text-xs text-ink-faint">
                    {resource.topic} · {resource.readMinutes} min
                  </span>
                </div>
                <p className="mt-2.5 font-medium leading-snug text-ink">{resource.title}</p>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-6">
            <p className="font-medium text-ink">Need to change something?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              You can reschedule or cancel from any appointment. Please give us at least 24 hours’
              notice — late cancellations may be charged in full.
            </p>
            <ButtonLink href="/contact" variant="secondary" size="sm" className="mt-4">
              Contact the practice
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

function NextSessionCard({ appointment }: { appointment: Awaited<ReturnType<typeof hydrateAppointments>>[number] }) {
  const when = parts(appointment.startAt);
  const soon = hoursUntil(appointment.startAt) <= 2 && hoursUntil(appointment.startAt) > -1;
  const pending = appointment.status === 'pending_payment';

  return (
    <div className="relative overflow-hidden rounded-4xl bg-forest-900 p-7 text-cream-100 sm:p-10">
      <div className="absolute inset-0 bg-forest-deep" />
      <BotanicalLines className="-right-8 -top-6 h-[130%] text-forest-300/20" />
      <ArcMotif className="-bottom-32 left-8 h-80 w-80 text-forest-300/15" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-300">
            Your next session
          </p>
          {pending && (
            <Badge tone="warning" size="sm">
              Payment pending
            </Badge>
          )}
        </div>

        <h2 className="mt-5 font-display text-3xl text-cream-100 sm:text-4xl text-balance">
          {appointment.service.name}
        </h2>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] text-cream-100/50">When</p>
            <p className="mt-1 font-display text-xl text-cream-100">
              {relativeDay(when.date)} · {displayTime(when.time)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.1em] text-cream-100/50">Where</p>
            <p className="mt-1 flex items-center gap-2 font-display text-xl text-cream-100">
              {appointment.mode === 'online' ? (
                <>
                  <Video className="h-4.5 w-4.5" /> Online
                </>
              ) : (
                <>
                  <MapPin className="h-4.5 w-4.5" /> {appointment.location?.name}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {appointment.mode === 'online' && appointment.sessionLink && !pending ? (
            <a
              href={appointment.sessionLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-cream-100 dark:bg-card px-7 text-[0.95rem] font-medium text-forest-900 dark:text-forest-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
            >
              <Video className="h-4 w-4" />
              {soon ? 'Join session now' : 'Open session link'}
            </a>
          ) : pending ? (
            <ButtonLink href={`/portal/appointments/${appointment.id}`} variant="onDark" size="lg">
              Complete payment
            </ButtonLink>
          ) : null}
          <ButtonLink
            href={`/portal/appointments/${appointment.id}`}
            variant="onDarkGhost"
            size="lg"
          >
            Manage appointment
          </ButtonLink>
        </div>

        {appointment.mode === 'online' && !appointment.sessionLink && !pending && (
          <p className="mt-5 text-sm text-cream-100/55">
            Your session link will appear here before we meet — we send it with your reminder too.
          </p>
        )}
      </div>
    </div>
  );
}

function NoSessionCard() {
  return (
    <div className="relative overflow-hidden rounded-4xl border border-line bg-white p-8 sm:p-12">
      <ArcMotif className="-right-16 -top-16 h-72 w-72 text-forest-300/25" />
      <div className="relative max-w-md">
        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-600 dark:text-forest-300">
          No upcoming sessions
        </p>
        <h2 className="mt-5 font-display text-3xl text-ink text-balance">Ready when you are.</h2>
        <p className="mt-4 leading-relaxed text-ink-soft text-pretty">
          There is no obligation to book ahead. When you want a session, it takes about two minutes
          and you’ll see exactly what’s open.
        </p>
        <ButtonLink href="/book" size="lg" className="mt-7">
          Book an appointment
        </ButtonLink>
      </div>
    </div>
  );
}

function AlertTile({
  href,
  icon,
  title,
  detail,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone: 'warning' | 'info' | 'neutral';
}) {
  const tones = {
    warning: 'bg-state-warningSoft text-state-warning',
    info: 'bg-state-infoSoft text-state-info',
    neutral: 'bg-cream-100 dark:bg-card text-forest-700 dark:text-forest-300',
  }[tone];

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-soft">{detail}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
