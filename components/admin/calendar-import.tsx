'use client';

import * as React from 'react';
import { CalendarArrowDown, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { settle } from '@/lib/settle';
import {
  connectCalendarImport,
  disconnectCalendarImport,
  refreshCalendarImport,
} from '@/app/actions/admin';

export interface CalendarImportStatus {
  connected: boolean;
  ok: boolean;
  events: number;
  checkedAt: string | null;
  error?: string;
  host?: string | null;
}

/** Where each calendar app keeps its private link, in the practice's words. */
const HOW_TO = [
  {
    app: 'Google Calendar',
    steps: 'On a computer: Settings → choose your calendar → “Integrate calendar” → copy “Secret address in iCal format”.',
  },
  {
    app: 'iPhone, iPad or Mac (iCloud)',
    steps: 'In the Calendar app, tap the calendar’s ⓘ → turn on “Public Calendar” → “Share Link” → copy.',
  },
  {
    app: 'Outlook',
    steps: 'Outlook on the web: Settings → Calendar → Shared calendars → “Publish a calendar” → copy the ICS link.',
  },
];

/**
 * "Add my calendar to BWC": paste the private link of your own calendar and
 * everything in it becomes blocked time on BWC — clients can't book over it.
 */
export function CalendarImport({ status }: { status: CalendarImportStatus }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState<'connect' | 'refresh' | 'disconnect' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy('connect');
    const result = await settle(connectCalendarImport(url));
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Could not connect that calendar.');
      return;
    }
    setUrl('');
    toast({
      tone: 'success',
      title: 'Your calendar is connected',
      description: `${result.events ?? 0} upcoming event${result.events === 1 ? '' : 's'} now block time on BWC.`,
    });
    router.refresh();
  }

  async function refresh() {
    setBusy('refresh');
    const result = await settle(refreshCalendarImport());
    setBusy(null);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not read your calendar', description: result.error });
      return;
    }
    toast({ tone: 'success', title: 'Calendar refreshed', description: `${result.events ?? 0} upcoming events.` });
    router.refresh();
  }

  async function disconnect() {
    setBusy('disconnect');
    const result = await settle(disconnectCalendarImport());
    setBusy(null);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not disconnect', description: result.error });
      return;
    }
    toast({ tone: 'success', title: 'Calendar disconnected', description: 'Its events no longer block time on BWC.' });
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarArrowDown className="h-4 w-4" />
        {status.connected ? 'My calendar' : 'Add my calendar to BWC'}
        {status.connected && (
          <span
            className={`ml-0.5 h-2 w-2 rounded-full ${status.ok ? 'bg-forest-600' : 'bg-state-danger'}`}
            aria-label={status.ok ? 'Connected' : 'Needs attention'}
          />
        )}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="Add my calendar to BWC"
        description="Everything in your own calendar becomes blocked time here, so clients can only book when you're actually free."
      >
        <div className="space-y-5">
          {status.connected ? (
            <div className="rounded-2xl border border-line bg-cream-50 px-4 py-3 dark:bg-canvas">
              <p className="text-sm font-medium text-ink">
                {status.ok ? 'Connected' : 'Connected — but your calendar could not be read'}
                {status.host && <span className="font-normal text-ink-muted"> · {status.host}</span>}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {status.ok
                  ? `${status.events} upcoming event${status.events === 1 ? '' : 's'} block time. Checked every few minutes.`
                  : status.error}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={refresh} loading={busy === 'refresh'} disabled={!!busy}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh now
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnect} loading={busy === 'disconnect'} disabled={!!busy}>
                  Disconnect
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={connect} className="space-y-2">
            <label htmlFor="cal-import-url" className="text-sm font-medium text-ink">
              {status.connected ? 'Replace with another calendar link' : 'Paste your calendar’s private link'}
            </label>
            <div className="flex gap-2">
              <input
                id="cal-import-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                aria-invalid={!!error}
                aria-describedby={error ? 'cal-import-error' : undefined}
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200 dark:bg-canvas"
              />
              <Button type="submit" size="sm" loading={busy === 'connect'} disabled={!!busy || !url.trim()}>
                Connect
              </Button>
            </div>
            {error && (
              <p id="cal-import-error" className="text-xs text-state-danger">
                {error}
              </p>
            )}
          </form>

          <div>
            <p className="text-sm font-medium text-ink">Where to find the link</p>
            <ul className="mt-2 space-y-2">
              {HOW_TO.map((h) => (
                <li key={h.app} className="rounded-2xl border border-line bg-white px-4 py-3 dark:bg-card">
                  <p className="text-sm font-medium text-ink">{h.app}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{h.steps}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-cream-100 px-4 py-3 text-xs leading-relaxed text-ink-soft dark:bg-canvas-sunk">
            <p>
              <strong className="font-medium text-ink">No double bookings.</strong> BWC sessions that
              are already in your calendar are recognised and skipped, so you can keep using “Add to
              my calendar” as well.
            </p>
            <p className="mt-2">
              Events marked <em>free</em> in your calendar don’t block time. Nothing is ever changed
              in your calendar — BWC only reads it.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
