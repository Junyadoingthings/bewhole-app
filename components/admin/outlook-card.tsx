'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, RefreshCw } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { settle } from '@/lib/settle';
import { disconnectOutlook, syncOutlookNow } from '@/app/actions/admin';

export interface OutlookStatus {
  configured: boolean;
  connected: boolean;
  accountEmail?: string;
  lastSyncedLabel?: string | null;
  lastSyncError?: string | null;
  issues: { at: string; message: string }[];
  notice?: string | null;
}

/** Console Settings: link the practice's Outlook calendar (two-way). */
export function OutlookCard({ status }: { status: OutlookStatus }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState(false);

  async function syncNow() {
    setBusy(true);
    const r = await settle(syncOutlookNow());
    setBusy(false);
    toast(
      r.ok
        ? { tone: 'success', title: 'Outlook synced', description: 'summary' in r ? r.summary : undefined }
        : { tone: 'error', title: 'Outlook could not be synced', description: r.error },
    );
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    const r = await settle(disconnectOutlook());
    setBusy(false);
    setConfirmOff(false);
    toast(r.ok ? { tone: 'success', title: 'Outlook disconnected' } : { tone: 'error', title: 'Could not disconnect', description: r.error });
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-xl text-ink">
        <CalendarCheck className="h-5 w-5 text-forest-700 dark:text-forest-300" />
        Outlook calendar
      </h2>

      {status.notice && <p className="mt-3 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink dark:bg-canvas-sunk">{status.notice}</p>}

      {!status.configured ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Not set up yet — your website developer needs to register the site with Microsoft first.
        </p>
      ) : !status.connected ? (
        <>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-soft">
            <li>• Every confirmed session appears in your Outlook (and on your phone), coloured by service, with a reminder.</li>
            <li>• Move a session in Outlook and it moves on the website — the client is emailed.</li>
            <li>• Delete a session in Outlook and it is cancelled — the client is emailed.</li>
            <li>• Your own Outlook events block those times on the booking page (clients see no details).</li>
          </ul>
          <ButtonLink href="/api/outlook/connect" prefetch={false} className="mt-5">
            Connect Outlook
          </ButtonLink>
        </>
      ) : (
        <>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Connected to</dt>
              <dd className="text-ink">{status.accountEmail}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Last synced</dt>
              <dd className="text-ink">{status.lastSyncedLabel ?? 'Not yet'}</dd>
            </div>
          </dl>
          {status.lastSyncError && (
            <p className="mt-3 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger">
              The last sync failed: {status.lastSyncError}. Try “Sync now”; if it keeps failing, disconnect and
              connect again.
            </p>
          )}
          {status.issues.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink">Needs your attention</p>
              <ul className="mt-2 space-y-2">
                {status.issues.map((i) => (
                  <li key={i.at + i.message} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink-soft">
                    {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={syncNow} loading={busy}>
              <RefreshCw className="h-4 w-4" />
              Sync now
            </Button>
            {confirmOff ? (
              <>
                <span className="text-sm text-ink-soft">Stop syncing with Outlook?</span>
                <Button size="sm" variant="danger" onClick={disconnect} loading={busy}>
                  Disconnect
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmOff(false)} disabled={busy}>
                  Keep
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmOff(true)} disabled={busy}>
                Disconnect
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
