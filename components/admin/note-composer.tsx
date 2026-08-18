'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { addClientNote } from '@/app/actions/admin';

/**
 * Administrative notes only.
 *
 * The label is explicit about that: clinical records are not kept in this
 * system, and the placeholder discourages putting them here.
 */
export function NoteComposer({ clientUserId }: { clientUserId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = React.useState('');
  const [category, setCategory] = React.useState<'admin' | 'session_admin' | 'billing'>('admin');
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const result = await addClientNote({ clientUserId, category, body });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not save note', description: result.error });
      return;
    }
    setBody('');
    toast({ tone: 'success', title: 'Note added' });
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-ink">Add a note</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Administrative only — scheduling, billing and practicalities.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Label htmlFor="note-category">Type</Label>
          <Select
            id="note-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="admin">General admin</option>
            <option value="session_admin">Session admin</option>
            <option value="billing">Billing</option>
          </Select>
        </div>
      </div>

      <Textarea
        className="mt-4"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Prefers online sessions; fortnightly rhythm suits their shifts."
        aria-label="Note"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-faint">
          Clinical records belong in your practice records, not here.
        </p>
        <Button onClick={save} loading={busy} disabled={body.trim().length < 2} size="sm">
          Save note
        </Button>
      </div>
    </div>
  );
}
