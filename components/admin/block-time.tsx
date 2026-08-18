'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CheckboxRow, Input, Label } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { blockTime, unblockTime } from '@/app/actions/admin';
import { formatFullDate, today } from '@/lib/date';

interface Block {
  id: string;
  date: string;
  start: string | null;
  end: string | null;
  reason: string;
}

/**
 * Blocking time out of the booking calendar — leave, a public holiday, or a
 * closed afternoon. Blocked periods disappear from client availability
 * immediately because the same rules drive both surfaces.
 */
export function BlockTimeControl({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [wholeDay, setWholeDay] = React.useState(true);
  const [date, setDate] = React.useState(today());
  const [start, setStart] = React.useState('08:00');
  const [end, setEnd] = React.useState('12:00');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const upcoming = blocks.filter((b) => b.date >= today()).sort((a, b) => a.date.localeCompare(b.date));

  async function save() {
    setBusy(true);
    const result = await blockTime({
      date,
      start: wholeDay ? null : start,
      end: wholeDay ? null : end,
      reason,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not block that time', description: result.error });
      return;
    }
    setOpen(false);
    setReason('');
    toast({ tone: 'success', title: 'Time blocked', description: 'It no longer appears as available.' });
    router.refresh();
  }

  async function remove(id: string) {
    const result = await unblockTime(id);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not remove that block' });
      return;
    }
    toast({ tone: 'success', title: 'Block removed' });
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarOff className="h-4 w-4" />
        Block time
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Block time"
        description="Close a whole day or part of one. Existing bookings are untouched — this only stops new ones."
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button full onClick={save} loading={busy} disabled={!reason.trim()}>
              Block it
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              type="date"
              value={date}
              min={today()}
              onChange={(e) => setDate(e.target.value)}
              data-autofocus
            />
          </div>

          <CheckboxRow
            id="whole-day"
            checked={wholeDay}
            onChange={setWholeDay}
            title="Block the whole day"
            description="Leave this off to block only part of the day."
          />

          {!wholeDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="block-start">From</Label>
                <Input
                  id="block-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="block-end">Until</Label>
                <Input id="block-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="block-reason">Reason</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Public holiday, leave, training…"
            />
          </div>

          {upcoming.length > 0 && (
            <div className="border-t border-line pt-5">
              <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-faint">
                Currently blocked
              </p>
              <ul className="mt-3 space-y-2">
                {upcoming.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{formatFullDate(block.date)}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {block.start && block.end ? `${block.start}–${block.end} · ` : 'All day · '}
                        {block.reason}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(block.id)}
                      className="shrink-0 rounded-full p-2 text-ink-faint transition-colors hover:bg-state-dangerSoft hover:text-state-danger"
                      aria-label={`Remove block on ${block.date}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
