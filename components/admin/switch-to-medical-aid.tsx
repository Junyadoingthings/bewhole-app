'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FieldError, Input, Label } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { settle } from '@/lib/settle';
import { getClientMedicalAid, switchAppointmentToMedicalAid } from '@/app/actions/admin';

const FIELDS = [
  { key: 'name', label: 'Medical Aid Name', placeholder: 'e.g. Discovery Health' },
  { key: 'scheme', label: 'Medical Scheme', placeholder: 'e.g. Classic Saver' },
  { key: 'memberNumber', label: 'Membership Number', placeholder: '' },
  { key: 'mainMember', label: 'Main Member', placeholder: 'Self, or their full name' },
  { key: 'mainMemberId', label: 'Main Member ID Number', placeholder: 'As it appears on the scheme' },
  { key: 'dateOfBirth', label: 'Client Date of Birth', placeholder: '', type: 'date' },
] as const;

type Aid = Record<(typeof FIELDS)[number]['key'], string>;
const empty: Aid = { name: '', scheme: '', memberNumber: '', mainMember: '', mainMemberId: '', dateOfBirth: '' };

/**
 * Move an unpaid card booking onto medical aid, from the console. The client's
 * medical aid on file is filled in for the practice to check; the booking then
 * waits in "Medical aid to verify" for the usual Accept / Decline.
 */
export function SwitchToMedicalAid({
  open,
  onClose,
  appointmentId,
  clientUserId,
}: {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  clientUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [aid, setAid] = React.useState<Aid>(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    let live = true;
    getClientMedicalAid(clientUserId).then((onFile) => {
      if (live && onFile) setAid({ ...empty, ...onFile } as Aid);
    });
    return () => {
      live = false;
    };
  }, [open, clientUserId]);

  async function save() {
    setBusy(true);
    const result = await settle(switchAppointmentToMedicalAid(appointmentId, aid));
    setBusy(false);
    if (!result.ok) {
      setErrors('errors' in result && result.errors ? result.errors : {});
      toast({ tone: 'error', title: 'Could not switch to medical aid', description: result.error });
      return;
    }
    toast({
      tone: 'success',
      title: 'Moved to medical aid',
      description: 'It is now under “Medical aid to verify” — accept or decline it there.',
    });
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Switch to medical aid"
      description="For a client who meant to use medical aid. The booking keeps its time, the unpaid card payment is cancelled, and it waits for you to accept or decline the medical aid. The client is not emailed until you do."
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="ghost" full onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" full loading={busy} onClick={save}>
            Switch to medical aid
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'name' || f.key === 'scheme' ? 'sm:col-span-2' : undefined}>
            <Label htmlFor={`ma-${f.key}-${appointmentId}`}>{f.label}</Label>
            <Input
              id={`ma-${f.key}-${appointmentId}`}
              type={'type' in f ? f.type : 'text'}
              placeholder={f.placeholder}
              value={aid[f.key]}
              onChange={(e) => setAid((current) => ({ ...current, [f.key]: e.target.value }))}
              error={errors[f.key]}
            />
            <FieldError>{errors[f.key]}</FieldError>
          </div>
        ))}
      </div>
    </Modal>
  );
}
