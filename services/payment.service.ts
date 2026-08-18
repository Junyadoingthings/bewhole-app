import 'server-only';

import {
  audit,
  createPayment,
  getAppointment,
  getFollowUp,
  getPayment,
  getPaymentByCheckoutId,
  getPaymentForAppointment,
  getService,
  getProfile,
  findUserById,
  newId,
  nowISO,
  recordPaymentEvent,
  updateAppointment,
  updatePayment,
} from '@/lib/db';
import { emit } from '@/services/events';
import { getPaymentProvider } from '@/services/payments';
import type { ID, Payment } from '@/types';

/**
 * Payment orchestration.
 *
 * The single rule this module exists to enforce: a booking is only ever marked
 * paid as a result of a server-to-server confirmation. The browser can tell us
 * it came back from a successful checkout, but that only triggers a fresh
 * verifyCheckout call against the provider — it is never itself the evidence.
 */

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:5600';
}

/* ------------------------------------------------------------ appointments */

export async function createCheckoutForAppointment(
  appointmentId: ID,
): Promise<{ ok: true; paymentId: ID; redirectUrl: string } | { ok: false; error: string }> {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'Appointment not found' };
  if (appointment.amountCents <= 0) return { ok: false, error: 'Nothing to pay' };

  // Reuse a live checkout rather than creating a second one for the same session.
  const existing = await getPaymentForAppointment(appointmentId);
  if (existing && existing.status === 'pending' && existing.checkoutUrl) {
    return { ok: true, paymentId: existing.id, redirectUrl: existing.checkoutUrl };
  }

  const service = await getService(appointment.serviceId);
  const [client, clientProfile] = await Promise.all([
    findUserById(appointment.clientUserId),
    getProfile(appointment.clientUserId),
  ]);
  const provider = getPaymentProvider();
  const paymentId = newId('pay');
  const ts = nowISO();

  const payment: Payment = {
    id: paymentId,
    appointmentId,
    clientUserId: appointment.clientUserId,
    amountCents: appointment.amountCents,
    currency: 'ZAR',
    method: appointment.paymentMethod,
    status: 'pending',
    provider: provider.name,
    providerCheckoutId: null,
    checkoutUrl: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await createPayment(payment);

  try {
    const checkout = await provider.createCheckout({
      amountCents: appointment.amountCents,
      currency: 'ZAR',
      reference: paymentId,
      description: `${service?.name ?? 'Session'} — ${appointment.reference}`,
      successUrl: `${appUrl()}/book/confirmation?ref=${appointment.reference}&payment=${paymentId}`,
      cancelUrl: `${appUrl()}/portal/appointments/${appointmentId}?payment=cancelled`,
      failureUrl: `${appUrl()}/portal/appointments/${appointmentId}?payment=failed`,
      webhookUrl: `${appUrl()}/api/payments/webhook`,
      customerEmail: client?.email ?? null,
      customerFirstName: clientProfile?.firstName ?? null,
      customerLastName: clientProfile?.lastName ?? null,
      metadata: {
        appointmentId,
        paymentId,
        reference: appointment.reference,
      },
    });

    await updatePayment(paymentId, {
      providerCheckoutId: checkout.checkoutId,
      checkoutUrl: checkout.redirectUrl,
    });
    await recordPaymentEvent(paymentId, 'checkout.created', {
      checkoutId: checkout.checkoutId,
      provider: provider.name,
    });

    return { ok: true, paymentId, redirectUrl: checkout.redirectUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start payment';
    await updatePayment(paymentId, { status: 'failed', failureReason: message });
    await recordPaymentEvent(paymentId, 'checkout.failed', { message });
    return { ok: false, error: message };
  }
}

/**
 * Start an in-page payment for an appointment.
 *
 * Same server-side setup as the redirect flow — a payment row, a gateway
 * checkout — but returns what the browser needs to mount the gateway's card
 * fields inside our own page instead of navigating away.
 */
export async function createEmbeddedCheckoutForAppointment(
  appointmentId: ID,
): Promise<
  | { ok: true; paymentId: ID; embedded: import('@/services/payments').EmbeddedCheckout }
  | { ok: false; error: string }
> {
  const provider = getPaymentProvider();
  if (!provider.supportsEmbedded || !provider.createEmbeddedCheckout) {
    return { ok: false, error: 'This gateway does not support in-page payment' };
  }

  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'Appointment not found' };
  if (appointment.amountCents <= 0) return { ok: false, error: 'Nothing to pay' };

  const [service, client, clientProfile] = await Promise.all([
    getService(appointment.serviceId),
    findUserById(appointment.clientUserId),
    getProfile(appointment.clientUserId),
  ]);

  const paymentId = newId('pay');
  const ts = nowISO();

  await createPayment({
    id: paymentId,
    appointmentId,
    clientUserId: appointment.clientUserId,
    amountCents: appointment.amountCents,
    currency: 'ZAR',
    method: appointment.paymentMethod,
    status: 'pending',
    provider: provider.name,
    createdAt: ts,
    updatedAt: ts,
  });

  try {
    const embedded = await provider.createEmbeddedCheckout({
      amountCents: appointment.amountCents,
      currency: 'ZAR',
      reference: paymentId,
      description: `${service?.name ?? 'Session'} — ${appointment.reference}`,
      successUrl: `${appUrl()}/book/confirmation?ref=${appointment.reference}&payment=${paymentId}`,
      cancelUrl: `${appUrl()}/portal/appointments/${appointmentId}?payment=cancelled`,
      failureUrl: `${appUrl()}/portal/appointments/${appointmentId}?payment=failed`,
      webhookUrl: `${appUrl()}/api/payments/webhook`,
      customerEmail: client?.email ?? null,
      customerFirstName: clientProfile?.firstName ?? null,
      customerLastName: clientProfile?.lastName ?? null,
      metadata: { appointmentId, paymentId, reference: appointment.reference },
    });

    await updatePayment(paymentId, { providerCheckoutId: embedded.checkoutId });
    await recordPaymentEvent(paymentId, 'checkout.created', {
      checkoutId: embedded.checkoutId,
      provider: provider.name,
      mode: 'embedded',
    });

    return { ok: true, paymentId, embedded };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start payment';
    await updatePayment(paymentId, { status: 'failed', failureReason: message });
    await recordPaymentEvent(paymentId, 'checkout.failed', { message });
    return { ok: false, error: message };
  }
}

/* -------------------------------------------------------------- follow-ups */

export async function createCheckoutForFollowUp(
  followUpId: ID,
): Promise<{ ok: true; paymentId: ID; redirectUrl: string } | { ok: false; error: string }> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp) return { ok: false, error: 'Follow-up not found' };
  if (!followUp.paymentRequired || followUp.amountCents <= 0)
    return { ok: false, error: 'This follow-up does not require payment' };

  const service = await getService(followUp.serviceId);
  const [fuClient, fuProfile] = await Promise.all([
    findUserById(followUp.clientUserId),
    getProfile(followUp.clientUserId),
  ]);
  const provider = getPaymentProvider();
  const paymentId = newId('pay');
  const ts = nowISO();

  await createPayment({
    id: paymentId,
    followUpId,
    clientUserId: followUp.clientUserId,
    amountCents: followUp.amountCents,
    currency: 'ZAR',
    method: 'card',
    status: 'pending',
    provider: provider.name,
    createdAt: ts,
    updatedAt: ts,
  });

  try {
    const checkout = await provider.createCheckout({
      amountCents: followUp.amountCents,
      currency: 'ZAR',
      reference: paymentId,
      description: `Follow-up — ${service?.name ?? 'Session'}`,
      successUrl: `${appUrl()}/portal/follow-ups?payment=${paymentId}`,
      cancelUrl: `${appUrl()}/portal/follow-ups?payment=cancelled`,
      failureUrl: `${appUrl()}/portal/follow-ups?payment=failed`,
      webhookUrl: `${appUrl()}/api/payments/webhook`,
      customerEmail: fuClient?.email ?? null,
      customerFirstName: fuProfile?.firstName ?? null,
      customerLastName: fuProfile?.lastName ?? null,
      metadata: { followUpId, paymentId, reference: paymentId },
    });

    await updatePayment(paymentId, {
      providerCheckoutId: checkout.checkoutId,
      checkoutUrl: checkout.redirectUrl,
    });
    await recordPaymentEvent(paymentId, 'checkout.created', { checkoutId: checkout.checkoutId });
    return { ok: true, paymentId, redirectUrl: checkout.redirectUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start payment';
    await updatePayment(paymentId, { status: 'failed', failureReason: message });
    return { ok: false, error: message };
  }
}

/* ----------------------------------------------------------- verification */

/**
 * Ask the provider what actually happened, then apply the result.
 *
 * Idempotent: calling it twice on a paid payment is a no-op, so the return
 * redirect, a webhook and a manual retry can all race safely.
 */
export async function verifyAndApplyPayment(
  paymentId: ID,
): Promise<{ status: Payment['status']; changed: boolean }> {
  const payment = await getPayment(paymentId);
  if (!payment) return { status: 'failed', changed: false };
  if (payment.status === 'paid' || payment.status === 'refunded') {
    return { status: payment.status, changed: false };
  }
  if (!payment.providerCheckoutId) return { status: payment.status, changed: false };

  const provider = getPaymentProvider();
  let result;
  try {
    result = await provider.verifyCheckout(payment.providerCheckoutId);
  } catch (error) {
    await recordPaymentEvent(paymentId, 'verify.error', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { status: payment.status, changed: false };
  }

  await recordPaymentEvent(paymentId, `verify.${result.state}`, {
    providerPaymentId: result.providerPaymentId ?? null,
  });

  if (result.state === 'paid') {
    // Guard against an amount mismatch between our record and the provider's.
    if (typeof result.amountCents === 'number' && result.amountCents !== payment.amountCents) {
      await recordPaymentEvent(paymentId, 'verify.amount_mismatch', {
        expected: payment.amountCents,
        received: result.amountCents,
      });
      await updatePayment(paymentId, {
        status: 'failed',
        failureReason: 'Amount mismatch reported by provider',
      });
      return { status: 'failed', changed: true };
    }
    await applyPaymentSuccess(paymentId);
    return { status: 'paid', changed: true };
  }

  if (result.state === 'failed' || result.state === 'cancelled') {
    await updatePayment(paymentId, {
      status: result.state === 'failed' ? 'failed' : 'cancelled',
      failureReason: result.failureReason ?? null,
    });
    if (payment.appointmentId) {
      await emit({
        type: 'payment.failed',
        paymentId,
        appointmentId: payment.appointmentId,
        reason: result.failureReason ?? undefined,
      });
    }
    return { status: result.state === 'failed' ? 'failed' : 'cancelled', changed: true };
  }

  if (result.state === 'processing' && payment.status !== 'processing') {
    await updatePayment(paymentId, { status: 'processing' });
    return { status: 'processing', changed: true };
  }

  return { status: payment.status, changed: false };
}

/** The one place a payment becomes 'paid' and a booking becomes confirmed. */
export async function applyPaymentSuccess(paymentId: ID) {
  const payment = await getPayment(paymentId);
  if (!payment || payment.status === 'paid') return;

  await updatePayment(paymentId, { status: 'paid', paidAt: nowISO() });
  await audit({
    actorUserId: payment.clientUserId,
    action: 'payment.success',
    entity: 'payment',
    entityId: paymentId,
    meta: { amountCents: payment.amountCents },
  });

  if (payment.appointmentId) {
    const appointment = await getAppointment(payment.appointmentId);
    if (appointment && appointment.status === 'pending_payment') {
      await updateAppointment(appointment.id, { status: 'confirmed' });
      await emit({ type: 'appointment.confirmed', appointmentId: appointment.id });
    }
  }

  if (payment.followUpId) {
    const { confirmFollowUpPayment } = await import('@/services/followup.service');
    await confirmFollowUpPayment(payment.followUpId);
  }
}

/**
 * Webhook entry point. Signature is verified before anything is written.
 *
 * The two gateways need different treatment after that:
 *
 *  - Peach exposes a status endpoint, so a verified webhook is only a nudge:
 *    we re-read the truth from Peach and never trust the payload's own claim.
 *  - Payfast has no status lookup on the standard plan, and its ITN is already
 *    double-checked (signature, then posted back to Payfast which must answer
 *    "VALID"). There the notification IS the authority — so we additionally
 *    require the amount to match what we asked for before marking it paid.
 */
export async function handleProviderWebhook(rawBody: string, headers: Headers) {
  const provider = getPaymentProvider();
  const verification = await provider.verifyWebhook(rawBody, headers);

  if (!verification.valid) {
    return { ok: false, status: 401, reason: verification.reason ?? 'Invalid signature' };
  }

  // Peach echoes a checkout id; Payfast echoes our own payment id.
  const payment =
    (verification.checkoutId ? await getPaymentByCheckoutId(verification.checkoutId) : null) ??
    (verification.reference ? await getPayment(verification.reference) : null);

  if (!payment) return { ok: true, status: 200, reason: 'Unknown payment — ignored' };

  await recordPaymentEvent(payment.id, `webhook.${verification.state ?? 'unknown'}`, {
    provider: provider.name,
    providerPaymentId: verification.providerPaymentId ?? null,
  });

  if (provider.name === 'payfast') {
    if (verification.state !== 'paid') {
      if (verification.state === 'cancelled') {
        await updatePayment(payment.id, { status: 'cancelled' });
      }
      return { ok: true, status: 200, reason: `recorded ${verification.state}` };
    }

    // Never accept a payment for less than the session costs.
    if (
      typeof verification.amountCents === 'number' &&
      verification.amountCents !== payment.amountCents
    ) {
      await recordPaymentEvent(payment.id, 'webhook.amount_mismatch', {
        expected: payment.amountCents,
        received: verification.amountCents,
      });
      await updatePayment(payment.id, {
        status: 'failed',
        failureReason: 'Amount received did not match the amount due',
      });
      return { ok: true, status: 200, reason: 'amount mismatch' };
    }

    await updatePayment(payment.id, {
      providerPaymentId: verification.providerPaymentId ?? null,
    });
    await applyPaymentSuccess(payment.id);
    return { ok: true, status: 200, reason: 'processed' };
  }

  // Peach: re-read status from the provider rather than trusting the payload.
  await verifyAndApplyPayment(payment.id);
  return { ok: true, status: 200, reason: 'processed' };
}

export async function refundPayment(paymentId: ID, actorUserId: ID) {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };
  if (payment.status !== 'paid') return { ok: false, error: 'Only a paid payment can be refunded' };
  if (!payment.providerPaymentId) return { ok: false, error: 'No provider reference to refund' };

  const provider = getPaymentProvider();
  const result = await provider.refund(payment.providerPaymentId, payment.amountCents);
  if (!result.ok) return { ok: false, error: result.error ?? 'Refund declined by provider' };

  await updatePayment(paymentId, { status: 'refunded' });
  await recordPaymentEvent(paymentId, 'refund.success', { amountCents: payment.amountCents });
  await audit({
    actorUserId,
    action: 'payment.refunded',
    entity: 'payment',
    entityId: paymentId,
    meta: { amountCents: payment.amountCents },
  });
  return { ok: true };
}

/** Staff marking a medical-aid co-payment or EFT as received. */
export async function markPaymentReceivedManually(paymentId: ID, actorUserId: ID) {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };
  await updatePayment(paymentId, { provider: 'manual' });
  await recordPaymentEvent(paymentId, 'manual.marked_paid', { by: actorUserId });
  await applyPaymentSuccess(paymentId);
  return { ok: true };
}
