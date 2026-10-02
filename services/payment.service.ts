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
  listPaymentEvents,
  findUserById,
  newId,
  nowISO,
  recordPaymentEvent,
  updateAppointment,
  updatePayment,
} from '@/lib/db';
import { emitAfterResponse } from '@/services/events';
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
      emitAfterResponse({
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
      emitAfterResponse({ type: 'appointment.confirmed', appointmentId: appointment.id });
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
/* ------------------------------------------------------------------ ledger */
/**
 * Every rand that reaches the practice has a line on the Payments page.
 *
 * Card checkouts make their own line (createCheckoutForAppointment). The
 * money that does not pass through a checkout gets one here:
 *   - an accepted medical aid claim, awaiting the scheme's payment;
 *   - a declined medical aid session, now payable by the client (Yoco link);
 *   - a card session booked while no gateway is connected, payable directly;
 *   - anything the practice takes directly (EFT, cash, a quoted fee).
 * These are 'manual' lines: the practice ticks them off when the money
 * arrives, entering the amount actually received.
 */

/** Opens an awaiting line for a booking, unless it already has one. */
export async function openLedgerEntry(
  appointmentId: ID,
  method: Payment['method'],
  expectedCents: number,
): Promise<Payment | null> {
  if (expectedCents <= 0) return null;
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return null;
  const existing = await getPaymentForAppointment(appointmentId);
  // A live or settled line already covers this booking; a failed or
  // cancelled checkout does not, so a new line is opened after one.
  if (existing && ['pending', 'processing', 'paid'].includes(existing.status)) return existing;

  const ts = nowISO();
  const payment: Payment = {
    id: newId('pay'),
    appointmentId,
    clientUserId: appointment.clientUserId,
    amountCents: expectedCents,
    currency: 'ZAR',
    method,
    status: 'pending',
    provider: 'manual',
    providerCheckoutId: null,
    checkoutUrl: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await createPayment(payment);
  await recordPaymentEvent(payment.id, 'ledger.opened', { method, expectedCents });
  return payment;
}

/**
 * The practice has the money: record the amount actually received and the
 * day it arrived. A booking still waiting on this payment is confirmed (and
 * the client emailed) exactly as a card payment would.
 */
export async function recordPaymentReceived(
  paymentId: ID,
  input: { amountCents: number; receivedOn: string },
  actorUserId: ID,
) {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };
  if (payment.status === 'paid') return { ok: false, error: 'This payment is already marked as received.' };
  if (payment.status === 'refunded') return { ok: false, error: 'This payment was refunded.' };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Enter the amount received.' };
  }
  // Copied before the update: a data layer may hand back the live record,
  // which the update would change underneath us.
  const expectedCents = payment.amountCents;
  const method = payment.method;

  await updatePayment(paymentId, { amountCents: input.amountCents, provider: 'manual', failureReason: null });
  await recordPaymentEvent(paymentId, 'manual.received', {
    by: actorUserId,
    expectedCents,
    receivedCents: input.amountCents,
    receivedOn: input.receivedOn,
  });
  await applyPaymentSuccess(paymentId);
  // The day the money arrived, not the moment it was ticked off.
  await updatePayment(paymentId, { paidAt: new Date(`${input.receivedOn}T10:00:00+02:00`).toISOString() });
  await audit({
    actorUserId,
    action: 'payment.received',
    entity: 'payment',
    entityId: paymentId,
    meta: { method, receivedCents: input.amountCents, receivedOn: input.receivedOn },
  });
  return { ok: true };
}

/** The money is not coming, e.g. the scheme declined the claim. */
export async function recordPaymentNotReceived(paymentId: ID, reason: string, actorUserId: ID) {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };
  if (payment.status === 'paid') return { ok: false, error: 'Undo the received payment first.' };
  await updatePayment(paymentId, { status: 'failed', failureReason: reason || 'Not received' });
  await recordPaymentEvent(paymentId, 'manual.not_received', { by: actorUserId, reason });
  await audit({ actorUserId, action: 'payment.not_received', entity: 'payment', entityId: paymentId, meta: { reason } });
  return { ok: true };
}

/** A mistaken tick: back to awaiting. Only for lines ticked off by hand. */
export async function undoPaymentReceived(paymentId: ID, actorUserId: ID) {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };
  if (payment.provider !== 'manual') {
    return { ok: false, error: 'Card payments are confirmed by the provider; use Refund instead.' };
  }
  // Copied before the update (see recordPaymentReceived).
  const previous = payment.status;
  if (previous !== 'paid' && previous !== 'failed') {
    return { ok: false, error: 'This payment is not marked as received or not paid.' };
  }
  // Back to the amount that was expected before the received amount replaced it.
  const events = await listPaymentEvents(paymentId);
  const lastReceived = [...events].reverse().find((e) => e.type === 'manual.received');
  const expected = Number(lastReceived?.payload?.expectedCents);
  await updatePayment(paymentId, {
    status: 'pending',
    paidAt: null,
    failureReason: null,
    ...(previous === 'paid' && Number.isInteger(expected) && expected > 0 ? { amountCents: expected } : {}),
  });
  await recordPaymentEvent(paymentId, 'manual.undone', { by: actorUserId, previous });
  await audit({ actorUserId, action: 'payment.undone', entity: 'payment', entityId: paymentId });
  return { ok: true };
}

/** Money taken directly for a booking (EFT, cash, a quoted fee), recorded as received. */
export async function recordDirectPayment(
  appointmentId: ID,
  input: { amountCents: number; method: Payment['method']; receivedOn: string },
  actorUserId: ID,
) {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'Appointment not found' };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Enter the amount received.' };
  }
  const ts = nowISO();
  const payment: Payment = {
    id: newId('pay'),
    appointmentId,
    clientUserId: appointment.clientUserId,
    amountCents: input.amountCents,
    currency: 'ZAR',
    method: input.method,
    status: 'pending',
    provider: 'manual',
    providerCheckoutId: null,
    checkoutUrl: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await createPayment(payment);
  await recordPaymentEvent(payment.id, 'ledger.recorded', { by: actorUserId });
  return recordPaymentReceived(payment.id, input, actorUserId);
}
