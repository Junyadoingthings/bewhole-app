import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { listDueNotificationLogs, markNotificationLogResult, pruneExpiredSessions } from '@/lib/db';
import { sendQueued } from '@/services/notifications';
import { dispatchFollowUp, pendingReminders } from '@/services/followup.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Reminder worker.
 *
 * Runs on a schedule (Vercel Cron, or any external scheduler hitting this URL).
 * It does two things:
 *
 *   1. Dispatches follow-up reminders whose reminder date has arrived — this is
 *      what sends the client their payment request.
 *   2. Sends notifications that were queued for the future: the 24-hour and
 *      2-hour appointment reminders and the post-session check-in.
 *
 * Each queued row carries its own rendered body, so this worker never has to
 * reconstruct a message — it sends exactly what was composed at booking time
 * and records the outcome against the row.
 *
 * Authorisation is a shared secret compared in constant time. With no
 * CRON_SECRET configured the route refuses outright rather than running open.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  /**
   * Expired sessions used to be swept on every sign-in, which meant every
   * person logging in waited for a table scan. It belongs on a schedule, and
   * failing to prune must never fail the run — reminders matter more than
   * tidiness.
   */
  let sessionsPruned = 0;
  try {
    sessionsPruned = await pruneExpiredSessions();
  } catch (error) {
    console.error('[bwc:cron] session prune failed', error);
  }

  /* ---------------------------------------------------- follow-up reminders */
  const dueFollowUps = await pendingReminders();
  const followUpResults: { followUpId: string; ok: boolean; error?: string }[] = [];

  for (const followUp of dueFollowUps) {
    try {
      const result = await dispatchFollowUp(followUp.id);
      followUpResults.push({
        followUpId: followUp.id,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
      });
    } catch (error) {
      // One bad follow-up must not stop the rest of the run.
      followUpResults.push({
        followUpId: followUp.id,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /* ------------------------------------------------------- queued messages */
  const due = await listDueNotificationLogs(200);
  let sent = 0;
  let failed = 0;

  for (const log of due) {
    try {
      const result = await sendQueued({
        channel: log.channel,
        to: log.to,
        subject: log.subject,
        body: log.body,
      });
      await markNotificationLogResult(log.id, result);
      result.ok ? sent++ : failed++;
    } catch (error) {
      await markNotificationLogResult(log.id, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    followUps: { due: dueFollowUps.length, results: followUpResults },
    messages: { due: due.length, sent, failed },
  });
}
