'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, RefreshCw, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { markPaymentPaid, recheckPayment, refund } from '@/app/actions/admin';
import type { PaymentStatus } from '@/types';

export function PaymentActions({
  paymentId,
  status,
  isAdmin,
}: {
  paymentId: string;
  status: PaymentStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(key);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      toast({ tone: 'error', title: 'That didn’t work', description: result.error });
      return;
    }
    toast({ tone: 'success', title: success });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {(status === 'pending' || status === 'processing') && (
        <>
          <Button
            size="xs"
            variant="secondary"
            loading={busy === 'check'}
            onClick={() => run('check', () => recheckPayment(paymentId), 'Status re-checked')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-check
          </Button>
          {isAdmin && (
            <Button
              size="xs"
              loading={busy === 'paid'}
              onClick={() => run('paid', () => markPaymentPaid(paymentId), 'Marked as received')}
            >
              <Check className="h-3.5 w-3.5" />
              Mark received
            </Button>
          )}
        </>
      )}
      {status === 'paid' && isAdmin && (
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
  );
}
