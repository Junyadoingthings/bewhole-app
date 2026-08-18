'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { markNotificationsSeen } from '@/app/actions/admin';

export function MarkAllRead({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await markNotificationsSeen(ids);
        setBusy(false);
        router.refresh();
      }}
    >
      <CheckCheck className="h-4 w-4" />
      Mark all read
    </Button>
  );
}
