'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { registerNakedVowsInterest, type NakedVowsState } from '@/app/actions/naked-vows';

const initial: NakedVowsState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full sm:w-auto">
      Register our interest
    </Button>
  );
}

/**
 * Registering interest is not booking.
 *
 * The gathering is invitation-based — the practitioner speaks to a couple
 * before inviting them — so this form deliberately promises a conversation,
 * not a place. Saying "you're registered" would set the wrong expectation.
 */
export function NakedVowsInterestForm() {
  const [state, action] = useFormState(registerNakedVowsInterest, initial);

  if (state.status === 'success') {
    return (
      <div className="rounded-3xl border border-forest-200 bg-forest-50 p-6 text-center dark:border-forest-800 dark:bg-forest-900/20">
        <p className="font-display text-lg text-forest-900 dark:text-forest-100">Thank you.</p>
        <p className="mt-2 text-sm leading-relaxed text-forest-800/80 dark:text-forest-200/80">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <div>
        <Label htmlFor="nv-names">Your names</Label>
        <Input id="nv-names" name="names" placeholder="e.g. Thabo & Lerato" error={state.errors?.names} />
        <FieldError id="nv-names-error">{state.errors?.names}</FieldError>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nv-email">Email</Label>
          <Input id="nv-email" name="email" type="email" error={state.errors?.email} />
          <FieldError id="nv-email-error">{state.errors?.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="nv-phone">Mobile number</Label>
          <Input id="nv-phone" name="phone" type="tel" placeholder="083 000 0000" error={state.errors?.phone} />
          <FieldError id="nv-phone-error">{state.errors?.phone}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="nv-message" optional>
          Anything you would like us to know
        </Label>
        <Textarea id="nv-message" name="message" rows={3} />
      </div>

      {state.status === 'error' && !state.errors && (
        <p className="text-sm text-state-danger">{state.message}</p>
      )}

      <SubmitButton />
      <p className="text-xs text-ink-faint">
        Registering interest is not a booking — Ntombi will be in touch personally before the
        next gathering.
      </p>
    </form>
  );
}
