import type { Metadata } from 'next';
import { Repeat } from 'lucide-react';

import { FollowUpPayButton } from '@/components/portal/follow-up-pay-button';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { displayTime, formatFullDate, relativeDay, today } from '@/lib/date';
import { hydrateFollowUps, listFollowUps } from '@/lib/db';
import { money } from '@/lib/utils';
import type { FollowUpStatus } from '@/types';

export const metadata: Metadata = { title: 'Follow-ups', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS: Record<FollowUpStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export default async function FollowUpsPage() {
  const user = await requireUser();
  const followUps = await listFollowUps({ clientUserId: user.id });
  const views = await hydrateFollowUps(followUps);

  const open = views.filter((f) => !['completed', 'cancelled'].includes(f.status));
  const closed = views.filter((f) => ['completed', 'cancelled'].includes(f.status));

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Follow-ups</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">
          Sessions your practitioner has set aside for you. Once payment is received we confirm the
          booking and send your calendar invitation.
        </p>
      </Reveal>

      <div className="mt-8 space-y-3">
        {open.length === 0 && closed.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-6 w-6" />}
            title="No follow-ups right now"
            description="If your practitioner arranges one, it will appear here with everything you need to confirm it."
            action={
              <ButtonLink href="/book" size="sm">
                Book a session
              </ButtonLink>
            }
          />
        ) : (
          open.map((followUp) => {
            const overdue = followUp.dueDate < today() && followUp.status === 'awaiting_payment';
            const meta = STATUS[followUp.status];
            return (
              <div
                key={followUp.id}
                className="rounded-3xl border border-line bg-white p-6 transition-shadow duration-300 hover:shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{followUp.service.name}</p>
                      <Badge tone={overdue ? 'danger' : meta.tone} size="sm">
                        {overdue ? 'Overdue' : meta.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">
                      {relativeDay(followUp.dueDate)} · {formatFullDate(followUp.dueDate)}
                      {followUp.preferredTime && ` · ${displayTime(followUp.preferredTime)}`}
                    </p>
                    <p className="mt-1 text-sm text-ink-faint">
                      {followUp.mode === 'online'
                        ? 'Online'
                        : (followUp.location?.name ?? 'In person')}
                      {followUp.paymentRequired && ` · ${money(followUp.amountCents)}`}
                    </p>
                  </div>

                  {followUp.status === 'awaiting_payment' && followUp.paymentRequired && (
                    <FollowUpPayButton
                      followUpId={followUp.id}
                      amountLabel={money(followUp.amountCents)}
                    />
                  )}
                </div>

                {followUp.notes && (
                  <p className="mt-4 rounded-2xl bg-cream-100 dark:bg-card p-4 text-sm leading-relaxed text-ink-muted">
                    {followUp.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {closed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Past follow-ups
          </h2>
          <div className="mt-4 space-y-3">
            {closed.map((followUp) => (
              <div
                key={followUp.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/60 p-5"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{followUp.service.name}</p>
                  <p className="mt-1 text-sm text-ink-faint">{formatFullDate(followUp.dueDate)}</p>
                </div>
                <Badge tone={STATUS[followUp.status].tone} size="sm">
                  {STATUS[followUp.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
