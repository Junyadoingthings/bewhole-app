import type { Metadata } from 'next';

import { LeafRule } from '@/components/site/decor';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, POLICY } from '@/config/business';

export const metadata: Metadata = {
  title: 'Terms & conditions',
  description:
    'Nature of services, eligibility, appointments, payment and medical aid, cancellations and confidentiality.',
};

/** Transcribed from the practice's published terms. Wording is not paraphrased. */
const SECTIONS = [
  {
    id: 'nature',
    title: 'Nature of services',
    paragraphs: [POLICY.nature],
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    paragraphs: [POLICY.eligibility],
  },
  {
    id: 'appointments',
    title: 'Appointments and sessions',
    list: [
      'Sessions are offered online or in person.',
      'Sessions are scheduled by appointment only and begin and end at the agreed time.',
      'Appointments can be scheduled on the website or using the contact details provided.',
      'Sessions are 60 minutes long.',
    ],
  },
  {
    id: 'payment',
    title: 'Payment and medical aid',
    paragraphs: [
      'Be Whole Care accepts medical aid (subject to available benefits and scheme rules) and card payments via a secure online payment link.',
      POLICY.cardPayments,
    ],
    // The published rate card was removed from the site: fees are quoted
    // during booking, where the service, the mode and any medical aid
    // arrangement are known. A co-payment would be stated here as a term of
    // service; there is none now, so its empty policy text is filtered out
    // rather than rendered as a blank paragraph.
    after: [POLICY.medicalAid, POLICY.medicalAidCoPayment].filter(Boolean),
    note: 'Failure to settle any applicable fees may result in the appointment being postponed or rescheduled.',
  },
  {
    id: 'cancellations',
    title: 'Cancellations & missed appointments',
    list: [
      'Cancellations must be made at least 24 hours before the scheduled session.',
      'Late cancellations or missed appointments may be charged in full.',
      'Exceptions may be considered in cases of genuine emergency.',
    ],
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality',
    paragraphs: [
      'All sessions are confidential and handled in accordance with ethical and legal requirements. Confidentiality may be limited where there is:',
    ],
    list: POLICY.confidentialityLimits,
    note: 'These limits will be explained during the informed consent process.',
  },
];

export default function TermsPage() {
  return (
    <div className="shell py-14 sm:py-18">
      <Reveal className="mx-auto max-w-3xl">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-6 text-headline text-ink text-balance">Terms & conditions</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted text-pretty">
          These terms govern counselling, wellness support, psychoeducation and related services
          provided by {BUSINESS.legalName}.
        </p>

        <nav className="mt-10 rounded-3xl border border-line bg-cream-50 dark:bg-canvas p-6" aria-label="On this page">
          <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            On this page
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-14 space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-display text-2xl text-ink">{section.title}</h2>
              <LeafRule className="my-6 max-w-[8rem] justify-start" />

              {section.paragraphs?.map((p, i) => (
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

              {section.after?.map((p, i) => (
                <p key={i} className="mb-4 leading-[1.75] text-ink-muted text-pretty">
                  {p}
                </p>
              ))}

              {section.note && (
                <p className="rounded-2xl bg-cream-100 dark:bg-card p-5 text-sm leading-relaxed text-ink-muted">
                  {section.note}
                </p>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-4xl border border-line bg-white p-8">
          <h2 className="font-display text-xl text-ink">Questions about any of this?</h2>
          <p className="mt-3 leading-relaxed text-ink-soft text-pretty">
            Call or WhatsApp {BUSINESS.phone}, or email {BUSINESS.email}. It is always better to ask
            before booking than to be uncertain during a session.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contact">Contact us</ButtonLink>
            <ButtonLink href="/privacy" variant="secondary">
              Privacy notice
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
