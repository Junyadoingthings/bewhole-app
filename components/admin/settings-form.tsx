'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { Button } from '@/components/ui/button';
import```tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { Button } from '@/components/ui/button';
import { CheckboxRow, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { saveSettings } from '@/app/actions/admin';
import type { Settings } from '@/types';

/**
 * Business rules an admin can change without a deploy: hours of notice,
 * cancellation window, session length, reminder timing, co-payment amount.
 * Nothing here is hardcoded anywhere else in the app.
 */
export function SettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const [scheduling, setScheduling] = React.useState(settings.scheduling);
  const [reminders, setReminders] = React.useState(settings.reminders);
  const [payments, setPayments] = React.useState(settings.payments);
  const [business, setBusiness] = React.useState(settings.business);
  const [policy, setPolicy] = React.useState(settings.policy);
  const [banking, setBanking] = React.useState(
    settings.banking ?? {
      accountName: '',
      bank: '',
      accountNumber: '',
      branchCode: '',
      showOnInvoices: false,
    },
  );

  async function save() {
    setBusy(true);
    const result = await saveSettings({ scheduling, reminders, payments, business, policy, banking });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not save', description: result.error });
      return;
    }
    toast({ tone: 'success', title: 'Settings saved', description: 'Changes apply immediately.' });
    router.refresh();
  }

  const disabled = !canEdit;

  return (
    <div className="space-y-6">
      <Section hint="Shown to clients across the site and in messages." title="Practice details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="biz-name" label="Practice name">
            <Input disabled="{disabled}" id="biz-name" onChange="{(e)" value="{business.name}"> setBusiness({ ...business, name: e.target.value })}
            />
          </Field>
          <Field id="biz-email" label="Email">
            <Input disabled="{disabled}" id="biz-email" onChange="{(e)" type="email" value="{business.email}"> setBusiness({ ...business, email: e.target.value })}
            />
          </Field>
          <Field id="biz-phone" label="Phone / WhatsApp">
            <Input disabled="{disabled}" id="biz-phone" onChange="{(e)" value="{business.phone}"> setBusiness({ ...business, phone: e.target.value })}
            />
          </Field>
          <Field id="biz-web" label="Website">
            <Input disabled="{disabled}" id="biz-web" onChange="{(e)" value="{business.website}"> setBusiness({ ...business, website: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section hint="Drives what clients can actually book." title="Scheduling">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sch-duration" label="Session length (minutes)">
            <Input disabled="{disabled}" id="sch-duration" min="{15}" onChange="{(e)" step="{15}" type="number" value="{scheduling.durationMinutes}">
                setScheduling({ ...scheduling, durationMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field id="sch-step" label="Slot interval (minutes)">
            <Input disabled="{disabled}" id="sch-step" min="{15}" onChange="{(e)" step="{15}" type="number" value="{scheduling.slotIntervalMinutes}">
                setScheduling({ ...scheduling, slotIntervalMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field id="sch-buffer" label="Gap between sessions (minutes)">
            <Input disabled="{disabled}" id="sch-buffer" min="{0}" onChange="{(e)" step="{5}" type="number" value="{scheduling.bufferMinutes}">
                setScheduling({ ...scheduling, bufferMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field id="sch-notice" label="Minimum notice (hours)">
            <Input disabled="{disabled}" id="sch-notice" min="{0}" onChange="{(e)" type="number" value="{scheduling.minNoticeHours}">
                setScheduling({ ...scheduling, minNoticeHours: Number(e.target.value) })