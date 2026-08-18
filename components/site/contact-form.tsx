'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

import { submitContact, type ContactState } from '@/app/actions/contact';
import { Button } from '@/components/ui/button';
import { CheckboxRow, FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { SuccessMark } from '@/components/motion';

const TOPICS = [
  'General enquiry',
  'Booking an appointment',
  'Medical aid & payments',
  'Workshops & wellness programs',
  'Psychometric testing',
  'Something else',
];

const initialState: ContactState = { status: 'idle' };

export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [state, action] = useFormState(submitContact, initialState);
  const [consent, setConsent] = React.useState(false);

  if (state.status === 'success') {
    return (
      <div className="flex flex-col items-center rounded-4xl border border-line bg-white p-10 text-center">
        <SuccessMark />
        <h2 className="mt-6 font-display text-2xl text-ink">Message sent</h2>
        <p className="mt-3 max-w-sm leading-relaxed text-ink-soft text-pretty">{state.message}</p>
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-faint">
          <CheckCircle2 className="h-4 w-4 text-forest-600 dark:text-forest-300" />
          A copy has gone to your inbox
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-4xl border border-line bg-white p-7 sm:p-10">
      {/* Honeypot — visually and programmatically hidden from real users. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" error={state.errors?.name} required />
          <FieldError id="name-error">{state.errors?.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            error={state.errors?.email}
            required
          />
          <FieldError id="email-error">{state.errors?.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone" optional>
            Phone
          </Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="083 000 0000" />
        </div>
        <div>
          <Label htmlFor="topic">What is this about?</Label>
          <Select id="topic" name="topic" defaultValue={defaultTopic ?? TOPICS[0]}>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-5">
        <Label htmlFor="message" hint="Please don’t include sensitive health details here">
          Your message
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          placeholder="A sentence or two is plenty."
          error={state.errors?.message}
          required
        />
        <FieldError id="message-error">{state.errors?.message}</FieldError>
      </div>

      <div className="mt-5">
        <CheckboxRow
          id="consent"
          name="consent"
          checked={consent}
          onChange={setConsent}
          title="You may contact me about this enquiry"
          description="We use your details only to reply. Nothing is added to a mailing list."
          error={state.errors?.consent}
        />
      </div>

      {state.status === 'error' && state.message && (
        <p role="alert" className="mt-5 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger">
          {state.message}
        </p>
      )}

      <SubmitButton disabled={!consent} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      full
      className="mt-6"
      loading={pending}
      loadingText="Sending…"
      disabled={disabled}
    >
      Send message
    </Button>
  );
}
