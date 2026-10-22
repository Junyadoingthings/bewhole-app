'use client';

import * as React from 'react';
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { settle } from '@/lib/settle';
import { resetCalendarFeedLink } from '@/app/actions/admin';

const CALENDAR_NAME = 'Be Whole Care sessions';

/**
 * "Add to my calendar": the practice's private subscription link, with one
 * button per calendar app. Sessions and blocked time then appear in that
 * calendar and keep themselves up to date.
 */
export function CalendarSubscribe({ https, webcal }: { https: string; webcal: string }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [links, setLinks] = React.useState({ https, webcal });
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setLinks({ https, webcal }), [https, webcal]);

  // A webcal:// link opens the device's calendar app — if it has one for it.
  // When nothing takes over the page within two seconds, say so and point to
  // the copy option, instead of a button that seems to do nothing.
  const [appMissing, setAppMissing] = React.useState(false);
  function watchAppOpen() {
    setAppMissing(false);
    let left = false;
    const onLeave = () => {
      left = true;
    };
    window.addEventListener('blur', onLeave, { once: true });
    document.addEventListener('visibilitychange', onLeave, { once: true });
    window.setTimeout(() => {
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onLeave);
      if (!left) setAppMissing(true);
    }, 2000);
  }

  const encoded = encodeURIComponent(links.https);
  const name = encodeURIComponent(CALENDAR_NAME);
  const options = [
    {
      // One Outlook button for every device. A webcal:// link cannot open the
      // Outlook app (Outlook for Mac and the phone app do not register for it,
      // and some browsers block it silently), so the calendar is added to the
      // Outlook account on the web — and then appears in the Outlook app on her
      // phone and computer by itself, as the same account.
      label: 'Outlook (phone, computer or web)',
      hint: 'Outlook.com, Hotmail, Live',
      // Through Microsoft sign-in first: signed out, outlook.live.com shows its
      // marketing page instead of the calendar. Signed in, this passes straight through.
      href: `https://login.live.com/login.srf?wa=wsignin1.0&wreply=${encodeURIComponent(
        `https://outlook.live.com/calendar/0/addfromweb?url=${encoded}&name=${name}`,
      )}`,
    },
    {
      label: 'Microsoft 365 (work Outlook)',
      hint: 'In the browser',
      href: `https://outlook.office.com/calendar/0/addfromweb?url=${encoded}&name=${name}`,
    },
    { label: 'iPhone, iPad or Mac', hint: 'Apple Calendar', href: links.webcal, app: true },
    {
      label: 'Google Calendar',
      hint: 'In the browser',
      href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(links.webcal)}`,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(links.https);
      toast({ tone: 'success', title: 'Link copied' });
    } catch {
      toast({ tone: 'error', title: 'Could not copy', description: 'Select the link and copy it instead.' });
    }
  }

  async function reset() {
    setBusy(true);
    const result = await settle(resetCalendarFeedLink());
    setBusy(false);
    setConfirmReset(false);
    if (!result.ok || !result.https || !result.webcal) {
      toast({ tone: 'error', title: 'Could not reset the link', description: result.error });
      return;
    }
    setLinks({ https: result.https, webcal: result.webcal });
    toast({
      tone: 'success',
      title: 'New link ready',
      description: 'The old link no longer works. Add the calendar again with one of the buttons.',
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Add to my calendar
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setConfirmReset(false);
        }}
        title="Add bookings to your calendar"
        description="Your sessions and blocked time appear in your own calendar and keep themselves up to date. Choose where you keep your calendar."
      >
        <div className="space-y-5">
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={o.label}>
                <a
                  href={o.href}
                  target={o.href.startsWith('https:') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={'app' in o && o.app ? watchAppOpen : undefined}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink transition-colors hover:border-forest-300 hover:bg-cream-50 dark:bg-card dark:hover:bg-canvas"
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="text-xs text-ink-muted">{o.hint}</span>
                </a>
              </li>
            ))}
          </ul>

          {appMissing && (
            <p role="status" className="rounded-2xl bg-cream-100 px-4 py-3 text-sm leading-relaxed text-ink dark:bg-canvas-sunk">
              Nothing opened? This browser or device has no calendar app set up for the link. Copy the
              link below and paste it in your calendar under “Add calendar from internet” / “New
              calendar subscription”.
            </p>
          )}

          <div>
            <p className="text-sm font-medium text-ink">Or copy the link</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              In your calendar, choose “Subscribe to calendar” or “Add calendar from internet”, then
              paste it.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={links.https}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Calendar subscription link"
                className="min-w-0 flex-1 rounded-xl border border-line bg-cream-50 px-3 py-2 font-mono text-xs text-ink dark:bg-canvas"
              />
              <Button variant="secondary" size="sm" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>

          <div className="rounded-2xl bg-cream-100 px-4 py-3 text-xs leading-relaxed text-ink-soft dark:bg-canvas-sunk">
            <p>
              Calendar apps check for changes on their own schedule: Apple every few minutes,
              Outlook and Google every few hours. The console calendar is always up to date.
            </p>
            <p className="mt-2">
              <strong className="font-medium text-ink">Keep this link private.</strong> Anyone who
              has it can see your bookings. If it was shared by mistake, reset it.
            </p>
          </div>

          {confirmReset ? (
            <div className="rounded-2xl border border-state-danger/25 px-4 py-3">
              <p className="text-sm text-ink">
                Reset the link? The old one stops working everywhere, including in your own
                calendar, and you will need to add the calendar again.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)} disabled={busy}>
                  Keep current link
                </Button>
                <Button variant="danger" size="sm" onClick={reset} loading={busy}>
                  Reset link
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset link
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
