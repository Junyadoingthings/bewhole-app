'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarX2, Mail } from 'lucide-react';

import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { Button } from '@/components/ui/button';
import { CheckboxRow, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { saveOpeningHours, saveSettings, sendSettingsTestEmail } from '@/app/actions/admin';
import { cn } from '@/lib/utils';
import type { AvailabilityRule, Settings } from '@/types';

/** Monday first, the way the practice reads its week. */
const WEEK = [
  { weekday: 1, label: 'Monday' },
  { weekday: 2, label: 'Tuesday' },
  { weekday: 3, label: 'Wednesday' },
  { weekday: 4, label: 'Thursday' },
  { weekday: 5, label: 'Friday' },
  { weekday: 6, label: 'Saturday' },
  { weekday: 0, label: 'Sunday' },
];

/** Every half hour from 06:00 to 21:00. */
const TIMES = Array.from({ length: 31 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

interface DayHours {
  weekday: number;
  open: boolean;
  start: string;
  end: string;
}

/** One row per weekday; a day with no active rule is closed. */
function hoursFromRules(rules: AvailabilityRule[]): DayHours[] {
  return WEEK.map(({ weekday }) => {
    const today = rules.filter((r) => r.weekday === weekday && r.mode === 'any' && !r.locationId);
    if (today.length === 0) return { weekday, open: false, start: '09:00', end: '17:00' };
    const start = today.map((r) => r.start).sort()[0];
    const end = today.map((r) => r.end).sort().at(-1) ?? '17:00';
    return { weekday, open: true, start, end };
  });
}

/**
 * The settings an administrator can change without a deploy. Every field on
 * this screen is used by the app — opening hours and booking rules decide the
 * times clients can book, the reminder switches decide which automatic emails
 * go out, and the practice and banking details are printed on receipts.
 */
export function SettingsForm({
  settings,
  rules,
  canEdit,
  emailLive,
}: {
  settings: Settings;
  rules: AvailabilityRule[];
  canEdit: boolean;
  emailLive: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const [business, setBusiness] = React.useState({
    name: settings.business.name,
    email: settings.business.email,
    phone: settings.business.phone,
    website: settings.business.website,
  });
  const [hours, setHours] = React.useState<DayHours[]>(() => hoursFromRules(rules));
  const [scheduling, setScheduling] = React.useState({
    slotIntervalMinutes: settings.scheduling.slotIntervalMinutes,
    bufferMinutes: settings.scheduling.bufferMinutes,
    minNoticeHours: settings.scheduling.minNoticeHours,
    maxAdvanceDays: settings.scheduling.maxAdvanceDays,
    cancellationWindowHours: settings.scheduling.cancellationWindowHours,
  });
  const [reminders, setReminders] = React.useState({
    dayBefore: Boolean(settings.reminders.firstReminderHours),
    dayOf: Boolean(settings.reminders.secondReminderHours),
    checkIn: Boolean(settings.reminders.followUpAfterHours),
  });
  const [cancellation, setCancellation] = React.useState(settings.policy.cancellation);
  const [banking, setBanking] = React.useState(
    settings.banking ?? {
      accountName: '',
      bank: '',
      accountNumber: '',
      branchCode: '',
      showOnInvoices: false,
    },
  );

  const disabled = !canEdit;

  function setDay(weekday: number, patch: Partial<DayHours>) {
    setHours((days) => days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  async function save() {
    // Checked before anything is sent, so a mistake here never leaves the
    // other settings saved and the hours not.
    const backwards = hours.find((d) => d.open && d.start >= d.end);
    if (backwards) {
      const day = WEEK.find((w) => w.weekday === backwards.weekday)?.label;
      toast({ tone: 'error', title: 'Could not save', description: `${day}: closing time must be after opening time.` });
      return;
    }
    setBusy(true);
    const saved = await saveSettings({
      business,
      scheduling,
      reminders,
      policy: { cancellation },
      banking,
    });
    const savedHours = saved.ok ? await saveOpeningHours(hours) : saved;
    setBusy(false);
    if (!savedHours.ok) {
      toast({ tone: 'error', title: 'Could not save', description: savedHours.error });
      return;
    }
    toast({ tone: 'success', title: 'Settings saved', description: 'Changes apply immediately.' });
    router.refresh();
  }

  async function testEmail() {
    setTesting(true);
    const result = await sendSettingsTestEmail();
    setTesting(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Test email not sent', description: result.error });
      return;
    }
    toast({
      tone: 'success',
      title: 'Test email sent',
      description: `Check the inbox for ${settings.business.email}. It also appears under Notifications.`,
    });
    router.refresh();
  }

  const openDays = hours.filter((d) => d.open).length;

  return (
    <div className="space-y-6">
      <Section
        title="Opening hours"
        hint="The days and times clients can book. Changes show on the booking page straight away."
      >
        <div className="divide-y divide-line-soft rounded-2xl border border-line">
          {WEEK.map(({ weekday, label }) => {
            const day = hours.find((d) => d.weekday === weekday)!;
            const bad = day.open && day.start >= day.end;
            return (
              <div
                key={weekday}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap"
              >
                <label className="flex min-w-[9.5rem] cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={day.open}
                    disabled={disabled}
                    onChange={(e) => setDay(weekday, { open: e.target.checked })}
                    className="h-4 w-4 accent-forest-700"
                    aria-label={`Open on ${label}`}
                  />
                  <span className="text-sm font-medium text-ink">{label}</span>
                </label>
                {day.open ? (
                  <div className="flex items-center gap-2">
                    <TimeSelect
                      value={day.start}
                      disabled={disabled}
                      label={`${label} opening time`}
                      invalid={bad}
                      onChange={(start) => setDay(weekday, { start })}
                    />
                    <span className="text-sm text-ink-faint">to</span>
                    <TimeSelect
                      value={day.end}
                      disabled={disabled}
                      label={`${label} closing time`}
                      invalid={bad}
                      onChange={(end) => setDay(weekday, { end })}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-ink-faint">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        {openDays === 0 && (
          <p className="mt-3 text-sm text-state-danger">
            Every day is closed, so clients will not be able to book any session.
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
          <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
          <span>
            Closed for a single day, a public holiday or leave? Block it in the{' '}
            <Link
              href="/admin/calendar"
              className="font-medium text-forest-700 underline-offset-4 hover:underline dark:text-forest-300"
            >
              Calendar
            </Link>{' '}
            instead of changing your weekly hours.
          </span>
        </p>
      </Section>

      <Section title="Booking rules" hint="How far ahead, and how close to the time, clients can book.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Minimum notice (hours)"
            id="sch-notice"
            help="A client cannot book a session starting sooner than this."
          >
            <Input
              id="sch-notice"
              type="number"
              min={0}
              value={scheduling.minNoticeHours}
              disabled={disabled}
              onChange={(e) => setScheduling({ ...scheduling, minNoticeHours: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Book up to (days ahead)"
            id="sch-horizon"
            help="How far into the future the booking calendar goes."
          >
            <Input
              id="sch-horizon"
              type="number"
              min={7}
              value={scheduling.maxAdvanceDays}
              disabled={disabled}
              onChange={(e) => setScheduling({ ...scheduling, maxAdvanceDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Break between sessions (minutes)" id="sch-buffer" help="Kept free after every session.">
            <Input
              id="sch-buffer"
              type="number"
              min={0}
              step={5}
              value={scheduling.bufferMinutes}
              disabled={disabled}
              onChange={(e) => setScheduling({ ...scheduling, bufferMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Start times offered every" id="sch-step" help="How the available times are spaced out.">
            <Select
              id="sch-step"
              value={scheduling.slotIntervalMinutes}
              disabled={disabled}
              onChange={(e) => setScheduling({ ...scheduling, slotIntervalMinutes: Number(e.target.value) })}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </Select>
          </Field>
          <Field
            label="Free cancellation up to (hours before)"
            id="sch-cancel"
            help="Clients can cancel or reschedule themselves until this point."
          >
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

      <Section title="Automatic emails" hint="Sent to clients for confirmed sessions only.">
        <div className="space-y-3">
          <CheckboxRow
            id="rem-day-before"
            checked={reminders.dayBefore}
            onChange={(v) => !disabled && setReminders({ ...reminders, dayBefore: v })}
            title="Reminder the day before"
            description="Sent at 06:00 the day before the session, with the session link or address."
          />
          <CheckboxRow
            id="rem-day-of"
            checked={reminders.dayOf}
            onChange={(v) => !disabled && setReminders({ ...reminders, dayOf: v })}
            title="Reminder on the day"
            description="Sent at 06:00 on the morning of the session."
          />
          <CheckboxRow
            id="rem-check-in"
            checked={reminders.checkIn}
            onChange={(v) => !disabled && setReminders({ ...reminders, checkIn: v })}
            title="Thank-you email after the session"
            description="Sent at 06:00 the morning after, inviting the client to book again."
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Booking confirmations and medical aid outcomes are always sent. Switching a reminder off
          applies to sessions confirmed from now on.
        </p>
      </Section>

      <Section title="Practice details" hint="Printed on receipts. The test email below goes to this email address.">
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
          <Field label="Phone" id="biz-phone">
            <Input
              id="biz-phone"
              type="tel"
              value={business.phone}
              disabled={disabled}
              placeholder="063 883 7170"
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

      <Section title="Cancellation policy" hint="Shown to a client before they cancel a session.">
        <Textarea
          rows={4}
          value={cancellation}
          disabled={disabled}
          onChange={(e) => setCancellation(e.target.value)}
          aria-label="Cancellation policy"
        />
      </Section>

      <Section
        title="Banking details"
        hint="For receipts only — card payments are paid out to the account registered with your payment provider."
      >
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
              onChange={(e) => setBanking({ ...banking, accountNumber: e.target.value.replace(/\s/g, '') })}
            />
          </Field>
          <Field label="Branch code" id="bank-branch">
            <Input
              id="bank-branch"
              value={banking.branchCode}
              disabled={disabled}
              inputMode="numeric"
              placeholder="250655"
              onChange={(e) => setBanking({ ...banking, branchCode: e.target.value.replace(/\s/g, '') })}
            />
          </Field>
        </div>

        <div className="mt-4">
          <CheckboxRow
            id="bank-show"
            checked={banking.showOnInvoices}
            onChange={(v) => !disabled && setBanking({ ...banking, showOnInvoices: v })}
            title="Print these details on receipts"
            description="Leave off unless you want clients to be able to pay by direct EFT."
          />
        </div>
      </Section>

      {canEdit && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button onClick={save} loading={busy} loadingText="Saving…" size="lg" className="shadow-float">
            Save settings
          </Button>
        </div>
      )}

      <Section
        title="Connections"
        hint="Set up on the server. Shown here so you can see that everything is working."
      >
        <div className="space-y-2">
          <StatusRow
            name="Emails to clients"
            detail={emailLive ? 'Sent from the website' : 'Not set up — emails are recorded but not sent'}
            live={emailLive}
          />
          <StatusRow
            name="Card payments"
            detail={
              settings.payments.provider === 'peach'
                ? 'Peach Payments'
                : settings.payments.provider === 'payfast'
                  ? 'Payfast'
                  : 'Not set up'
            }
            live={settings.payments.provider !== 'mock'}
          />
          <StatusRow
            name="Google Calendar"
            detail={settings.calendar.connected ? settings.calendar.calendarId : 'Not connected'}
            live={settings.calendar.connected}
          />
        </div>

        {canEdit && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-cream-50 p-4 dark:bg-canvas">
            <Mail className="h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
            <p className="min-w-0 flex-1 text-sm text-ink-muted">
              Send a test email to{' '}
              <span className="font-medium text-ink">{settings.business.email}</span> to check that
              emails are arriving.
            </p>
            <Button size="sm" variant="secondary" onClick={testEmail} loading={testing} loadingText="Sending…">
              Send test email
            </Button>
          </div>
        )}
      </Section>

      <ChangePasswordForm />
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
  disabled,
  label,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
  invalid: boolean;
}) {
  // A saved time that is not on the half hour still shows as itself.
  const options = TIMES.includes(value) ? TIMES : [...TIMES, value].sort();
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-10 rounded-xl border bg-white px-3 text-sm tabular text-ink focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:opacity-60',
        invalid ? 'border-state-danger/60' : 'border-line',
      )}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
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
  help,
  children,
}: {
  label: string;
  id: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{help}</p>}
    </div>
  );
}

function StatusRow({ name, detail, live }: { name: string; detail: string; live: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-faint">{detail}</p>
      </div>
      <Badge tone={live ? 'success' : 'warning'} size="sm">
        {live ? 'Working' : 'Not set up'}
      </Badge>
    </div>
  );
}
