'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, RefreshCw, RotateCcw, Undo2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { settle } from '@/lib/settle';
import {
  markPaymentNotReceived,
  markPaymentReceived,
  recheckPayment,
  refund,
  undoPaymentTick,
} from '@/app/actions/admin';
import { today } from '@/lib/date';
import type { Payment, PaymentStatus } from '@/types';

/**
 * What can be done with one line on the Payments page.
 *
 * Lines the practice ticks off by hand ("manual": medical aid claims, Yoco
 * links, EFT, cash) get Mark received — with the amount that actually
 * arrived and the day — or Not paid, and either can be undone. Card
 * checkouts are settled by the provider, so they get Re-check and Refund.
 */
export function PaymentActions({
  paymentId,
  status,
  isAdmin,
  method,
  provider,
  amountCents,
  clientName,
}: {
  paymentId: string;
  status: PaymentStatus;
  isAdmin: boolean;
  method: Payment['method'];
  provider: Payment['provider'];
  amountCents: number;
  clientName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<'received' | 'not_paid' | null>(null);
  const [amount, setAmount] = React.useState((amountCents / 100).toFixed(2));
  const [receivedOn, setReceivedOn] = React.useState(today());
  const [reason, setReason] = React.useState('');

  const manual = provider === 'manual';
  const isClaim = method === 'medical_aid';
  const awaiting = status === 'pending' || status === 'processing';

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(key);
    const result = await settle(fn());
    setBusy(null);
    if (!result.ok) {
      toast({ tone: 'error', title: 'That didn’t work', description: result.error });
      return false;
    }
    toast({ tone: 'success', title: success });
    setDialog(null);
    router.refresh();
    return true;
  }

  if (!isAdmin) return null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {awaiting && (
          <Button size="xs" onClick={() => setDialog('received')}>
            <Check className="h-3.5 w-3.5" />
            Mark received
          </Button>
        )}
        {awaiting && manual && (
          <Button size="xs" variant="secondary" onClick={() => setDialog('not_paid')}>
            <X className="h-3.5 w-3.5" />
            Not paid
          </Button>
        )}
        {awaiting && !manual && (
          <Button
            size="xs"
            variant="secondary"
            loading={busy === 'check'}
            onClick={() => run('check', () => recheckPayment(paymentId), 'Status re-checked')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-check
          </Button>
        )}
        {manual && (status === 'paid' || status === 'failed') && (
          <Button
            size="xs"
            variant="secondary"
            loading={busy === 'undo'}
            onClick={() => run('undo', () => undoPaymentTick(paymentId), 'Back to awaiting')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </Button>
        )}
        {status === 'paid' && !manual && (
          <Button
            size="xs"
            variant="dangerQuiet"
            loading={busy === 'refund'}
            onClick={() => run('refund', () => refund(paymentId), 'Refund issued')}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Refund
          </Button>
        )}
      </div>

      <Modal
        open={dialog === 'received'}
        onClose={() => busy === null && setDialog(null)}
        title={isClaim ? 'Medical aid payment received' : 'Payment received'}
        description={
          isClaim
            ? `Record what the scheme paid for ${clientName}. It is often different from the session fee.`
            : `Record the payment from ${clientName}. If the session was waiting on it, it is confirmed and ${clientName} is emailed their confirmation.`
        }
        footer={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" full onClick={() => setDialog(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              full
              loading={busy === 'received'}
              onClick={() =>
                run(
                  'received',
                  () => markPaymentReceived(paymentId, { amountRands: amount, receivedOn }),
                  'Marked as received',
                )
              }
            >
              <Check className="h-4 w-4" />
              Mark received
            </Button>
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor={`amount-${paymentId}`}>Amount received (R)</Label>
            <Input
              id={`amount-${paymentId}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-autofocus
            />
          </div>
          <div>
            <Label htmlFor={`date-${paymentId}`}>Received on</Label>
            <Input
              id={`date-${paymentId}`}
              type="date"
              max={today()}
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === 'not_paid'}
        onClose={() => busy === null && setDialog(null)}
        title={isClaim ? 'Scheme did not pay' : 'Payment not received'}
        description="The line is marked as not paid. You can undo this later if the money does arrive."
        footer={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" full onClick={() => setDialog(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              full
              variant="danger"
              loading={busy === 'not_paid'}
              onClick={() =>
                run('not_paid', () => markPaymentNotReceived(paymentId, reason), 'Marked as not paid')
              }
            >
              Mark not paid
            </Button>
          </div>
        }
      >
        <Label htmlFor={`reason-${paymentId}`} optional>
          Note
        </Label>
        <Input
          id={`reason-${paymentId}`}
          value={reason}
          placeholder={isClaim ? 'e.g. Benefits exhausted for this year' : 'e.g. Client did not pay'}
          onChange={(e) => setReason(e.target.value)}
          data-autofocus
        />
      </Modal>
    </>
  );
}
