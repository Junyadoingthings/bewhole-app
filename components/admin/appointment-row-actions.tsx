'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RefreshCw,
  Check,
  Link2,
  MoreHorizontal,
  Send,
  UserX,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Label, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  resendConfirmation,
  retryCalendarSync,
  setAppointmentStatus,
  setSessionLink,
  staffCancelAppointment,
} from '@/app/actions/admin';
import type { AppointmentStatus } from '@/types';

export function AppointmentRowActions({
  appointmentId,
  clientUserId,
  status,
  mode,
  sessionLink,
}: {
  appointmentId: string;
  clientUserId: string;
  status: AppointmentStatus;
  mode: 'online' | 'in_person';
  sessionLink: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [link, setLink] = React.useState(sessionLink ?? '');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    setOpen(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'That didn’t work', description: result.error });
      return false;
    }
    toast({ tone: 'success', title: success });
    router.refresh();
    return true;
  }

  const canComplete = status === 'confirmed';
  const canCancel = status === 'confirmed' || status === 'pending_payment';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-forest-300 hover:text-ink"
        aria-label="Appointment actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-float"
          >
            <MenuLink href={`/admin/clients/${clientUserId}`} icon={<Check className="h-4 w-4" />}>
              Open client
            </MenuLink>

            {canComplete && (
              <MenuButton
                icon={<Check className="h-4 w-4" />}
                onClick={() =>
                  run(() => setAppointmentStatus(appointmentId, 'completed'), 'Marked complete')
                }
                disabled={busy}
              >
                Mark complete
              </MenuButton>
            )}
            {canComplete && (
              <MenuButton
                icon={<UserX className="h-4 w-4" />}
                onClick={() =>
                  run(() => setAppointmentStatus(appointmentId, 'no_show'), 'Marked as missed')
                }
                disabled={busy}
              >
                Mark as missed
              </MenuButton>
            )}
            {mode === 'online' && (
              <MenuButton icon={<Link2 className="h-4 w-4" />} onClick={() => setLinkOpen(true)}>
                {sessionLink ? 'Edit session link' : 'Add session link'}
              </MenuButton>
            )}
            <MenuButton
              icon={<Send className="h-4 w-4" />}
              onClick={() => run(() => resendConfirmation(appointmentId), 'Confirmation resent')}
              disabled={busy}
            >
              Resend confirmation
            </MenuButton>
            <MenuButton
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => run(() => retryCalendarSync(appointmentId), 'Calendar synced')}
              disabled={busy}
            >
              Retry calendar sync
            </MenuButton>

            {canCancel && (
              <>
                <div className="my-1 h-px bg-line" />
                <MenuButton
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => setCancelOpen(true)}
                  danger
                >
                  Cancel appointment
                </MenuButton>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Session link"
        description="Paste the meeting link for this online session. The client sees it on their appointment and in their reminder."
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              full
              loading={busy}
              onClick={async () => {
                const ok = await run(() => setSessionLink(appointmentId, link), 'Session link saved');
                if (ok) setLinkOpen(false);
              }}
            >
              Save link
            </Button>
          </div>
        }
      >
        <Label htmlFor="session-link">Meeting link</Label>
        <Input
          id="session-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://meet.google.com/…"
          data-autofocus
        />
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this appointment?"
        description="The client is notified, the time is released and the calendar event is removed."
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              full
              loading={busy}
              onClick={async () => {
                const ok = await run(
                  () => staffCancelAppointment(appointmentId, reason || undefined),
                  'Appointment cancelled',
                );
                if (ok) setCancelOpen(false);
              }}
            >
              Cancel appointment
            </Button>
          </div>
        }
      >
        <Label htmlFor="staff-cancel-reason" optional>
          Reason for the client
        </Label>
        <Textarea
          id="staff-cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Included in the message they receive."
          data-autofocus
        />
      </Modal>
    </div>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
        danger ? 'text-state-danger hover:bg-state-dangerSoft' : 'text-ink hover:bg-cream-100 dark:hover:bg-card'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MenuLink({
  children,
  icon,
  href,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-cream-100 dark:hover:bg-card"
    >
      {icon}
      {children}
    </Link>
  );
}
