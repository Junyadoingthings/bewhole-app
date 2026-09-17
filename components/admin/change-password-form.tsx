'use client';

import * as React from 'react';
import { Lock, ShieldCheck, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updateAdminPassword } from '@/app/actions/auth';

export function ChangePasswordForm() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Your new passwords do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    const result = await updateAdminPassword(formData);

    if (!result.ok) {
      setError(result.error || 'Failed to update password. Please check your current password.');
    } else {
      toast({
        tone: 'success',
        title: 'Password Secured',
        description: 'Your password has been successfully updated.'
      });
      e.currentTarget.reset();
    }

    setLoading(false);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="border-b border-line bg-cream-50 px-6 py-5 dark:bg-canvas">
        <p className="flex items-center gap-2.5 font-display text-lg text-ink">
          <ShieldCheck className="h-5 w-5 text-forest-700 dark:text-forest-300" />
          Change Password
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Securely update your practice console access.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8">
        <div className="grid gap-5 max-w-md">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>

          <div className="my-2 h-px w-full bg-line-soft" />

          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="mt-2 flex items-start gap-2 rounded-2xl bg-state-dangerSoft px-4 py-3 text-sm text-state-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-4">
            <Button type="submit" loading={loading} loadingText="Securing…" disabled={loading}>
              <Lock className="mr-2 h-4 w-4" />
              Update Password
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}