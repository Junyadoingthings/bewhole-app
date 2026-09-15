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
import type { Location, Service, ServiceCategory, SessionUser, TimeSlot } from '@/types';
import type { PaymentMethodMark } from '@/services/payments/types';

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
  const [errors, setErrors] = React.useState<Record<string, string>>({});
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
    if (paymentMethod === 'medical_aid') {
      return mode === 'in_person' ? medicalAidCoPaymentCents : 0;
    }
    return mode === 'online' ? service.priceOnlineCents : service.priceInPersonCents;
  }, [service, mode, paymentMethod, medicalAidCoPaymentCents]);

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
        return (
          details.firstName.trim().length > 1 &&
          details.lastName.trim().length > 1 &&
          /\S+@\S+\.\S+/.test(details.email) &&
          details.phone.replace(/\D/g, '').length >= 10 &&
          details.emergencyName.trim().length > 1 &&
          details.emergencyPhone.replace(/\D/g, '').length >= 10 &&
          consentTerms &&
          consentAge
        );
      case 'consent':
        return isConsentComplete(clinicalConsent);
      case 'payment':
        return paymentMethod === 'card' || Boolean(medicalAid.scheme && medicalAid.memberNumber);
      case 'checkout':
        return false;
      default:
        return false;
    }
  }, [step, serviceId, mode, locationId, date, time, details, consentTerms, consentAge, paymentMethod, medicalAid, clinicalConsent]);

  function next() {
    setFormError(null);
    if (step === 'payment') return void submit();
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function back() {
    setFormError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    if (!service || !mode || !date || !time) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await submitBooking({
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
      paymentMethod,
      medicalAid: paymentMethod === 'medical_aid' ? medicalAid : null,
      consentTerms: consentTerms as true,
      consentAge: consentAge as true,
      clinicalConsent,
    });

    if (!result.ok) {
      setSubmitting(false);
      setErrors(result.errors ?? {});
      setFormError(result.error ?? 'Something went wrong. Please try again.');

      if (result.errors?.time) {
        setTime(null);
        setSlots(null);
        setStepIndex(steps.indexOf('time'));
        toast({ tone: 'warning', title: 'That time has just gone', description: result.error });
      }
      return;
    }

    if (!result.requiresPayment || !result.appointmentId) {
      router.push(`/book/confirmation?ref=${result.reference}`);
      return;
    }

    if (supportsEmbedded) {
      const payment = await startEmbeddedPayment(result.appointmentId);
      if (payment.ok) {
        setEmbedded(payment.embedded);
        setStepIndex(steps.indexOf('checkout'));
        setSubmitting(false);
        return;
      }
    }

    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }

    router.push(`/book/confirmation?ref=${result.reference}`);
  }

  const stepNumber = stepIndex + 1;
  const totalSteps = steps.length;

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
                    />
                  </div>

                  <fieldset className="mt-5 rounded-3xl border border-line bg-canvas-sunk p-5">
                    <legend className="px-1 text-sm font-medium text-ink">
                      Emergency contact
                    </legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="emergencyName">Full name</Label>
                        <Input
                            id="emergencyName"
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
                    />
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
                      amountCents > 0
                        
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
                          {paymentMethod === 'medical_aid' && (
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
                                  <div className="sm:col-span-2">
                                    <Label htmlFor="scheme">Scheme</Label>
                                    <Input
                                      id="scheme"
                                      value={medicalAid.scheme}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, scheme: e.target.value })
                                      }
                                      placeholder="e.g. Discovery Health"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="memberNumber">Membership number</Label>
                                    <Input
                                      id="memberNumber"
                                      value={medicalAid.memberNumber}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, memberNumber: e.target.value })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="dateOfBirth">Date of birth</Label>
                                    <Input
                                      id="dateOfBirth"
                                      type="date"
                                      value={medicalAid.dateOfBirth}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, dateOfBirth: e.target.value })
                                      }
                                    />
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
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="mainMemberId">Main member ID number</Label>
                                    <Input
                                      id="mainMemberId"
                                      inputMode="numeric"
                                      value={medicalAid.mainMemberId}
                                      onChange={(e) =>
                                        setMedicalAid({ ...medicalAid, mainMemberId: e.target.value })
                                      }
                                      placeholder="As it appears on the scheme"
                                    />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {paymentMethod === 'card' && (
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

        {formError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
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
            loadingText={amountCents > 0 ? 'Opening secure checkout…' : 'Confirming…'}
          >
            {step === 'payment'
              ? amountCents > 0
                ? `Pay ${money(amountCents)} & confirm`
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
        paymentMethod={paymentMethod}
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
          loadingText="Please wait…"
        >
          {step === 'payment'
            ? amountCents > 0
              ? `Pay ${money(amountCents)}`
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
              {isFree ? 'Cost' : requiresQuote ? 'Fee' : 'To pay now'}
            </span>
            <span className="font-display text-2xl tabular text-ink">
              {isFree ? 'Free' : requiresQuote ? 'Billed separately after first session' : money(amountCents)}
            </span>
          </div>
          {paymentMethod === 'medical_aid' && !requiresQuote && !isFree && (
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {mode === 'in_person'
                ? 'Co-payment for an in-person consultation using medical aid benefits.'
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