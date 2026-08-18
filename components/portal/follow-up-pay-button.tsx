'use client';

import * as React from 'react';
import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { payFollowUp } from '@/app/actions/follow-ups';

export function FollowUpPayButton({
  followUpId,
  amountLabel,
}: {
  followUpId: string;
  amountLabel: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function pay() {
    setBusy(true);
    const result = await payFollowUp(followUpId);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setBusy(false);
    toast({ tone: 'error', title: 'Could not open payment', description: result.error });
  }

  return (
    <Button onClick={pay} loading={busy} loadingText="Opening…" size="sm">
      <CreditCard className="h-4 w-4" />
      Pay {amountLabel}
    </Button>
  );
}
