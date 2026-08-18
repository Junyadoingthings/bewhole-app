import type { Metadata } from 'next';
import Link from 'next/link';
import { Repeat } from 'lucide-react';

import { FollowUpActions } from '@/components/admin/follow-up-actions';
import { FollowUpComposer } from '@/components/admin/follow-up-composer';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { displayTime, formatFullDate, relativeDay } from '@/lib/date';
import { listClients, listLocations, listServices } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { getFollowUpBoard, type FollowUpBucket } from '@/services/followup.service';
import { money } from '@/lib/utils';
import type { FollowUpView } from '@/types';

export const metadata: Metadata = { title: 'Follow-ups', robots: { index: false } };
export const dynamic = 'force-dynamic';

const COLUMNS: {
  key: FollowUpBucket;
  title: string;
  hint: string;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
}[] = [
  { key: 'overdue', title: 'Overdue', hint: 'Past the follow-up date', tone: 'danger' },
  { key: 'due', title: 'Due today', hint: 'Happening today', tone: 'warning' },
  { key: 'awaiting_payment', title: 'Awaiting payment', hint: 'Link sent, not yet paid', tone: 'warning' },
  { key: 'upcoming', title: 'Upcoming', hint: 'Scheduled ahead', tone: 'info' },
  { key: 'completed', title: 'Closed', hint: 'Completed or cancelled', tone: 'neutral' },
];

export default async function AdminFollowUpsPage() {
  await requireStaff();

  // Each load is guarded so a slow query can never leave a permanent blank
  // screen. Empty results render the columns' empty state.
  const emptyBoard = {
    overdue: [],
    due: [],
    awaiting_payment: [],
    upcoming: [],
    completed: [],
  } as Awaited<ReturnType<typeof getFollowUpBoard>>;
  const board = await withTimeout(getFollowUpBoard(), emptyBoard, 9000);
  const services = await withTimeout(listServices(), [], 9000);
  const locations = await withTimeout(listLocations(), [], 9000);
  const clients = await withTimeout(listClients(), [], 9000);

  const total = Object.values(board).flat().length;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Follow-ups</h1>
            <p className="mt-2 max-w-xl text-ink-soft">
              Record a follow-up and the system takes it from there: reminder on the date you choose,
              payment request if one is due, then confirmation and calendar once it clears.
            </p>
          </div>
          <FollowUpComposer
            services={services}
            locations={locations}
            clients={clients.map((c) => ({
              id: c.user.id,
              name: `${c.profile.firstName} ${c.profile.lastName}`,
            }))}
          />
        </div>
      </Reveal>

      {total === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Repeat className="h-6 w-6" />}
            title="No follow-ups yet"
            description="Open a client and create one, or use the button above."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {COLUMNS.map((column) => {
            const items = board[column.key];
            if (items.length === 0) return null;
            return (
              <section key={column.key}>
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl text-ink">{column.title}</h2>
                  <Badge tone={column.tone} size="sm">
                    {items.length}
                  </Badge>
                  <span className="text-sm text-ink-faint">{column.hint}</span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {items.map((followUp) => (
                    <FollowUpCard key={followUp.id} followUp={followUp} bucket={column.key} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowUpCard({ followUp, bucket }: { followUp: FollowUpView; bucket: FollowUpBucket }) {
  const closed = bucket === 'completed';

  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/clients/${followUp.clientUserId}`}
            className="font-medium text-ink hover:text-forest-700 dark:hover:text-forest-300"
          >
            {followUp.client?.name ?? 'Client'}
          </Link>
          <p className="mt-1 text-sm text-ink-soft">{followUp.service.name}</p>
        </div>
        <Badge tone={closed ? 'neutral' : 'outline'} size="sm">
          {followUp.status.replace('_', ' ')}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Follow-up</dt>
          <dd className="mt-0.5 text-ink">
            {relativeDay(followUp.dueDate)}
            {followUp.preferredTime && ` · ${displayTime(followUp.preferredTime)}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Reminder</dt>
          <dd className="mt-0.5 text-ink">
            {followUp.reminderSentAt ? 'Sent' : formatFullDate(followUp.reminderDate).split(',')[0]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Amount</dt>
          <dd className="mt-0.5 tabular text-ink">
            {followUp.paymentRequired ? money(followUp.amountCents) : 'No charge'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Channel</dt>
          <dd className="mt-0.5 capitalize text-ink">{followUp.channel}</dd>
        </div>
      </dl>

      {followUp.notes && (
        <p className="mt-4 rounded-2xl bg-cream-100 dark:bg-card p-3.5 text-sm leading-relaxed text-ink-muted">
          {followUp.notes}
        </p>
      )}

      {!closed && (
        <div className="mt-4 border-t border-line pt-4">
          <FollowUpActions
            followUpId={followUp.id}
            canSend={followUp.status === 'scheduled' || followUp.status === 'awaiting_payment'}
            canComplete={followUp.status === 'confirmed' || followUp.status === 'paid'}
          />
        </div>
      )}
    </div>
  );
}
