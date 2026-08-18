'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { toggleResourcePublished } from '@/app/actions/admin';

export function ResourceToggle({
  resourceId,
  published,
}: {
  resourceId: string;
  published: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    setBusy(true);
    const result = await toggleResourcePublished(resourceId, !published);
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not update', description: result.error });
      return;
    }
    toast({ tone: 'success', title: published ? 'Unpublished' : 'Published' });
    router.refresh();
  }

  return (
    <Button size="xs" variant={published ? 'ghost' : 'secondary'} onClick={toggle} loading={busy}>
      {published ? 'Unpublish' : 'Publish'}
    </Button>
  );
}
