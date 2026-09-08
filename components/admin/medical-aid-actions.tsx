'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldQuestion, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Label, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { setMedicalAidDecision } from '@/app/actions/admin';
import { money } from '@/lib/utils';

/**
 * Accept or decline a client's medical aid, from the appointment row.
 *
 * Deliberately two visible buttons rather than entries in the "…" menu. This
 * is the one action on the page with a client waiting on the other end of it,
 * and burying it behind a menu is how a booking sits unverified for a week.
 *
 * Both paths confirm first. Accepting sends a confirmation the client will
 * plan around; declining re-prices the session to the private fee and asks
 * them for money. Neither should be one stray click away, and the dialog is
 * where the scheme details are shown — so the person deciding can actually see
 * what they are deciding on.
 */
export function MedicalAidActions({
  appointmentId,
  clientName,
  scheme,
  memberNumber,
  mainMember,
  coPaymentCents,
  privateFeeCents,
}: {
  appointmentId: string;
  clientName: string;
  scheme?: string | null;
  memberNumber?: string | null;
  mainMember?: string | null;
  coPaymentCents: number;
  privateFeeCents: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<'accept' | 'decline' | null>(null);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit(decision: 'accepted' | 'declined') {
    setBusy(true);
    const result = await setMedicalAidDecision(
      appointmentId,
      decision,
      decision === 'declined' ? reason : undefined,
    );
    setBusy(false);

    if (!result.ok) {
      toast({ tone: 'error', title: 'That didn’t work', description: result.error });
      return;
    }
    setMode(null);
    setReason('');
    toast({
      tone: 'success',
      title: decision === 'accepted' ? 'Medical aid accepted' : 'Medical aid declined',
      description:
        decision === 'accepted'
          ? `${clientName} has been sent their confirmation.`
          : `${clientName} has been emailed a card payment link.`,
    });
    router.refresh();
  }

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMode('accept')}
          className="inline-flex items-center gap-1 rounded-full border border-forest-300 bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-800 transition-colors duration-200 hover:border-forest-600 hover:bg-forest-800 hover:text-cream-100 dark:bg-forest-900/30 dark:text-forest-200"
        >
          <Check className="h-3 w-3" />
          Accept aid
        </button>
        <button
          type="button"
          onClick={() => setMode('decline')}
          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors duration-200 hover:border-state-danger hover:bg-state-dangerSoft hover:text-state-danger"
        >
          <X className="h-3 w-3" />
          Decline
        </button>
      </div>

      <Modal
        open={mode !== null}
        onClose={() => !busy && setMode(null)}
        title={mode === 'decline' ? 'Decline this medical aid?' : 'Accept this medical aid?'}
        description={
          mode === 'decline'
            ? 'The session stays booked, is re-priced to the private fee, and the client is emailed a card payment link.'
            : 'The session is confirmed, added to the calendar, and the client is emailed their confirmation.'
        }
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setMode(null)} disabled={busy}>
              Not yet
            </Button>
            <Button
              full
              loading={busy}
              variant={mode === 'decline' ? 'danger' : 'primary'}
              onClick={() => submit(mode === 'decline' ? 'declined' : 'accepted')}
            >
              {mode === 'decline' ? 'Decline & request payment' : 'Accept & confirm'}
            </Button>
          </div>
        }
      >
        {/*
          The scheme details, in the dialog rather than the table. They are the
          thing being verified, and they do not belong on a screen that may be
          open in a room with other people in it.
        */}
        <div className="rounded-2xl border border-line bg-cream-50 p-4 text-sm dark:bg-canvas">
          <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.14em] text-ink-faint">
            <ShieldQuestion className="h-3.5 w-3.5" />
            Details to verify
          </p>
          <dl className="mt-3 space-y-2">
            <Row label="Client" value={clientName} />
            <Row label="Scheme" value={scheme || 'Not captured'} />
            <Row label="Member number" value={memberNumber || 'Not captured'} />
            <Row label="Main member" value={mainMember || 'Not captured'} />
          </dl>
        </div>

        {mode === 'accept' ? (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {coPaymentCents > 0
              ? `The client will be told a co-payment of ${money(coPaymentCents)} is due at the appointment.`
              : 'No co-payment applies — the session will be claimed in full from the scheme.'}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              The amount owing changes from{' '}
              <span className="font-medium text-ink">{money(coPaymentCents)}</span> to the private
              fee of <span className="font-medium text-ink">{money(privateFeeCents)}</span>.
            </p>
            <div className="mt-4">
              <Label htmlFor="decline-reason" optional>
                What should we tell the client?
              </Label>
              <Textarea
                id="decline-reason"
                rows={3}
                value={reason}
                maxLength={600}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Your scheme does not cover counselling on your current plan."
                data-autofocus
              />
              <p className="mt-1.5 text-xs text-ink-faint">
                Included in their email word for word. Leave it blank to send the standard message.
              </p>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
