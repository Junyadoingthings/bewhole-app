'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, Check, Eye, EyeOff, Mail, Lock } from 'lucide-react';

import { changeOwnPassword, login, register, requestPasswordReset, type AuthState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { CheckboxRow, FieldError, Input, Label } from '@/components/ui/field';
import { passwordProblems } from '@/lib/auth/password-rules';
import { cn } from '@/lib/utils';

const initial: AuthState = { status: 'idle' };

function Alert({ state }: { state: AuthState }) {
  if (state.status === 'idle' || !state.message) return null;
  const isError = state.status === 'error';
  return (
    <p
      role="alert"
      className={cn(
        'mt-6 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
        isError ? 'bg-state-dangerSoft text-state-danger' : 'bg-state-successSoft text-forest-700 dark:text-forest-300',
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {state.message}
    </p>
  );
}

function Submit({ children, loadingText }: { children: React.ReactNode; loadingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full className="mt-6" loading={pending} loadingText={loadingText}>
      {children}
    </Button>
  );
}

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  error,
  onChange,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  onChange?: (value: string) => void;
  hint?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          icon={<Lock className="h-4 w-4" />}
          error={error}
          onChange={(e) => onChange?.(e.target.value)}
          className="pr-12"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-faint transition-colors hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/* ------------------------------------------------------------------- login */

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState(login, initial);

  return (
    <form action={action} className="mt-8">
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
            error={state.errors?.email}
            required
          />
          <FieldError id="email-error">{state.errors?.email}</FieldError>
        </div>

        <PasswordInput id="password" name="password" label="Password" autoComplete="current-password" />
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      <Alert state={state} />
      <Submit loadingText="Signing in…">Sign in</Submit>
    </form>
  );
}

/* ---------------------------------------------------------------- register */

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useFormState(register, initial);
  const [password, setPassword] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const problems = passwordProblems(password);

  return (
    <form action={action} className="mt-8">
      {next && <input type="hidden" name="next" value={next} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" error={state.errors?.firstName} required />
          <FieldError id="firstName-error">{state.errors?.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" error={state.errors?.lastName} required />
          <FieldError id="lastName-error">{state.errors?.lastName}</FieldError>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
            error={state.errors?.email}
            required
          />
          <FieldError id="email-error">{state.errors?.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="083 000 0000"
            autoComplete="tel"
            error={state.errors?.phone}
            required
          />
          <FieldError id="phone-error">{state.errors?.phone}</FieldError>
        </div>

        <div>
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            error={state.errors?.password}
            onChange={setPassword}
          />
          {password.length > 0 && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {['At least 10 characters', 'One lowercase letter', 'One uppercase letter', 'One number'].map(
                (rule) => {
                  const met = !problems.includes(rule);
                  return (
                    <li
                      key={rule}
                      className={cn(
                        'flex items-center gap-2 text-xs transition-colors duration-200',
                        met ? 'text-forest-600 dark:text-forest-300' : 'text-ink-faint',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-200',
                          met ? 'bg-forest-100 dark:bg-forest-900/45' : 'bg-line-soft',
                        )}
                      >
                        {met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                      {rule}
                    </li>
                  );
                },
              )}
            </ul>
          )}
        </div>

        <CheckboxRow
          id="consentTerms"
          name="consentTerms"
          checked={consent}
          onChange={setConsent}
          title="I accept the terms & conditions and privacy notice"
          description="Including the 24-hour cancellation policy and the limits of confidentiality."
          error={state.errors?.consentTerms}
        />
      </div>

      <Alert state={state} />
      <Submit loadingText="Creating your account…">Create account</Submit>
    </form>
  );
}

/* ------------------------------------------------------------------- reset */

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordReset, initial);

  return (
    <form action={action} className="mt-8">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          required
        />
      </div>
      <Alert state={state} />
      <Submit loadingText="Sending…">Send instructions</Submit>
    </form>
  );
}

/* ------------------------------------------------------------ password change */

export function ChangePasswordForm() {
  const [state, action] = useFormState(changeOwnPassword, initial);
  const [password, setPassword] = React.useState('');
  const problems = passwordProblems(password);

  return (
    <form action={action}>
      <div className="space-y-5">
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          error={state.errors?.currentPassword}
        />
        <PasswordInput
          id="newPassword"
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          error={state.errors?.newPassword}
          onChange={setPassword}
          hint={password && problems.length === 0 ? 'Looks good' : undefined}
        />
      </div>
      <Alert state={state} />
      <Submit loadingText="Updating…">Change password</Submit>
    </form>
  );
}
