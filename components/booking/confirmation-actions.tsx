'use client';

import * as React from 'react';
import { Apple, CalendarPlus, Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { googleCalendarUrl, icsPayload } from '@/lib/date';

/**
 * "Add to calendar" for the client's own diary.
 *
 * Separate from the practice's Google Calendar sync, which happens server-side
 * on confirmation — this is purely a convenience for the person booking.
 */
export function ConfirmationActions({
  appointment,
}: {
  appointment: {
    id: string;
    title: string;
    start: string;
    end: string;
    location: string;
    details: string;
    reference: string;
  };
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  function downloadIcs() {
    const payload = icsPayload({ uid: appointment.id, ...appointment });
    const blob = new Blob([payload], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `be-whole-care-${appointment.reference}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ tone: 'success', title: 'Calendar file downloaded' });
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(appointment.reference);
      setCopied(true);
      toast({ tone: 'success', title: 'Reference copied' });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({ tone: 'error', title: 'Could not copy', description: 'Please copy it manually.' });
    }
  }

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <a
        href={googleCalendarUrl(appointment)}
        target="_blank"
        rel="noreferrer noopener"
        className="flex h-13 items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-5 text-sm font-medium text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-subtle"
      >
        <CalendarPlus className="h-4 w-4 text-forest-600 dark:text-forest-300" />
        Google Calendar
      </a>

      <Button variant="secondary" size="lg" onClick={downloadIcs}>
        <Apple className="h-4 w-4" />
        Apple / Outlook
      </Button>

      <Button variant="secondary" size="lg" onClick={copyReference}>
        {copied ? <Check className="h-4 w-4 text-forest-600 dark:text-forest-300" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy reference'}
      </Button>
    </div>
  );
}
