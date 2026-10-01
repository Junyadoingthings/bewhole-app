'use client';

import * as React from 'react';
import { AlertCircle, Check, Lock, Mail, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  resetAdminPasswordWithCode,
  sendAdminPasswordCode,
  updateAdminPassword,
} from '@/app/actions/auth';
import { PASSWORD_RULES } from '@/lib/auth/password-rules';
import { settle } from '@/lib/settle';
import { cn } from '@/lib/utils';

/** Seconds before "Send a new code" can be pressed again. */
const RESEND_AFTER = 60;

/**
 * The console password, for the practice administrator.
 *
 * Two ways in: the usual "current password → new password", or, for a
 * forgotten password, a 6-digit code emailed to the admin's own address. Both
 * sign out every other device once the password changes.
 */
export function ChangePasswordForm({ maskedEmail }: { maskedEmail: string }) {
  const [mode, setMode] = React.useState<'change' | 'forgot'>('change');

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="border-b border-line bg-cream-50 px-6 py-5 dark:bg-canvas">
        <p className="flex items-center gap-2.5 font-display text-lg text-ink">
          <ShieldCheck className="h-5 w-5 text-forest-700 dark:text-forest-300" />
          {mode === 'change' ? 'Change password' : 'Forgot your password?'}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {mode === 'change'
            ? 'Update the password you use to sign in to the practice console.'
            : `We will email a 6-digit code to ${maskedEmail} to confirm it is you.`}
        </p>
      </div>

      {mode === 'change' ? (
        <ChangeWithCurrent onForgot={() => setMode('forgot')} />
      ) : (
        <ResetWithCode maskedEmail={maskedEmail} onDone={() => setMode('change')} />
      )}
    </div>
  );
}

function ChangeWithCurrent({ onForgot }: { onForgot: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [next, setNext] = React.useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Kept before the await: React clears event.currentTarget afterwards, and
    // calling reset() on null used to leave the button stuck on "Securing…".
    const form = event.currentTarget;
    setError(null);
    setLoading(true);
    const result = await settle(updateAdminPassword(new FormData(form)));
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Your password was not changed. Please try again.');
      return;
    }
    form.reset();
    setNext('');
    toast({
      tone: 'success',
      title: 'Password changed',
      description: 'Other devices have been signed out, and a confirmation email is on its way.',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-8">
      <div className="grid max-w-md gap-5">
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={onForgot}
            className="mt-2 text-sm font-medium text-forest-700 underline-offset-4 hover:underline dark:text-forest-300"
          >
            Forgot your current password?
          </button>
        </div>

        <div className="h-px w-full bg-line-soft" />

        <NewPasswordFields next={next} onNext={setNext} />

        {error && <ErrorNote>{error}</ErrorNote>}

        <div>
          <Button type="submit" loading={loading} loadingText="Saving…">
            <Lock className="mr-2 h-4 w-4" />
            Update password
          </Button>
        </div>
      </div>
    </form>
  );
}

function ResetWithCode({ maskedEmail, onDone }: { maskedEmail: string; onDone: () => void }) {
  const { toast } = useToast();
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [next, setNext] = React.useState('');
  const [wait, setWait] = React.useState(0);

  React.useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    setError(null);
    setSending(true);
    const result = await settle(sendAdminPasswordCode());
    setSending(false);
    if (!result.ok) {
      setError(result.error ?? 'The code could not be sent. Please try again.');
      return;
    }
    setSent(true);
    setWait(RESEND_AFTER);
    toast({ tone: 'success', title: 'Code sent', description: `Check the inbox for ${maskedEmail}.` });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSaving(true);
    const result = await settle(resetAdminPasswordWithCode(new FormData(form)));
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Your password was not changed. Please try again.');
      return;
    }
    form.reset();
    toast({
      tone: 'success',
      title: 'New password set',
      description: 'Other devices have been signed out, and a confirmation email is on its way.',
    });
    onDone();
  }

  if (!sent) {
    return (
      <div className="p-6 sm:p-8">
        <div className="grid max-w-md gap-5">
          <p className="flex items-start gap-3 rounded-2xl border border-line bg-cream-50 p-4 text-sm leading-relaxed text-ink-muted dark:bg-canvas">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
            <span>
              The code goes to <span className="font-medium text-ink">{maskedEmail}</span>, the
              email address of this console account. It works once and expires after 10 minutes.
            </span>
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={sendCode} loading={sending} loadingText="Sending…">
              <Mail className="mr-2 h-4 w-4" />
              Email me a code
            </Button>
            <Button type="button" variant="ghost" onClick={onDone} disabled={sending}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-8">
      <div className="grid max-w-md gap-5">
        <div>
          <Label htmlFor="resetCode">6-digit code from the email</Label>
          <Input
            id="resetCode"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            className="tracking-[0.3em] tabular"
            autoFocus
          />
          <p className="mt-2 text-xs text-ink-faint">
            Sent to {maskedEmail}.{' '}
            {wait > 0 ? (
              `You can ask for a new code in ${wait}s.`
            ) : (
              <button
                type="button"
                onClick={sendCode}
                disabled={sending}
                className="font-medium text-forest-700 underline-offset-4 hover:underline dark:text-forest-300"
              >
                {sending ? 'Sending…' : 'Send a new code'}
              </button>
            )}
          </p>
        </div>

        <div className="h-px w-full bg-line-soft" />

        <NewPasswordFields next={next} onNext={setNext} />

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} loadingText="Saving…">
            <Lock className="mr-2 h-4 w-4" />
            Set new password
          </Button>
          <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
            Back
          </Button>
        </div>
      </div>
    </form>
  );
}

/** New + confirm, with the site's password rules ticking off as you type. */
function NewPasswordFields({ next, onNext }: { next: string; onNext: (v: string) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => onNext(e.target.value)}
        />
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(next);
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-2 text-xs',
                  met ? 'text-forest-700 dark:text-forest-300' : 'text-ink-faint',
                )}
              >
                <Check className={cn('h-3.5 w-3.5', !met && 'opacity-30')} />
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
    </>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}
