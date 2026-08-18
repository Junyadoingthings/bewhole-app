'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarClock, CreditCard, XCircle } from 'lucide-react';

import { BookingCalendar } from '@/components/booking/calendar';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cancelBooking, rescheduleBooking, startPayment } from '@/app/actions/booking';
import { displayTime, formatFullDate } from '@/lib/date';
import { cn, money } from '@/lib/utils';
import type { TimeSlot } from '@/types';

interface Props {
  appointmentId: string;
  serviceId: string;
  mode: 'online' | 'in_person';
  locationId: string | null;
  amountCents: number;
  needsPayment: boolean;
  canModify: boolean;
  policy: { withinPolicy: boolean; hoursNotice: number; windowHours: number; message: string } | null;
}

export function AppointmentActions({
  appointmentId,
  serviceId,
  mode,
  locationId,
  amountCents,
  needsPayment,
  canModify,
  policy,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [payOpen, setPayOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [date, setDate] = React.useState<string | null>(null);
  const [time, setTime] = React.useState<string | null>(null);
  const [slots, setSlots] = React.useState<TimeSlot[] | null>(null);
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlots(null);
    const params = new URLSearchParams({ serviceId, mode, date });
    if (mode === 'in_person' && locationId) params.set('locationId', locationId);
    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((d: { slots?: TimeSlot[] }) => !cancelled && setSlots(d.slots ?? []))
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, mode, locationId]);

  async function pay() {
    setBusy(true);
    const result = await startPayment(appointmentId);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setBusy(false);
    toast({ tone: 'error', title: 'Could not start payment', description: result.error });
  }

  async function move() {
    if (!date || !time) return;
    setBusy(true);
    const result = await rescheduleBooking({ appointmentId, date, time });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not reschedule', description: result.error });
      return;
    }
    setMoveOpen(false);
    toast({ tone: 'success', title: 'Your session has been moved', description: 'We’ve sent an updated confirmation.' });
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    const result = await cancelBooking({ appointmentId, reason: reason || undefined });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not cancel', description: result.error });
      return;
    }
    setCancelOpen(false);
    toast({ tone: 'success', title: 'Appointment cancelled', description: 'The time has been released.' });
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {needsPayment && (
          <Button onClick={() => setPayOpen(true)}>
            <CreditCard className="h-4 w-4" />
            Pay {money(amountCents)}
          </Button>
        )}
        {canModify && (
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Reschedule
            </Button>
            <Button variant="dangerQuiet" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Payment */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Complete your payment"
        description={`${money(amountCents)} confirms this session. You'll be taken to a secure checkout — we never see or store your card details.`}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setPayOpen(false)} disabled={busy}>
              Not now
            </Button>
            <Button full onClick={pay} loading={busy} loadingText="Opening checkout…">
              Continue to payment
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          Your time stays held while you decide. If a payment doesn’t go through, nothing is
          charged and you can try again.
        </p>
      </Modal>

      {/* Reschedule */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move your session"
        description="Pick a new date and time. Your payment and everything else carries across."
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setMoveOpen(false)} disabled={busy}>
              Keep current time
            </Button>
            <Button full onClick={move} disabled={!date || !time || busy} loading={busy} loadingText="Moving…">
              Confirm new time
            </Button>
          </div>
        }
      >
        <BookingCalendar
          serviceId={serviceId}
          mode={mode}
          locationId={locationId}
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setTime(null);
          }}
        />

        {date && (
          <div className="mt-5">
            <p className="text-sm font-medium text-ink">{formatFullDate(date)}</p>
            {slots === null ? (
              <p className="mt-3 text-sm text-ink-soft">Loading times…</p>
            ) : slots.filter((s) => s.available).length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                Nothing open that day. Try another date.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots
                  .filter((s) => s.available)
                  .map((slot) => (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() => setTime(slot.label)}
                      className={cn(
                        'h-11 rounded-xl border text-sm tabular transition-all duration-200',
                        time === slot.label
                          ? 'border-forest-800 bg-forest-800 text-cream-100'
                          : 'border-line bg-white text-ink hover:border-forest-300',
                      )}
                    >
                      {displayTime(slot.label)}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancellation — the policy is always shown before anything happens. */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this appointment?"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setCancelOpen(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" full onClick={cancel} loading={busy} loadingText="Cancelling…">
              Yes, cancel
            </Button>
          </div>
        }
      >
        {policy && !policy.withinPolicy && (
          <div className="mb-5 rounded-2xl border border-state-warning/30 bg-state-warningSoft p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <AlertTriangle className="h-4 w-4 text-state-warning" />
              This is inside the {policy.windowHours}-hour window
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{policy.message}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Your session is in about {policy.hoursNotice} hours. If something genuinely urgent has
              come up, please tell us below or call the practice — exceptions are considered.
            </p>
          </div>
        )}

        {policy?.withinPolicy && (
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">{policy.message}</p>
        )}

        <label htmlFor="cancel-reason" className="text-sm font-medium text-ink">
          Anything you’d like us to know? <span className="font-normal text-ink-faint">Optional</span>
        </label>
        <Textarea
          id="cancel-reason"
          className="mt-2"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="You don’t have to give a reason."
          data-autofocus
        />
      </Modal>
    </>
  );
}
