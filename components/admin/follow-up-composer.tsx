'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CheckboxRow, FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { createFollowUp } from '@/app/actions/follow-ups';
import { addISODays, today } from '@/lib/date';
import type { Location, Service } from '@/types';

/**
 * "+ Follow-up" — the workflow the practice asked for.
 *
 * Recording one schedules the reminder, sends the payment request on the
 * reminder date, and on payment creates and confirms the appointment.
 */
export function FollowUpComposer({
  services,
  locations,
  clients,
  defaultClientUserId,
  sourceAppointmentId,
  triggerLabel = 'Create follow-up',
  variant = 'primary',
}: {
  services: Service[];
  locations: Location[];
  clients: { id: string; name: string }[];
  defaultClientUserId?: string;
  sourceAppointmentId?: string;
  triggerLabel?: string;
  variant?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [clientUserId, setClientUserId] = React.useState(defaultClientUserId ?? clients[0]?.id ?? '');
  const [serviceId, setServiceId] = React.useState(services[0]?.id ?? '');
  const [dueDate, setDueDate] = React.useState(addISODays(today(), 14));
  const [preferredTime, setPreferredTime] = React.useState('10:00');
  const [mode, setMode] = React.useState<'online' | 'in_person'>('online');
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? '');
  const [paymentRequired, setPaymentRequired] = React.useState(true);
  const [amountRands, setAmountRands] = React.useState('700');
  const [reminderDate, setReminderDate] = React.useState(addISODays(today(), 7));
  const [channel, setChannel] = React.useState<'email' | 'whatsapp' | 'sms'>('whatsapp');
  const [notes, setNotes] = React.useState('');

  const service = services.find((s) => s.id === serviceId);

  // Default the amount to the published rate for the chosen service and format.
  React.useEffect(() => {
    if (!service || service.requiresQuote || service.rateBand === 'free') return;
    const cents = mode === 'online' ? service.priceOnlineCents : service.priceInPersonCents;
    setAmountRands(String(cents / 100));
  }, [service, mode]);

  async function save() {
    setBusy(true);
    setErrors({});
    const result = await createFollowUp({
      clientUserId,
      serviceId,
      dueDate,
      preferredTime,
      mode,
      locationId: mode === 'in_person' ? locationId : null,
      paymentRequired,
      amountRands: Number(amountRands || 0),
      reminderDate,
      channel,
      notes: notes || undefined,
      sourceAppointmentId: sourceAppointmentId ?? null,
    });
    setBusy(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast({ tone: 'error', title: 'Could not create follow-up', description: result.error });
      return;
    }

    setOpen(false);
    setNotes('');
    toast({
      tone: 'success',
      title: 'Follow-up created',
      description: paymentRequired
        ? 'A payment request goes out on the reminder date.'
        : 'A reminder goes out on the reminder date.',
    });
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a follow-up"
        description="We'll remind the client, request payment if one is due, and confirm the booking automatically once it clears."
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button full onClick={save} loading={busy} loadingText="Creating…">
              Create follow-up
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {!defaultClientUserId && (
            <div>
              <Label htmlFor="fu-client">Client</Label>
              <Select
                id="fu-client"
                value={clientUserId}
                onChange={(e) => setClientUserId(e.target.value)}
                error={errors.clientUserId}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.clientUserId}</FieldError>
            </div>
          )}

          <div>
            <Label htmlFor="fu-service">Service</Label>
            <Select id="fu-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fu-date">Follow-up date</Label>
              <Input
                id="fu-date"
                type="date"
                min={today()}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                error={errors.dueDate}
              />
              <FieldError>{errors.dueDate}</FieldError>
            </div>
            <div>
              <Label htmlFor="fu-time">Preferred time</Label>
              <Input
                id="fu-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fu-mode">Format</Label>
              <Select
                id="fu-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'online' | 'in_person')}
              >
                <option value="online">Online</option>
                <option value="in_person">In person</option>
              </Select>
            </div>
            {mode === 'in_person' && (
              <div>
                <Label htmlFor="fu-location">Practice</Label>
                <Select
                  id="fu-location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <CheckboxRow
            id="fu-payment"
            checked={paymentRequired}
            onChange={setPaymentRequired}
            title="Payment required before confirming"
            description="The client receives a secure payment link. The booking is confirmed the moment it clears."
          />

          {paymentRequired && (
            <div>
              <Label htmlFor="fu-amount">Amount</Label>
              <Input
                id="fu-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={10}
                value={amountRands}
                onChange={(e) => setAmountRands(e.target.value)}
                icon={<span className="text-sm">R</span>}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fu-reminder" hint="On or before the follow-up date">
                Remind on
              </Label>
              <Input
                id="fu-reminder"
                type="date"
                min={today()}
                max={dueDate}
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                error={errors.reminderDate}
              />
              <FieldError>{errors.reminderDate}</FieldError>
            </div>
            <div>
              <Label htmlFor="fu-channel">Send by</Label>
              <Select
                id="fu-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="fu-notes" optional>
              Note for the client
            </Label>
            <Textarea
              id="fu-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Included in the message they receive."
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
