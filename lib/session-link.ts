import { CLIENT_EMAIL } from '@/config/business';

/**
 * The link a client uses to join an online session, or null.
 *
 * Only for a confirmed online booking — the practice gives the link out only
 * after payment or once the medical aid is accepted. A link staff set on the
 * appointment takes precedence over the practice's session room.
 */
export function joinLinkFor(appointment: {
  mode: string;
  status: string;
  sessionLink?: string | null;
}): string | null {
  if (appointment.mode !== 'online' || appointment.status !== 'confirmed') return null;
  return appointment.sessionLink || CLIENT_EMAIL.onlineSessionLink;
}
