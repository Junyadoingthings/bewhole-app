import { formatFullDate, parts } from '@/lib/date';
import type { AppointmentView, Profile } from '@/types';

/**
 * Everything the practice knows about a client, laid out like a paper file:
 * personal details, emergency contact, medical aid, why they came, and the
 * other people who attend with them (couples, family, pre-marital sessions).
 * Staff-only — rendered on the console client page, which requires staff.
 */
export function ClientFile({
  profile,
  email,
  clientSince,
  appointments,
}: {
  profile: Profile;
  email: string;
  clientSince: string;
  appointments: AppointmentView[];
}) {
  const aid = profile.medicalAid;
  const birthDate = profile.dateOfBirth ?? aid?.dateOfBirth ?? null;

  // Newest first: every answer to "What brings you here?", with its booking.
  const reasons = appointments
    .filter((a) => a.reason?.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = [...appointments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  // Everyone who has attended with this client, once each, with their latest details.
  const companions = new Map<
    string,
    { name: string; email?: string | null; phone?: string | null; sessions: number; last: string }
  >();
  for (const a of appointments) {
    for (const p of a.participants ?? []) {
      const name = `${p.firstName} ${p.lastName}`.trim();
      const key = (p.email || name).toLowerCase();
      const seen = companions.get(key);
      if (!seen || seen.last < a.startAt) {
        companions.set(key, {
          name,
          email: p.email,
          phone: p.phone,
          sessions: (seen?.sessions ?? 0) + 1,
          last: a.startAt,
        });
      } else {
        seen.sessions += 1;
      }
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8" aria-label="Client file">
      <h2 className="font-display text-xl text-ink">Client file</h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Group title="Personal details">
          <Item label="Full name" value={`${profile.firstName} ${profile.lastName}`} />
          <Item label="Date of birth" value={birthDate ? formatFullDate(birthDate) : null} />
          <Item
            label={profile.idType === 'passport' ? 'Passport number' : 'ID number'}
            value={profile.idNumber}
            mono
          />
          <Item label="Email" value={email} href={`mailto:${email}`} />
          <Item label="Mobile" value={profile.phone} href={profile.phone ? `tel:${profile.phone}` : undefined} />
          <Item label="Address" value={profile.address} multiline />
          <Item label="Prefers" value={profile.preferredContact} capitalize />
          <Item label="Client since" value={formatFullDate(parts(clientSince).date)} />
        </Group>

        <div className="space-y-8">
          <Group title="Emergency contact">
            <Item label="Name" value={profile.emergencyContactName} />
            <Item
              label="Number"
              value={profile.emergencyContactPhone}
              href={profile.emergencyContactPhone ? `tel:${profile.emergencyContactPhone}` : undefined}
            />
          </Group>

          <Group title="Medical aid">
            {aid ? (
              <>
                <Item label="Medical aid" value={aid.name} />
                <Item label="Medical scheme" value={aid.scheme} />
                <Item label="Membership number" value={aid.memberNumber} mono />
                <Item label="Main member" value={aid.mainMember} />
                <Item label="Main member ID" value={aid.mainMemberId} mono />
                <Item label="Date of birth" value={aid.dateOfBirth ? formatFullDate(aid.dateOfBirth) : null} />
              </>
            ) : (
              <p className="text-sm text-ink-soft">No medical aid on file.</p>
            )}
          </Group>
        </div>
      </div>

      <div className="mt-8 grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
        <Group title="Why they came">
          {latest && (
            <Item
              label="Latest booking"
              value={latest.isFirstSession === false ? 'Follow-up session' : 'First session'}
            />
          )}
          {reasons.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-4">
              {reasons.map((a) => (
                <li key={a.id}>
                  <p className="text-xs text-ink-faint">
                    {formatFullDate(parts(a.createdAt).date)} · {a.service.name} · {a.reference}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Group>

        <Group title="Attending with them">
          {companions.size === 0 ? (
            <p className="text-sm text-ink-soft">Nobody else has attended with this client.</p>
          ) : (
            <ul className="space-y-4">
              {[...companions.values()].map((c) => (
                <li key={c.name + c.email} className="text-sm">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="mt-0.5 text-ink-soft">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {c.sessions} {c.sessions === 1 ? 'session' : 'sessions'} · latest{' '}
                    {formatFullDate(parts(c.last).date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Group>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
        {title}
      </h3>
      <dl className="mt-3 space-y-2.5">{children}</dl>
    </div>
  );
}

function Item({
  label,
  value,
  href,
  mono,
  multiline,
  capitalize,
}: {
  label: string;
  value?: string | null;
  href?: string;
  mono?: boolean;
  multiline?: boolean;
  capitalize?: boolean;
}) {
  const shown = value?.toString().trim();
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 text-sm">
      <dt className="text-ink-faint">{label}</dt>
      <dd
        className={[
          shown ? 'text-ink' : 'text-ink-faint',
          mono && shown ? 'font-mono' : '',
          multiline ? 'whitespace-pre-line' : '',
          capitalize ? 'capitalize' : '',
          'break-words',
        ].join(' ')}
      >
        {shown ? (
          href ? (
            <a href={href} className="hover:text-forest-700 hover:underline">
              {shown}
            </a>
          ) : (
            shown
          )
        ) : (
          'Not captured'
        )}
      </dd>
    </div>
  );
}
