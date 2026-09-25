'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock,
  CreditCard,
  MapPin,
  ShieldCheck,
  Video,
} from 'lucide-react';

import { BookingCalendar } from '@/components/booking/calendar';
import { ConsentForm, isConsentComplete } from '@/components/consent/consent-form';
import { PaymentMethods } from '@/components/booking/payment-methods';
import { EmbeddedCheckout } from '@/components/booking/embedded-checkout';
import { ServiceIcon } from '@/components/site/service-icon';
import { Button } from '@/components/ui/button';
import { CheckboxRow, FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { OptionCard } from '@/components/ui/field';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { startEmbeddedPayment, submitBooking } from '@/app/actions/booking';
import { displayTime, formatFullDate, relativeDay } from '@/lib/date';
import { cn, money } from '@/lib/utils';
import { bookingDetailsSchema, fieldErrors, medicalAidSchema } from '@/lib/validation';
import type { Location, Service, ServiceCategory, SessionUser, TimeSlot } from '@/types';
import type { PaymentMethodMark } from '@/services/payments/types';
import type { ZodTypeAny } from 'zod';

interface WizardProps {
  categories: ServiceCategory[];
  services: Service[];
  locations: Location[];
  user: SessionUser | null;
  profile: { phone?: string | null } | null;
  medicalAidCoPaymentCents: number;
  acceptedMethods: PaymentMethodMark[];
  supportsEmbedded: boolean;
  paymentProvider: string;
  prefill: { serviceId?: string; categorySlug?: string };
}

type StepId =
  | 'concern'
  | 'service'
  | 'mode'
  | 'location'
  | 'date'
  | 'time'
  | 'details'
  | 'consent'
  | 'payment'
  | 'checkout';

const CONCERNS = [
  { id: 'stress', label: 'Stress & burnout' },
  { id: 'emotional-wellbeing', label: 'How I’ve been feeling' },
  { id: 'relationships', label: 'My relationship' },
  { id: 'family', label: 'My family' },
  { id: 'trauma', label: 'Trauma & healing' },
  { id: 'work', label: 'Work' },
  { id: 'career', label: 'Career direction' },
  { id: 'personal-growth', label: 'Personal growth' },
  { id: 'assessment', label: 'Testing & assessment' },
];

const PRACTICE_PHONE = '063 883 7170';

/**
 * Every field that can carry an error, in on-screen order, mapped from its
 * error key (the same dotted path the server reports) to the element to focus.
 */
const FIELD_ORDER: readonly (readonly [errorKey: string, elementId: string])[] = [
  ['firstName', 'firstName'],
  ['lastName', 'lastName'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['address', 'address'],
  ['emergencyName', 'emergencyName'],
  ['emergencyPhone', 'emergencyPhone'],
  ['reason', 'reason'],
  ['consentAge', 'consentAge'],
  ['consentTerms', 'consentTerms'],
  ['medicalAid.scheme', 'scheme'],
  ['medicalAid.memberNumber', 'memberNumber'],
  ['medicalAid.dateOfBirth', 'dateOfBirth'],
  ['medicalAid.mainMember', 'mainMember'],
  ['medicalAid.mainMemberId', 'mainMemberId'],
];

/** Which step owns a field, for routing a server-side rejection back to it. */
function stepForErrorKey(key: string): StepId | null {
  if (key.startsWith('medicalAid')) return 'payment';
  switch (key) {
    case 'serviceId':
      return 'service';
    case 'mode':
      return 'mode';
    case 'locationId':
      return 'location';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'clinicalConsent':
      return 'consent';
    default:
      return key in bookingDetailsSchema.shape ? 'details' : null;
  }
}

/** Run a schema and return its failures keyed by field, or {} when valid. */
function issuesOf(schema: ZodTypeAny, value: unknown, prefix = ''): Record<string, string> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(fieldErrors(result.error))) {
    out[`${prefix}${key}`] = message;
  }
  return out;
}

/**
 * How long the booking request may take before the client is told so.
 *
 * A try/catch alone cannot end a request that never finishes — it only fires
 * when one fails. The server answers in well under a second; past this,
 * something is wrong, and the client hears about it instead of waiting forever.
 */
const SUBMIT_DEADLINE_MS = 45_000;

class BookingDeadlineError extends Error {
  constructor() {
    super('Booking request exceeded its deadline');
    this.name = 'BookingDeadlineError';
  }
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BookingDeadlineError()), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** Words a client can act on, for a booking request that threw. */
function describeSubmitFailure(error: unknown): string {
  if (error instanceof BookingDeadlineError) {
    return (
      'This is taking much longer than it should. Before trying again, please check your ' +
      'email — if a message from us has arrived, your time is already held. If not, try ' +
      `again, or call or WhatsApp us on ${PRACTICE_PHONE}.`
    );
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Please check your connection and try again.';
  }
  const message = error instanceof Error ? error.message : '';
  // A tab opened before a site update calls server code that no longer exists.
  if (/server action|unexpected response/i.test(message)) {
    return 'This page was updated while you had it open. Please refresh the page and book again.';
  }
  return (
    'We could not complete your booking just now. Please try again — if it keeps happening, ' +
    `call or WhatsApp us on ${PRACTICE_PHONE}.`
  );
}

export function BookingWizard({
  categories,
  services,
  locations,
  user,
  profile,
  medicalAidCoPaymentCents,
  acceptedMethods,
  supportsEmbedded,
  paymentProvider,
  prefill,
}: WizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  const prefilledService = prefill.serviceId
    ? services.find((s) => s.id === prefill.serviceId || s.slug === prefill.serviceId)
    : undefined;
  const prefilledCategory = prefill.categorySlug
    ? categories.find((c) => c.slug === prefill.categorySlug)
    : undefined;

  const [concern, setConcern] = React.useState<string | null>(null);
  const [serviceId, setServiceId] = React.useState<string | null>(prefilledService?.id ?? null);
  const [mode, setMode] = React.useState<'online' | 'in_person' | null>(null);
  const [locationId, setLocationId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<string | null>(null);
  const [time, setTime] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<'card' | 'medical_aid'>('card');

  const [details, setDetails] = React.useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: profile?.phone ?? '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    reason: '',
    isFirstSession: true,
  });
  const [medicalAid, setMedicalAid] = React.useState({
    scheme: '',
    memberNumber: '',
    mainMember: '',
    mainMemberId: '',
    dateOfBirth: '',
  });
  const [consentTerms, setConsentTerms] = React.useState(false);
  const [consentAge, setConsentAge] = React.useState(false);
  const [clinicalConsent, setClinicalConsent] = React.useState<Record<string, boolean>>({});

  const [slots, setSlots] = React.useState<TimeSlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  /** Errors the server reported on the last submit. */
  const [serverErrors, setServerErrors] = React.useState<Record<string, string>>({});
  /**
   * Whether a step's field errors are on show: off until the client first
   * tries to move on, then live, so each error clears as its field is fixed.
   */
  const [revealed, setRevealed] = React.useState({ details: false, payment: false });
  /** Synchronous double-submit guard; two taps in one render both see `submitting` false. */
  const submitLock = React.useRef(false);
  /** Set once the server has created the booking on this page. */
  const bookedReference = React.useRef<string | null>(null);
  const formErrorRef = React.useRef<HTMLParagraphElement>(null);
  const [embedded, setEmbedded] = React.useState<{
    checkoutId: string;
    scriptUrl: string;
    brands: string;
    resultUrl: string;
  } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const location = locations.find((l) => l.id === locationId) ?? null;
  const category = service ? categories.find((c) => c.id === service.categoryId) ?? null : null;

  /**
   * The payment method that actually applies. A free or quoted service shows no
   * payment choice, but an earlier "medical aid" pick survives in state — and
   * would demand scheme details from fields no longer on screen. Nothing is
   * charged for these services, so they always go through as 'card'.
   */
  const noCharge = Boolean(service?.requiresQuote || service?.rateBand === 'free');
  const effectivePaymentMethod = noCharge ? 'card' : paymentMethod;
  const usingMedicalAid = effectivePaymentMethod === 'medical_aid';

  const steps = React.useMemo<StepId[]>(() => {
    const base: StepId[] = ['service'];
    base.push('mode');
    if (mode === 'in_person') base.push('location');
    base.push('date', 'time', 'details', 'consent', 'payment');
    if (supportsEmbedded) base.push('checkout');
    return base;
  }, [mode, supportsEmbedded]);

  const [stepIndex, setStepIndex] = React.useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  React.useEffect(() => {
    if (prefilledCategory && prefilledCategory.concerns[0]) setConcern(prefilledCategory.concerns[0]);
  }, [prefilledCategory]);

  const visibleServices = React.useMemo(() => {
    if (prefilledCategory) return services.filter((s) => s.categoryId === prefilledCategory.id);
    if (!concern) return services;
    const ids = new Set(categories.filter((c) => c.concerns.includes(concern)).map((c) => c.id));
    const filtered = services.filter((s) => ids.has(s.categoryId));
    return filtered.length ? filtered : services;
  }, [categories, services, concern, prefilledCategory]);

  const amountCents = React.useMemo(() => {
    if (!service || !mode) return 0;
    if (service.rateBand === 'free' || service.requiresQuote) return 0;
    if (effectivePaymentMethod === 'medical_aid') {
      return mode === 'in_person' ? medicalAidCoPaymentCents : 0;
    }
    return mode === 'online' ? service.priceOnlineCents : service.priceInPersonCents;
  }, [service, mode, effectivePaymentMethod, medicalAidCoPaymentCents]);

  // What is taken at booking. A medical aid booking is never charged here — the
  // co-payment is collected once the scheme is checked (see priceSession).
  const chargeNowCents = usingMedicalAid ? 0 : amountCents;

  /**
   * The same schemas the server applies, run live, so passing a step here means
   * the server cannot later reject it for these fields — a rejection that used
   * to surface only on the payment step, naming fields no longer on screen.
   */
  const detailsIssues = React.useMemo(
    () => issuesOf(bookingDetailsSchema, { ...details, consentTerms, consentAge }),
    [details, consentTerms, consentAge],
  );
  const medicalAidIssues = React.useMemo(
    () => (usingMedicalAid ? issuesOf(medicalAidSchema, medicalAid, 'medicalAid.') : {}),
    [usingMedicalAid, medicalAid],
  );

  const errors = React.useMemo<Record<string, string>>(
    () => ({
      ...serverErrors,
      ...(revealed.details ? detailsIssues : {}),
      ...(revealed.payment ? medicalAidIssues : {}),
    }),
    [serverErrors, revealed, detailsIssues, medicalAidIssues],
  );

  // An edit supersedes what the server said about the previous values.
  React.useEffect(() => {
    setServerErrors((current) => (Object.keys(current).length ? {} : current));
    setFormError(null);
  }, [details, medicalAid, consentTerms, consentAge, paymentMethod]);

  React.useEffect(() => {
    if (!date || !service || !mode) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlots(null);

    const params = new URLSearchParams({ serviceId: service.id, mode, date });
    if (mode === 'in_person' && locationId) params.set('locationId', locationId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots?: TimeSlot[] }) => !cancelled && setSlots(data.slots ?? []))
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setLoadingSlots(false));

    return () => {
      cancelled = true;
    };
  }, [date, service, mode, locationId]);

  const canAdvance = React.useMemo(() => {
    switch (step) {
      case 'concern':
        return true;
      case 'service':
        return Boolean(serviceId);
      case 'mode':
        return Boolean(mode);
      case 'location':
        return Boolean(locationId);
      case 'date':
        return Boolean(date);
      case 'time':
        return Boolean(time);
      case 'details':
        // Always pressable: pressing it is what reveals the fields still to fix.
        return true;
      case 'consent':
        return isConsentComplete(clinicalConsent);
      case 'payment':
        // As with details: validated when pressed, so the reason is shown.
        return true;
      case 'checkout':
        return false;
      default:
        return false;
    }
  }, [step, serviceId, mode, locationId, date, time, clinicalConsent]);

  /** Issues that must be fixed before leaving a step. */
  function blockingIssues(forStep: StepId): Record<string, string> {
    if (forStep === 'details') return detailsIssues;
    if (forStep === 'payment') return medicalAidIssues;
    return {};
  }

  /** Focus the first field with an error, polling while its step animates in. */
  function focusFirstError(issues: Record<string, string>) {
    const target = FIELD_ORDER.find(([key]) => issues[key]);
    if (!target) return;
    const elementId = target[1];
    const started = performance.now();

    const attempt = () => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        element.focus({ preventScroll: true });
        return;
      }
      if (performance.now() - started < 1500) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  }

  function next() {
    if (submitLock.current) return;
    setFormError(null);

    const issues = blockingIssues(step);
    if (Object.keys(issues).length > 0) {
      if (step === 'details' || step === 'payment') {
        setRevealed((current) => ({ ...current, [step]: true }));
      }
      focusFirstError(issues);
      return;
    }

    if (step === 'payment') return void submit();
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function back() {
    if (submitLock.current) return;
    setFormError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  /**
   * Coming back with the browser's Back button from the payment gateway.
   * Browsers restore the page exactly as it was — spinner included, and it
   * never stops. The booking already exists (its time is held), so resubmitting
   * would only be refused as a taken slot; show the booking's own page instead.
   */
  React.useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      submitLock.current = false;
      setSubmitting(false);
      const reference = bookedReference.current;
      if (reference) {
        window.location.replace(`/book/confirmation?ref=${encodeURIComponent(reference)}`);
      }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // A failure message below the fold is one the client never sees — the
  // mobile action bar sits over the bottom of the page.
  React.useEffect(() => {
    if (formError) formErrorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [formError]);

  async function submit() {
    if (!service || !mode || !date || !time) return;
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setServerErrors({});
    setFormError(null);

    // Set when this page is being left; the spinner then stays up until it goes.
    let leaving = false;

    try {
      const result = await withDeadline(
        submitBooking({
          serviceId: service.id,
          mode,
          locationId: mode === 'in_person' ? locationId : null,
          date,
          time,
          firstName: details.firstName,
          lastName: details.lastName,
          email: details.email,
          phone: details.phone,
          address: details.address || undefined,
          emergencyName: details.emergencyName,
          emergencyPhone: details.emergencyPhone,
          reason: details.reason || undefined,
          isFirstSession: details.isFirstSession,
          paymentMethod: effectivePaymentMethod,
          medicalAid: usingMedicalAid ? medicalAid : null,
          consentTerms: consentTerms as true,
          consentAge: consentAge as true,
          clinicalConsent,
        }),
        SUBMIT_DEADLINE_MS,
      );

      if (!result.ok) {
        const reported = result.errors ?? {};
        setServerErrors(reported);
        setFormError(result.error ?? 'Something went wrong. Please try again.');

        if (reported.time) {
          setTime(null);
          setSlots(null);
          setStepIndex(steps.indexOf('time'));
          toast({ tone: 'warning', title: 'That time has just gone', description: result.error });
          return;
        }

        // Show anything else the server rejected on the step it belongs to —
        // the only place the client can actually see and fix it.
        const owningStep = steps.find((s) =>
          Object.keys(reported).some((key) => stepForErrorKey(key) === s),
        );
        if (owningStep) {
          if (owningStep === 'details' || owningStep === 'payment') {
            setRevealed((current) => ({ ...current, [owningStep]: true }));
          }
          setStepIndex(steps.indexOf(owningStep));
          focusFirstError(reported);
        }
        return;
      }

      bookedReference.current = result.reference ?? null;
      const confirmationUrl = `/book/confirmation?ref=${encodeURIComponent(result.reference ?? '')}`;

      // If no payment is required (e.g. Medical Aid with no co-pay), instantly redirect to success.
      if (!result.requiresPayment || !result.appointmentId) {
        leaving = true;
        window.location.assign(confirmationUrl);
        return;
      }

      if (supportsEmbedded) {
        try {
          const payment = await withDeadline(
            startEmbeddedPayment(result.appointmentId),
            SUBMIT_DEADLINE_MS,
          );
          if (payment.ok) {
            setEmbedded(payment.embedded);
            setStepIndex(steps.indexOf('checkout'));
            return;
          }
          console.warn('[booking] embedded checkout unavailable:', payment.error);
        } catch (error) {
          // The booking exists; only the in-page card form failed. Fall through
          // to the redirect rather than stranding the client.
          console.warn('[booking] embedded checkout failed:', error);
        }
      }

      leaving = true;
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      // No checkout could be opened; the booking page shows the time as held
      // with a "Complete payment" button, so nothing is lost.
      window.location.assign(confirmationUrl);
    } catch (error) {
      console.error('[booking] submit failed:', error);
      setFormError(describeSubmitFailure(error));
    } finally {
      submitLock.current = false;
      if (!leaving) setSubmitting(false);
    }
  }

  const stepNumber = stepIndex + 1;
  const totalSteps = steps.length;

  // Derived, not stored, so it clears itself once the last field is fixed.
  const validationMessage =
    step === 'details' && revealed.details && Object.keys(detailsIssues).length > 0
      ? 'Please complete the highlighted fields to continue.'
      : step === 'payment' && revealed.payment && Object.keys(medicalAidIssues).length > 0
        ? 'Please complete your medical aid details to continue.'
        : null;
  const alertMessage = formError ?? validationMessage;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
      <div className="min-w-0">
        <ProgressRail steps={steps} current={stepIndex} />

        <div className="mt-8 min-h-[26rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -18 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 'service' && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="What type of appointment do you need?"
                >
                  <div className="grid gap-3" role="radiogroup" aria-label="Service">
                    {visibleServices.map((s) => {
                      const cat = categories.find((c) => c.id === s.categoryId);
                      return (
                        <OptionCard
                          key={s.id}
                          selected={serviceId === s.id}
                          onSelect={() => {
                            setServiceId(s.id);
                            setDate(null);
                            setTime(null);
                          }}
                          icon={<ServiceIcon name={cat?.icon ?? 'Sprout'} className="h-5 w-5" />}
                          title={s.name}
                          description={s.summary}
                          meta={s.requiresQuote ? 'Billed separately after first session' : undefined}
                        />
                      );
                    })}
                  </div>
                </StepShell>
              )}

              {step === 'mode' && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="How would you like to meet?"
                >
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Session type">
                    <OptionCard
                      selected={mode === 'online'}
                      disabled={!service?.allowsOnline}
                      onSelect={() => {
                        setMode('online');
                        setLocationId(null);
                        setDate(null);
                        setTime(null);
                      }}
                      icon={<Video className="h-5 w-5" />}
                      title="Online"
                    />
                    <OptionCard
                      selected={mode === 'in_person'}
                      disabled={!service?.allowsInPerson}
                      onSelect={() => {
                        setMode('in_person');
                        setDate(null);
                        setTime(null);
                      }}
                      icon={<Building2 className="h-5 w-5" />}
                      title="In person"
                    />
                  </div>
                </StepShell>
              )}

              {step === 'location' && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="Which practice suits you?"
                >
                  <div className="grid gap-3" role="radiogroup" aria-label="Location">
                    {locations.map((l) => (
                      <OptionCard
                        key={l.id}
                        selected={locationId === l.id}
                        onSelect={() => {
                          setLocationId(l.id);
                          setDate(null);
                          setTime(null);
                        }}
                        icon={<MapPin className="h-5 w-5" />}
                        title={l.name}
                        description={`${l.addressLine}, ${l.city}, ${l.postalCode}`}
                      />
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 'date' && service && mode && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="Choose a date"
                >
                  <BookingCalendar
                    serviceId={service.id}
                    mode={mode}
                    locationId={locationId}
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setTime(null);
                      setStepIndex(steps.indexOf('time'));
                    }}
                  />
                </StepShell>
              )}

              {step === 'time' && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="Choose a time"
                  lead={date ? `${formatFullDate(date)} · ${service?.durationMinutes ?? 60} minutes` : ''}
                >
                  {loadingSlots || slots === null ? (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="h-13 rounded-2xl" />
                      ))}
                    </div>
                  ) : slots.filter((s) => s.available).length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-line-strong bg-cream-50/70 dark:bg-card/70 p-10 text-center">
                      <p className="font-display text-lg text-ink">Nothing open on this day</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-6"
                        onClick={() => setStepIndex(steps.indexOf('date'))}
                      >
                        Pick another date
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4"
                        role="radiogroup"
                        aria-label="Available times"
                      >
                        {slots.map((slot) => (
                          <button
                            key={slot.label}
                            type="button"
                            role="radio"
                            aria-checked={time === slot.label}
                            disabled={!slot.available}
                            onClick={() => setTime(slot.label)}
                            className={cn(
                              'flex h-13 items-center justify-center rounded-2xl border text-sm tabular transition-all duration-200 ease-calm',
                              time === slot.label
                                ? 'border-forest-800 bg-forest-800 font-medium text-cream-100'
                                : slot.available
                                ? 'border-line bg-white text-ink hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-subtle'
                                : 'cursor-not-allowed border-line-soft bg-cream-100/60 dark:bg-card/60 text-ink-faint line-through',
                            )}
                          >
                            {displayTime(slot.label)}
                          </button>
                        ))}
                      </div>
                      <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
                        <Clock className="h-4 w-4 text-forest-600 dark:text-forest-300" />
                        Times shown in South African time (SAST).
                      </p>
                    </>
                  )}
                </StepShell>
              )}

              {step === 'details' && (
                <StepShell
                  n={stepNumber}
                  total={totalSteps}
                  title="Your details"
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        value={details.firstName}
                        onChange={(e) => setDetails({ ...details, firstName: e.target.value })}
                        autoComplete="given-name"
                        error={errors.firstName}
                      />
                      <FieldError id="firstName-error">{errors.firstName}</FieldError>
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        value={details.lastName}
                        onChange={(e) => setDetails({ ...details, lastName: e.target.value })}
                        autoComplete="family-name"
                        error={errors.lastName}
                      />
                      <FieldError id="lastName-error">{errors.lastName}</FieldError>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={details.email}
                        onChange={(e) => setDetails({ ...details, email: e.target.value })}
                        autoComplete="email"
                        error={errors.email}
                      />
                      <FieldError id="email-error">{errors.email}</FieldError>
                    </div>
                    <div>
                      <Label htmlFor="phone">Mobile number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="083 000 0000"
                        value={details.phone}
                        onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                        autoComplete="tel"
                        error={errors.phone}
                      />
                      <FieldError id="phone-error">{errors.phone}</FieldError>
                    </div>
                  </div>

                  <div className="mt-5">
                    <Label htmlFor="address" optional hint="Needed for in-person sessions and invoices">
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      rows={2}
                      value={details.address}
                      onChange={(e) => setDetails({ ...details, address: e.target.value })}
                      placeholder="Street, suburb, city, postal code"
                      autoComplete="street-address"
                      error={errors.address}
                    />
                    <FieldError id="address-error">{errors.address}</FieldError>
                  </div>

                  <fieldset className="mt-5 rounded-3xl border border-line bg-canvas-sunk p-5">
                    <legend className="px-1 text-sm font-medium text-ink">
                      Emergency contact
                    </legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="emergencyName">Full name</Label>
                        {/* autoComplete off: browsers otherwise fill in the client's OWN details here. */}
                        <Input
                            id="emergencyName"
                            autoComplete="off"
                            value={details.emergencyName}
                            onChange={(e) =>
                              setDetails({ ...details, emergencyName: e.target.value })
                            }
                            error={errors.emergencyName}
                        />
                        <FieldError id="emergencyName-error">{errors.emergencyName}</FieldError>
                      </div>
                      <div>
                        <Label htmlFor="emergencyPhone">Contact number</Label>
                        <Input
                            id="emergencyPhone"
                            type="tel"
                            autoComplete="off"
                            placeholder="083 000 0000"
                            value={details.emergencyPhone}
                            onChange={(e) =>
                              setDetails({ ...details, emergencyPhone: e.target.value })
                            }
                            error={errors.emergencyPhone}
                        />
                        <FieldError id="emergencyPhone-error">{errors.emergencyPhone}</FieldError>
                      </div>
                    </div>
                  </fieldset>

                  <div className="mt-5">
                    <Label htmlFor="reason" optional>
                      What brings you here?
                    </Label>
                    <Textarea
                      id="reason"
                      rows={3}
                      value={details.reason}
                      onChange={(e) => setDetails({ ...details, reason: e.target.value })}
                      error={errors.reason}
                    />
                    <FieldError id="reason-error">{errors.reason}</FieldError>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-ink">Is this your first session?</p>
                    <div
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="Is this your first session?"
                    >
                      <OptionCard
                        selected={details.isFirstSession}
                        onSelect={() => setDetails({ ...details, isFirstSession: true })}
                        title="This is my first session"
                      />
                      <OptionCard
                        selected={!details.isFirstSession}
                        onSelect={() => setDetails({ ...details, isFirstSession: false })}
                        title="This is my follow-up session"
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <CheckboxRow
                      id="consentAge"
                      checked={consentAge}
                      onChange={setConsentAge}
                      title="I am 16 or older, or I have guardian consent"
                      error={errors.consentAge}
                    />
                    <CheckboxRow
                      id="consentTerms"
                      checked={consentTerms}
                      onChange={setConsentTerms}
                      title="I accept the terms & conditions and privacy notice"
                      error={errors.consentTerms}
                    />
                  </div>
                </StepShell>
              )}

              {step === 'consent' && (
                <StepShell
                    n={stepNumber}
                    total={totalSteps}
                    title="Informed consent"
                    lead="Please complete this form to confirm your informed consent and agreement"
                >
                    <ConsentForm value={clinicalConsent} onChange={setClinicalConsent} showPrint={false} />
                </StepShell>
              )}

              {step === 'payment' && (
                <StepShell
                    n={stepNumber}
                    total={totalSteps}
                    title="How would you like to pay?"
                    lead={
                      usingMedicalAid
                        ? 'Nothing is charged now. Your time is held while we confirm your medical aid.'
                        : chargeNowCents > 0
                          ? ''
                          : 'Nothing is charged for this booking.'
                    }
                >
                    {service?.requiresQuote || service?.rateBand === 'free' ? (
                      <div className="rounded-3xl border border-line bg-white p-7">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                          <Check className="h-5 w-5" />
                        </span>
                        <h3 className="mt-5 font-display text-xl text-ink">
                          {service.rateBand === 'free' ? 'This session is free' : 'Booking successful'}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          {service.intakeNote}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                          <OptionCard
                            selected={paymentMethod === 'card'}
                            onSelect={() => setPaymentMethod('card')}
                            icon={<CreditCard className="h-5 w-5" />}
                            title="Pay by card or wallet"
                            description="Apple Pay, Google Pay or any major card. We never see or store your card details."
                            meta={money(
                              mode === 'online'
                                ? (service?.priceOnlineCents ?? 0)
                                : (service?.priceInPersonCents ?? 0),
                            )}
                          />
                          <OptionCard
                            selected={paymentMethod === 'medical_aid'}
                            onSelect={() => setPaymentMethod('medical_aid')}
                            icon={<ShieldCheck className="h-5 w-5" />}
                            title="Use medical aid"
                            description="Claimed from your scheme after the session."
                            meta="Claimed"
                          />
                        </div>

                        <AnimatePresence initial={false}>
                          {usingMedicalAid && (
                            <motion.div
                              initial={reduced ? false : { opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-5 rounded-3xl border border-line bg-white p-6">
                                <p className="text-sm font-medium text-ink">Your medical aid</p>

                                <ul className="mt-3 space-y-2 rounded-2xl bg-cream-50 p-4">
                                  {[
                                    'Medical aid rates differ from the cash rates shown.',
                                    'Medical aid rates are subject to your scheme’s rules, available benefits and authorisation requirements.',
                                    'Acceptance of these details does not guarantee payment by your scheme. Any amount not covered remains your responsibility.',
                                  ].map((line) => (
                                    <li
                                      key={line}
                                      className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                                    >
                                      <span
                                        aria-hidden
                                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-forest-400"
                                      />
                                      {line}
                                    </li>
                                  ))}
                                </ul>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                  {/* Date of birth and ID number are optional server-side (see medicalAidSchema). */}
                                  <div className="sm:col-span-2">
                                    <Label htmlFor="scheme">Scheme</Label>
                                    <Input
                                      id="scheme"
                                      value={medicalAid.scheme}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, scheme: e.target.value })
                                      }
                                      placeholder="e.g. Discovery Health"
                                      error={errors['medicalAid.scheme']}
                                    />
                                    <FieldError id="scheme-error">{errors['medicalAid.scheme']}</FieldError>
                                  </div>
                                  <div>
                                    <Label htmlFor="memberNumber">Membership number</Label>
                                    <Input
                                      id="memberNumber"
                                      value={medicalAid.memberNumber}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, memberNumber: e.target.value })
                                      }
                                      error={errors['medicalAid.memberNumber']}
                                    />
                                    <FieldError id="memberNumber-error">
                                      {errors['medicalAid.memberNumber']}
                                    </FieldError>
                                  </div>
                                  <div>
                                    <Label htmlFor="dateOfBirth" optional>
                                      Date of birth
                                    </Label>
                                    <Input
                                      id="dateOfBirth"
                                      type="date"
                                      value={medicalAid.dateOfBirth}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, dateOfBirth: e.target.value })
                                      }
                                      error={errors['medicalAid.dateOfBirth']}
                                    />
                                    <FieldError id="dateOfBirth-error">
                                      {errors['medicalAid.dateOfBirth']}
                                    </FieldError>
                                  </div>
                                  <div>
                                    <Label htmlFor="mainMember">Main member</Label>
                                    <Input
                                      id="mainMember"
                                      value={medicalAid.mainMember}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, mainMember: e.target.value })
                                      }
                                      placeholder="Self, or their full name"
                                      error={errors['medicalAid.mainMember']}
                                    />
                                    <FieldError id="mainMember-error">
                                      {errors['medicalAid.mainMember']}
                                    </FieldError>
                                  </div>
                                  <div>
                                    <Label htmlFor="mainMemberId" optional>
                                      Main member ID number
                                    </Label>
                                    <Input
                                      id="mainMemberId"
                                      inputMode="numeric"
                                      value={medicalAid.mainMemberId}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, mainMemberId: e.target.value })
                                      }
                                      placeholder="As it appears on the scheme"
                                      error={errors['medicalAid.mainMemberId']}
                                    />
                                    <FieldError id="mainMemberId-error">
                                      {errors['medicalAid.mainMemberId']}
                                    </FieldError>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {!noCharge && effectivePaymentMethod === 'card' && (
                      <PaymentMethods methods={acceptedMethods} className="mt-6" />
                    )}

                    <p className="mt-6 flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
                      Cancellations must be made at least 24 hours before the session. Late
                      cancellations or missed appointments may be charged in full.
                    </p>
                </StepShell>
              )}
              {step === 'checkout' && embedded && (
                  <StepShell
                    n={stepNumber}
                    total={totalSteps}
                    title="Complete your payment"
                    lead={`Your ${service?.durationMinutes ?? 60}-minute session is held while you pay.`}
                  >
                    <EmbeddedCheckout
                      checkoutId={embedded.checkoutId}
                      scriptUrl={embedded.scriptUrl}
                      brands={embedded.brands}
                      resultUrl={embedded.resultUrl}
                      amountLabel={money(amountCents)}
                      isMock={paymentProvider === 'mock'}
                    />
                  </StepShell>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {alertMessage && (
          <p
            ref={formErrorRef}
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {alertMessage}
          </p>
        )}

        <div
          className={cn(
            'mt-8 hidden items-center justify-between gap-4',
            step === 'checkout' ? 'lg:hidden' : 'lg:flex',
          )}
        >
          <Button variant="ghost" onClick={back} disabled={stepIndex === 0 || submitting}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            size="lg"
            onClick={next}
            disabled={!canAdvance || submitting}
            loading={submitting}
            loadingText={chargeNowCents > 0 ? 'Opening secure checkout…' : 'Confirming…'}
          >
            {step === 'payment'
              ? chargeNowCents > 0
                ? `Pay ${money(chargeNowCents)} & confirm`
                : 'Confirm booking'
              : 'Continue'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
    </div>

    <aside className="lg:sticky lg:top-28 lg:self-start">
      <SummaryCard
        service={service}
        category={category}
        mode={mode}
        location={location}
        date={date}
        time={time}
        amountCents={amountCents}
        paymentMethod={effectivePaymentMethod}
        requiresQuote={service?.requiresQuote ?? false}
        isFree={service?.rateBand === 'free'}
        acceptedMethods={acceptedMethods}
      />
    </aside>

    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 pb-safe lg:hidden',
        step === 'checkout' && 'hidden',
      )}
    >
      <div className="flex items-center gap-3">
        {stepIndex > 0 && (
          <Button variant="secondary" size="icon" onClick={back} disabled={submitting} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          full
          size="lg"
          onClick={next}
          disabled={!canAdvance || submitting}
          loading={submitting}
          loadingText={chargeNowCents > 0 ? 'Opening checkout…' : 'Confirming…'}
        >
          {step === 'payment'
            ? chargeNowCents > 0
              ? `Pay ${money(chargeNowCents)}`
              : 'Confirm booking'
            : 'Continue'}
        </Button>
      </div>
    </div>
  </div>
  );
}

function StepShell({
  n,
  total,
  title,
  lead,
  children,
}: {
  n: number;
  total: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-600 dark:text-forest-300">
        Step {String(n).padStart(2, '0')} of {String(total).padStart(2, '0')}
      </p>
      <h1 className="mt-4 font-display text-3xl text-ink text-balance sm:text-4xl">{title}</h1>
      {lead && <p className="mt-3 max-w-xl leading-relaxed text-ink-soft text-pretty">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

const STEP_LABELS: Record<StepId, string> = {
  concern: 'Support',
  service: 'Service',
  mode: 'Format',
  location: 'Practice',
  date: 'Date',
  time: 'Time',
  details: 'Details',
  consent: 'Consent',
  payment: 'Payment',
  checkout: 'Pay',
};

function ProgressRail({ steps, current }: { steps: StepId[]; current: number }) {
  return (
    <ol className="scrollbar-none flex items-center gap-1 overflow-x-auto" aria-label="Booking progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors duration-300',
                active
                  ? 'bg-forest-800 text-cream-100'
                  : done
                    ? 'text-forest-700 dark:text-forest-300'
                    : 'text-ink-faint',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-2xs tabular',
                  active
                    ? 'bg-cream-100/20'
                    : done
                      ? 'bg-forest-100 dark:bg-forest-900/45 text-forest-700 dark:text-forest-300'
                      : 'bg-line-soft text-ink-faint',
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
              </span>
              <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'h-px w-4 transition-colors duration-300 sm:w-6',
                  done ? 'bg-forest-300' : 'bg-line-strong',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryCard({
  service,
  category,
  mode,
  location,
  date,
  time,
  amountCents,
  paymentMethod,
  requiresQuote,
  isFree,
  acceptedMethods,
}: {
  service: Service | null;
  category: ServiceCategory | null;
  mode: 'online' | 'in_person' | null;
  location: Location | null;
  date: string | null;
  time: string | null;
  amountCents: number;
  paymentMethod: 'card' | 'medical_aid';
  requiresQuote: boolean;
  isFree: boolean;
  acceptedMethods: readonly PaymentMethodMark[];
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (service) rows.push({ label: 'Service', value: service.name });
  if (mode)
    rows.push({
      label: 'Format',
      value: mode === 'online' ? 'Online' : location ? `${location.name} practice` : 'In person',
    });
  if (date) {
    const primary = relativeDay(date);
    const full = formatFullDate(date);
    rows.push({
      label: 'Date',
      value: (
        <span>
          {primary}
          {primary !== full && <span className="block text-xs text-ink-faint">{full}</span>}
        </span>
      ),
    });
  }
  if (time) rows.push({ label: 'Time', value: displayTime(time) });
  if (service) rows.push({ label: 'Duration', value: `${service.durationMinutes} minutes` });

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="border-b border-line bg-cream-50 dark:bg-canvas px-6 py-5">
        <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
          Your session
        </p>
        {category ? (
          <p className="mt-2 flex items-center gap-2.5 font-display text-lg text-ink">
            <ServiceIcon name={category.icon} className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
            {category.name}
          </p>
        ) : (
          <p className="mt-2 font-display text-lg text-ink-faint">Nothing selected yet</p>
        )}
      </div>

      <div className="px-6 py-5">
        {rows.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Your choices will appear here as you go. Nothing is booked until the final step.
          </p>
        ) : (
          <dl className="space-y-3.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                <dt className="text-ink-faint">{row.label}</dt>
                <dd className="text-right font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {service && (
        <div className="border-t border-line px-6 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-ink-faint">
              {isFree
                ? 'Cost'
                : requiresQuote
                  ? 'Fee'
                  : paymentMethod === 'medical_aid'
                    ? amountCents > 0
                      ? 'Co-payment'
                      : 'Medical aid'
                    : 'To pay now'}
            </span>
            <span className="font-display text-2xl tabular text-ink">
              {isFree
                ? 'Free'
                : requiresQuote
                  ? 'Billed separately after first session'
                  : paymentMethod === 'medical_aid' && amountCents === 0
                    ? 'Claimed'
                    : money(amountCents)}
            </span>
          </div>
          {paymentMethod === 'medical_aid' && !requiresQuote && !isFree && (
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {mode === 'in_person'
                ? 'Co-payment for an in-person consultation using medical aid benefits. Nothing is charged now — it is payable once your medical aid is confirmed.'
                : 'Submitted to your scheme. Any amount not covered remains your responsibility.'}
            </p>
          )}
          <Badge tone="success" size="sm" className="mt-4">
            <ShieldCheck className="h-3 w-3" /> Card details never stored
          </Badge>

          {!isFree && !requiresQuote && (
            acceptedMethods.length > 0 ? (
              <PaymentMethods methods={acceptedMethods} compact className="mt-4" />
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-ink-soft">
                The practice will send payment details before your appointment.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}