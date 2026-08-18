'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { closeFollowUp, sendFollowUpNow } from '@/app/actions/follow-ups';

export function FollowUpActions({
  followUpId,
  canSend,
  canComplete,
}: {
  followUpId: string;
  canSend: boolean;
  canComplete: boolean;
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
    <div className="flex flex-wrap gap-2">
      {canSend && (
        <Button
          size="xs"
          variant="secondary"
          loading={busy === 'send'}
          onClick={() =>
            run('send', () => sendFollowUpNow(followUpId), 'Reminder sent')
          }
        >
          <Send className="h-3.5 w-3.5" />
          Send now
        </Button>
      )}
      {canComplete && (
        <Button
          size="xs"
          variant="ghost"
          loading={busy === 'done'}
          onClick={() =>
            run('done', () => closeFollowUp(followUpId, 'completed'), 'Follow-up completed')
          }
        >
          <Check className="h-3.5 w-3.5" />
          Complete
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        loading={busy === 'cancel'}
        onClick={() => run('cancel', () => closeFollowUp(followUpId, 'cancelled'), 'Follow-up cancelled')}
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </Button>
    </div>
  );
}
