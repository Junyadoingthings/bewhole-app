'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, requireStaff } from '@/lib/auth';
import { getFollowUp, getPaymentForFollowUp } from '@/lib/db';
import { followUpSchema, fieldErrors } from '@/lib/validation';
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUpRecord,
  dispatchFollowUp,
} from '@/services/followup.service';
import { createCheckoutForFollowUp } from '@/services/payment.service';

export interface FollowUpActionResult {
  ok: boolean;
  error?: string;
  errors?: Record<string, string>;
  checkoutUrl?: string;
  followUpId?: string;
}

/** Client-initiated payment for their own follow-up. */
export async function payFollowUp(followUpId: string): Promise<FollowUpActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in first.' };

  const followUp = await getFollowUp(followUpId);
  if (!followUp) return { ok: false, error: 'We could not find that follow-up.' };
  if (user.role === 'CLIENT' && followUp.clientUserId !== user.id) {
    return { ok: false, error: 'That follow-up is not on your account.' };
  }
  if (!followUp.paymentRequired || followUp.amountCents <= 0) {
    return { ok: false, error: 'No payment is needed for this follow-up.' };
  }

  // Reuse an open checkout rather than creating a second one.
  const existing = await getPaymentForFollowUp(followUpId);
  if (existing?.status === 'pending' && existing.checkoutUrl) {
    return { ok: true, checkoutUrl: existing.checkoutUrl };
  }

  const checkout = await createCheckoutForFollowUp(followUpId);
  if (!checkout.ok) return { ok: false, error: checkout.error };
  return { ok: true, checkoutUrl: checkout.redirectUrl };
}

/* ------------------------------------------------------------ staff actions */

export async function createFollowUp(input: unknown): Promise<FollowUpActionResult> {
  const actor = await requireStaff();

  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const result = await createFollowUpRecord(
    {
      clientUserId: data.clientUserId,
      serviceId: data.serviceId,
      dueDate: data.dueDate,
      preferredTime: data.preferredTime ?? null,
      mode: data.mode,
      locationId: data.locationId ?? null,
      paymentRequired: data.paymentRequired,
      // Rands in the form, cents in the datastore.
      amountCents: Math.round(data.amountRands * 100),
      reminderDate: data.reminderDate,
      channel: data.channel,
      notes: data.notes ?? null,
      sourceAppointmentId: data.sourceAppointmentId ?? null,
    },
    actor,
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/admin/follow-ups');
  revalidatePath('/admin');
  revalidatePath(`/admin/clients/${data.clientUserId}`);
  return { ok: true, followUpId: result.followUp.id };
}

export async function sendFollowUpNow(followUpId: string): Promise<FollowUpActionResult> {
  await requireStaff();
  const result = await dispatchFollowUp(followUpId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/admin/follow-ups');
  return { ok: true };
}

export async function closeFollowUp(
  followUpId: string,
  outcome: 'completed' | 'cancelled',
): Promise<FollowUpActionResult> {
  const actor = await requireStaff();
  if (outcome === 'completed') await completeFollowUp(followUpId, actor);
  else await cancelFollowUp(followUpId, actor);
  revalidatePath('/admin/follow-ups');
  revalidatePath('/admin');
  return { ok: true };
}
