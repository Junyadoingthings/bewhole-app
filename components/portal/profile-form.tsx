'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, Check } from 'lucide-react';

import { updateOwnProfile, type AuthState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

const initial: AuthState = { status: 'idle' };

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, action] = useFormState(updateOwnProfile, initial);

  return (
    <form action={action} className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={profile.firstName}
            error={state.errors?.firstName}
          />
          <FieldError id="firstName-error">{state.errors?.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={profile.lastName}
            error={state.errors?.lastName}
          />
          <FieldError id="lastName-error">{state.errors?.lastName}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" hint="Contact us to change this">
            Email
          </Label>
          <Input id="email" defaultValue={email} disabled />
        </div>
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone ?? ''}
            error={state.errors?.phone}
          />
          <FieldError id="phone-error">{state.errors?.phone}</FieldError>
        </div>
        <div>
          <Label htmlFor="dateOfBirth" optional>
            Date of birth
          </Label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={profile.dateOfBirth ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="preferredContact">How should we reach you?</Label>
          <Select id="preferredContact" name="preferredContact" defaultValue={profile.preferredContact}>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </Select>
        </div>
      </div>

      {state.status !== 'idle' && state.message && (
        <p
          role="status"
          className={cn(
            'mt-6 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
            state.status === 'error'
              ? 'bg-state-dangerSoft text-state-danger'
              : 'bg-state-successSoft text-forest-700 dark:text-forest-300',
          )}
        >
          {state.status === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {state.message}
        </p>
      )}

      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-6" loading={pending} loadingText="Saving…">
      Save changes
    </Button>
  );
}
