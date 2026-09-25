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
      <Section title="Practice details" hint="Shown to clients across the site and in messages.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Practice name" id="biz-name">
            <Input
              id="biz-name"
              value={business.name}
              disabled={disabled}
              onChange={(e) => setBusiness({ ...business, name: e.target.value })}
            />
          </Field>
          <Field label="Email" id="biz-email">
            <Input
              id="biz-email"
              type="email"
              value={business.email}
              disabled={disabled}
              onChange={(e) => setBusiness({ ...business, email: e.target.value })}
            />
          </Field>
          <Field label="Phone / WhatsApp" id="biz-phone">
            <Input
              id="biz-phone"
              value={business.phone}
              disabled={disabled}
              onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
            />
          </Field>
          <Field label="Website" id="biz-web">
            <Input
              id="biz-web"
              value={business.website}
              disabled={disabled}
              onChange={(e) => setBusiness({ ...business, website: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Scheduling" hint="Drives what clients can actually book.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Session length (minutes)" id="sch-duration">
            <Input
              id="sch-duration"
              type="number"
              min={15}
              step={15}
              value={scheduling.durationMinutes}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, durationMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Slot interval (minutes)" id="sch-step">
            <Input
              id="sch-step"
              type="number"
              min={15}
              step={15}
              value={scheduling.slotIntervalMinutes}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, slotIntervalMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Gap between sessions (minutes)" id="sch-buffer">
            <Input
              id="sch-buffer"
              type="number"
              min={0}
              step={5}
              value={scheduling.bufferMinutes}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, bufferMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Minimum notice (hours)" id="sch-notice">
            <Input
              id="sch-notice"
              type="number"
              min={0}
              value={scheduling.minNoticeHours}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, minNoticeHours: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Book up to (days ahead)" id="sch-horizon">
            <Input
              id="sch-horizon"
              type="number"
              min={7}
              value={scheduling.maxAdvanceDays}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, maxAdvanceDays: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Cancellation window (hours)" id="sch-cancel">
            <Input
              id="sch-cancel"
              type="number"
              min={0}
              value={scheduling.cancellationWindowHours}
              disabled={disabled}
              onChange={(e) =>
                setScheduling({ ...scheduling, cancellationWindowHours: Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Reminders" hint="When automated messages go out.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First reminder (hours before)" id="rem-first">
            <Input
              id="rem-first"
              type="number"
              min={1}
              value={reminders.firstReminderHours}
              disabled={disabled}
              onChange={(e) =>
                setReminders({ ...reminders, firstReminderHours: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Second reminder (hours before)" id="rem-second">
            <Input
              id="rem-second"
              type="number"
              min={0}
              value={reminders.secondReminderHours ?? 0}
              disabled={disabled}
              onChange={(e) =>
                setReminders({
                  ...reminders,
                  secondReminderHours: Number(e.target.value) || null,
                })
              }
            />
          </Field>
          <Field label="Follow-up (hours after)" id="rem-after">
            <Input
              id="rem-after"
              type="number"
              min={0}
              value={reminders.followUpAfterHours}
              disabled={disabled}
              onChange={(e) =>
                setReminders({ ...reminders, followUpAfterHours: Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Payments" hint="How and when money is taken.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Medical aid co-payment (R, in person)" id="pay-copay">
            <Input
              id="pay-copay"
              type="number"
              min={0}
              step={10}
              value={payments.medicalAidCoPaymentCents / 100}
              disabled={disabled}
              onChange={(e) =>
                setPayments({
                  ...payments,
                  medicalAidCoPaymentCents: Math.round(Number(e.target.value) * 100),
                })
              }
            />
          </Field>
          <Field label="Provider" id="pay-provider">
            <Select id="pay-provider" value={payments.provider} disabled>
              <option value="peach">Peach Payments</option>
              <option value="payfast">Payfast</option>
              <option value="mock">Mock (development)</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 space-y-3">
          <CheckboxRow
            id="pay-medaid"
            checked={payments.medicalAidEnabled}
            onChange={(v) => !disabled && setPayments({ ...payments, medicalAidEnabled: v })}
            title="Accept medical aid"
            description="Shows medical aid as a payment option in the booking flow."
          />
          <CheckboxRow
            id="pay-require"
            checked={payments.requirePaymentToConfirm}
            onChange={(v) => !disabled && setPayments({ ...payments, requirePaymentToConfirm: v })}
            title="Payment confirms the booking"
            description="With this off, sessions are confirmed on booking and invoiced separately."
          />
        </div>
      </Section>

      <Section title="Cancellation policy" hint="Shown before any client cancels.">
        <Textarea
          rows={4}
          value={policy.cancellation}
          disabled={disabled}
          onChange={(e) => setPolicy({ ...policy, cancellation: e.target.value })}
          aria-label="Cancellation policy"
        />
        <div className="mt-4 max-w-xs">
          <Field label="Minimum client age" id="pol-age">
            <Input
              id="pol-age"
              type="number"
              min={0}
              value={policy.minimumAge}
              disabled={disabled}
              onChange={(e) => setPolicy({ ...policy, minimumAge: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Banking details"
        hint="For receipts and invoices only — card payments settle to the account registered with your gateway."
      >
        <div className="mb-5 rounded-2xl border border-state-infoSoft bg-state-infoSoft/60 p-4 text-sm leading-relaxed text-ink-muted">
          Card, Apple Pay and Google Pay money is paid out by your payment gateway to the bank
          account you registered with them during FICA verification. Changing anything here does
          <strong className="font-medium text-ink"> not</strong> change where that money goes — to
          change the settlement account, update it in the gateway&rsquo;s own dashboard.
          <br />
          <br />
          These details are used only to print your banking information on receipts and invoices,
          for clients who want to pay by direct EFT.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder" id="bank-name">
            <Input
              id="bank-name"
              value={banking.accountName}
              disabled={disabled}
              placeholder="Be Whole Care"
              onChange={(e) => setBanking({ ...banking, accountName: e.target.value })}
            />
          </Field>
          <Field label="Bank" id="bank-bank">
            <Input
              id="bank-bank"
              value={banking.bank}
              disabled={disabled}
              placeholder="FNB"
              onChange={(e) => setBanking({ ...banking, bank: e.target.value })}
            />
          </Field>
          <Field label="Account number" id="bank-account">
            <Input
              id="bank-account"
              value={banking.accountNumber}
              disabled={disabled}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => setBanking({ ...banking, accountNumber: e.target.value })}
            />
          </Field>
          <Field label="Branch code" id="bank-branch">
            <Input
              id="bank-branch"
              value={banking.branchCode}
              disabled={disabled}
              inputMode="numeric"
              placeholder="250655"
              onChange={(e) => setBanking({ ...banking, branchCode: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-4">
          <CheckboxRow
            id="bank-show"
            checked={banking.showOnInvoices}
            onChange={(v) => !disabled && setBanking({ ...banking, showOnInvoices: v })}
            title="Print these details on receipts and invoices"
            description="Leave off unless you want clients to be able to pay by direct EFT."
          />
        </div>
      </Section>

      <Section title="Integrations" hint="Configured with environment variables, never in the browser.">
        <div className="space-y-2">
          <IntegrationRow
            name="Payments"
            detail={
              settings.payments.provider === 'peach'
                ? 'Peach Payments — Apple Pay, Google Pay, cards, PayShap'
                : settings.payments.provider === 'payfast'
                  ? 'Payfast — Apple Pay, cards, Instant EFT, SnapScan'
                  : 'Mock provider (development)'
            }
            live={settings.payments.provider !== 'mock'}
          />
          <IntegrationRow
            name="Calendar"
            detail={`${settings.calendar.provider === 'google' ? 'Google Calendar' : 'Mock calendar'} · ${settings.calendar.calendarId}`}
            live={settings.calendar.connected}
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Secret keys live in environment variables on the server. They are never sent to the
          browser and cannot be read or set from this screen.
        </p>
      </Section>

      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={save} loading={busy} loadingText="Saving…" size="lg" className="shadow-float">
            Save settings
          </Button>
        </div>
      )}

      <ChangePasswordForm />
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function IntegrationRow({
  name,
  detail,
  live,
}: {
  name: string;
  detail: string;
  live: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-faint">{detail}</p>
      </div>
      <Badge tone={live ? 'success' : 'warning'} size="sm">
        {live ? 'Connected' : 'Not configured'}
      </Badge>
    </div>
  );
}
