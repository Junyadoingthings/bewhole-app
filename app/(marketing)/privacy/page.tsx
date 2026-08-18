import type { Metadata } from 'next';

import { LeafRule } from '@/components/site/decor';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, POLICY } from '@/config/business';

export const metadata: Metadata = {
  title: 'Privacy & POPIA',
  description:
    'What personal information Be Whole Care collects when you book, why, how long it is kept, and the rights you have over it.',
};

/**
 * This notice describes what this booking platform actually does with data.
 * Every claim maps to behaviour implemented in the codebase — nothing is
 * aspirational. Where the practice's own retention policy governs, it says so.
 */
const SECTIONS = [
  {
    id: 'what',
    title: 'What we collect',
    body: [
      'When you book, we collect your name, email address and mobile number, the service you chose, whether you are meeting online or in person, and the date and time you selected. If you write something in the "what brings you here" field, that is stored with the booking.',
      'If you choose to pay by medical aid, we also collect your scheme name, membership number and the main member’s name — only then, and only because a claim cannot be submitted without them.',
      'We do not collect your identity number, your address, or your medical history through this website.',
    ],
  },
  {
    id: 'payments',
    title: 'Payment information',
    body: [
      'Card details are never entered into this website and never reach our systems. Payments are processed on our payment provider’s own secure checkout, and we receive back only a reference, an amount and a status.',
      'We keep a record of what was paid, when, and against which appointment, because we are required to account for it.',
    ],
  },
  {
    id: 'why',
    title: 'Why we hold it',
    body: [
      'To schedule and confirm your appointment, to send you reminders and your session link, to process payment, to place the appointment on the practice calendar, and to contact you about a follow-up if one is arranged.',
      'We do not sell your information, we do not share it for advertising, and booking does not add you to a mailing list.',
    ],
  },
  {
    id: 'who',
    title: 'Who can see it',
    body: [
      'Be Whole Care practitioners and administrative staff, and only to the extent their role requires. Access is controlled by role: an administrator can manage the practice, a staff member sees what they need to run sessions.',
      'You can only ever see your own information in the client portal. Every request is checked against your signed-in identity on the server, not against anything your browser sends.',
      'Third parties involved in delivering the service — our payment provider, our email provider and the practice calendar — receive only what is necessary for their part.',
    ],
  },
  {
    id: 'clinical',
    title: 'Session notes',
    body: [
      'Clinical records are not kept in this booking system. What is stored here is administrative: scheduling, payment and communication history.',
      POLICY.confidentiality,
    ],
    list: POLICY.confidentialityLimits,
    note: 'These limits are explained to you during informed consent, before you share anything in a session.',
  },
  {
    id: 'security',
    title: 'How it is protected',
    body: [
      'The site is served over HTTPS. Sessions use signed, http-only cookies — nothing about you is readable from a cookie. Passwords, where used, are stored only as a memory-hard hash and are never recoverable.',
      'Administrative actions on client records are written to an audit log. Repeated failed sign-in attempts are rate limited.',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights under POPIA',
    body: [
      'You may ask what personal information we hold about you and request a copy. You may ask us to correct anything inaccurate. You may ask us to delete information we no longer need to keep, and you may withdraw consent to being contacted.',
      'Some records must be retained for a period after your last session to meet professional and legal obligations. Where that applies, we will tell you which records and for how long.',
    ],
  },
  {
    id: 'contact',
    title: 'Asking us about your information',
    body: [
      `Email ${BUSINESS.email} or call ${BUSINESS.phone}. Tell us what you would like to know, correct or delete, and we will come back to you.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="shell py-14 sm:py-18">
      <Reveal className="mx-auto max-w-3xl">
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-6 text-headline text-ink text-balance">
          Your information, and what we do with it.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted text-pretty">
          Counselling only works if you can be honest. This page sets out, in plain terms, what this
          booking platform collects, why, who can see it, and what you can ask us to do about it —
          in line with POPIA principles.
        </p>

        <div className="mt-14 space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-display text-2xl text-ink">{section.title}</h2>
              <LeafRule className="my-6 max-w-[8rem] justify-start" />
              {section.body.map((p, i) => (
                <p key={i} className="mb-4 leading-[1.75] text-ink-muted text-pretty">
                  {p}
                </p>
              ))}
              {section.list && (
                <ul className="mb-4 space-y-2.5">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-ink-muted">
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-forest-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.note && (
                <p className="rounded-2xl bg-cream-100 dark:bg-card p-5 text-sm leading-relaxed text-ink-muted">
                  {section.note}
                </p>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-4xl border border-line bg-white p-8">
          <h2 className="font-display text-xl text-ink">Still have a question?</h2>
          <p className="mt-3 leading-relaxed text-ink-soft text-pretty">
            Ask before you book — we would rather answer it now.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contact">Contact us</ButtonLink>
            <ButtonLink href="/terms" variant="secondary">
              Terms & conditions
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
