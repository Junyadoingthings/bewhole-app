import 'server-only';

import { hashPassword } from '@/lib/auth/password';
import { BUSINESS, BUSINESS_HOURS, LOCATIONS, POLICY, RATES, SESSION_DEFAULTS } from '@/config/business';
import { addISODays, fromLocalParts, today } from '@/lib/date';
import type { Database } from './store';
import type {
  Appointment,
  ClientNote,
  FollowUp,
  Payment,
  Profile,
  Settings,
  User,
} from '@/types';

/**
 * Seed data.
 *
 * Catalogue content (categories, services, locations, hours, rates, policy) is
 * transcribed from the live Be Whole Care site and is REAL.
 *
 * Clients, appointments, payments, follow-ups and notes are fabricated demo
 * records so the dashboards have something to render. Every one of them carries
 * `isDemo: true` and the UI labels them as demo data. No testimonials, no
 * invented practitioners, no invented qualifications.
 */

const DEMO_PASSWORD = 'Wholeness2026!';

const nowISO = () => new Date().toISOString();

/* ------------------------------------------------------------- catalogue */

export const SERVICE_CATEGORIES = [
  {
    id: 'cat_individual',
    slug: 'individual-counselling',
    name: 'Individual Counselling',
    summary: 'One-to-one support for the weight you have been carrying on your own.',
    description:
      'A confidential space to work through what is happening in your life right now — with someone whose only job in that hour is to listen well and help you find your footing again. Sessions run for 60 minutes, online or in person.',
    areas: [
      'Stress & burnout',
      'Emotional regulation',
      'Self-esteem & identity',
      'Life transitions & decision-making',
      'Personal growth & purpose',
      "Women's wellness",
    ],
    concerns: ['stress', 'emotional-wellbeing', 'personal-growth'],
    icon: 'Sprout',
    accent: 'forest' as const,
    order: 1,
    active: true,
  },
  {
    id: 'cat_family',
    slug: 'marriage-and-family-counselling',
    name: 'Marriage & Family Counselling',
    summary: 'For the conversations that keep going in circles at home.',
    description:
      'Couples and families come with different versions of the same story. These sessions create room for each version to be heard, and build the practical communication skills that make the next hard conversation less costly.',
    areas: [
      'Family counselling',
      "Couple's counselling",
      'Conflict resolution & communication skills',
      'Divorce & separation support',
    ],
    concerns: ['relationships', 'family'],
    icon: 'HeartHandshake',
    accent: 'clay' as const,
    order: 2,
    active: true,
  },
  {
    id: 'cat_trauma',
    slug: 'trauma-grief-and-healing',
    name: 'Trauma, Grief & Healing',
    summary: 'Unhurried, careful support for what still hurts.',
    description:
      'Grief and trauma do not keep to a schedule. This work moves at the pace you set, with care taken not to reopen more than can be held in a single session.',
    areas: [
      'Trauma & Post Traumatic Stress Disorder (PTSD)',
      'Grief, bereavement & loss',
      'Childhood wounds & inner healing',
      'Abuse recovery (emotional, physical & sexual)',
    ],
    concerns: ['trauma', 'emotional-wellbeing'],
    icon: 'Feather',
    accent: 'forest' as const,
    order: 3,
    active: true,
  },
  {
    id: 'cat_workplace',
    slug: 'workplace-stress-management',
    name: 'Workplace Stress Management',
    summary: 'When work has started following you home.',
    description:
      'Support for the point where the demands of a job stop being manageable — including the particular exhaustion that comes from caring for others professionally.',
    areas: ['Work-life balance support', 'Career guidance', 'Compassion fatigue & caregiver support'],
    concerns: ['work', 'career', 'stress'],
    icon: 'Briefcase',
    accent: 'cream' as const,
    order: 4,
    active: true,
  },
  {
    id: 'cat_testing',
    slug: 'psychometric-and-psychological-testing',
    name: 'Psychometric & Psychological Testing',
    summary: 'Structured assessment for school, study and career decisions.',
    description:
      'Standardised assessments used to inform subject choices, study support and career direction. Testing begins with a short intake conversation so the right battery is selected before anything is booked.',
    areas: [
      'Intelligence tests',
      'Ability tests',
      'Aptitude tests',
      'Learning potential tests',
      'Personality tests',
      'Interest tests',
      'Study habits tests',
      'Scholastic tests',
    ],
    concerns: ['assessment', 'career'],
    icon: 'ClipboardList',
    accent: 'clay' as const,
    order: 5,
    active: true,
  },
  {
    id: 'cat_additional',
    slug: 'additional-services',
    name: 'Additional Services',
    summary: 'Screening, groups, workshops, coaching and faith-based resources.',
    description:
      'Ways to engage with Be Whole Care beyond a one-to-one session — from a free confidential screening to workshops run for companies, schools, universities, churches and other organisations.',
    areas: [
      'Mental health screening services',
      'Online support group services',
      'Workshops & wellness programs',
      'Coaching & mentorship',
      'Faith & wellness resources',
    ],
    concerns: ['personal-growth', 'emotional-wellbeing'],
    icon: 'Users',
    accent: 'forest' as const,
    order: 6,
    active: true,
  },
];

/**
 * Bookable services.
 *
 * Only counselling sessions carry published prices (R800/R700 individual,
 * R850/R750 couple & family). Everything else the site does not price is
 * marked requiresQuote — the fee is confirmed after a short intake call rather
 * than invented here. Admins can set prices from the dashboard.
 */
/**
 * NOTE ON IN-PERSON PRICES
 *
 * The catalogue stores one in-person price per service, but the two practices
 * are NOT priced the same — individual counselling is R800 in Centurion and
 * R700 in Tembisa; couples is R850 and R800.
 *
 * `priceInPersonCents` below therefore holds the Centurion figure as the
 * headline. The amount a client is actually charged is computed per booking
 * from `priceFor(service, place)` in config/business.ts, which knows which
 * practice was chosen. Do not treat the stored value as authoritative for
 * billing.
 */
export const SERVICES = [
  {
    id: 'svc_individual',
    categoryId: 'cat_individual',
    slug: 'individual-counselling',
    name: 'Individual Counselling',
    summary: 'A 60-minute one-to-one session, online or in person.',
    durationMinutes: 60,
    rateBand: 'individual' as const,
    priceInPersonCents: RATES.individual.centurion,
    priceOnlineCents: RATES.individual.online,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote: null,
    order: 1,
    active: true,
  },
  {
    id: 'svc_couple',
    categoryId: 'cat_family',
    slug: 'couples-counselling',
    name: "Couple's Counselling",
    summary: 'A 60-minute session for two partners, together.',
    durationMinutes: 60,
    rateBand: 'couple' as const,
    priceInPersonCents: RATES.couple.centurion,
    priceOnlineCents: RATES.couple.online,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote: null,
    order: 2,
    active: true,
  },
  {
    id: 'svc_family',
    categoryId: 'cat_family',
    slug: 'family-counselling',
    name: 'Family Counselling',
    summary: 'A 60-minute session for a family unit.',
    durationMinutes: 60,
    rateBand: 'couple' as const,
    priceInPersonCents: RATES.couple.centurion,
    priceOnlineCents: RATES.couple.online,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote: null,
    order: 3,
    active: true,
  },
  {
    id: 'svc_trauma',
    categoryId: 'cat_trauma',
    slug: 'trauma-grief-and-healing-session',
    name: 'Trauma, Grief & Healing Session',
    summary: 'A 60-minute one-to-one session at a pace you set.',
    durationMinutes: 60,
    rateBand: 'individual' as const,
    priceInPersonCents: RATES.individual.centurion,
    priceOnlineCents: RATES.individual.online,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote: null,
    order: 4,
    active: true,
  },
  {
    id: 'svc_workplace',
    categoryId: 'cat_workplace',
    slug: 'workplace-and-career-support',
    name: 'Workplace & Career Support',
    summary: 'A 60-minute one-to-one session on work, balance and direction.',
    durationMinutes: 60,
    rateBand: 'individual' as const,
    priceInPersonCents: RATES.individual.centurion,
    priceOnlineCents: RATES.individual.online,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote: null,
    order: 5,
    active: true,
  },
  {
    id: 'svc_testing',
    categoryId: 'cat_testing',
    slug: 'psychometric-assessment',
    name: 'Psychometric Assessment',
    summary: 'Starts with a 60-minute intake to select the right battery.',
    durationMinutes: 60,
    rateBand: 'assessment' as const,
    priceInPersonCents: 0,
    priceOnlineCents: 0,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: true,
    intakeNote:
      'Assessment fees depend on the battery selected and are confirmed after this intake session. Nothing is charged when you book.',
    order: 6,
    active: true,
  },
  {
    id: 'svc_screening',
    categoryId: 'cat_additional',
    slug: 'mental-health-screening',
    name: 'Mental Health Screening',
    summary: 'A free, confidential screening conversation.',
    durationMinutes: 30,
    rateBand: 'free' as const,
    priceInPersonCents: 0,
    priceOnlineCents: 0,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    intakeNote:
      'This screening is free. It is a starting point for insight, not a diagnosis, and no payment is taken.',
    order: 7,
    active: true,
  },
  {
    id: 'svc_coaching',
    categoryId: 'cat_additional',
    slug: 'coaching-and-mentorship',
    name: 'Coaching & Mentorship',
    summary: 'One-on-one coaching around purpose, goals and wholeness.',
    durationMinutes: 60,
    rateBand: 'assessment' as const,
    priceInPersonCents: 0,
    priceOnlineCents: 0,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: true,
    intakeNote: 'Coaching fees are confirmed with you before your first paid session.',
    order: 8,
    active: true,
  },
  {
    id: 'svc_support_group',
    categoryId: 'cat_additional',
    slug: 'online-support-group',
    name: 'Online Support Group',
    summary: 'A facilitated group session, online.',
    durationMinutes: 60,
    rateBand: 'assessment' as const,
    priceInPersonCents: 0,
    priceOnlineCents: 0,
    allowsOnline: true,
    allowsInPerson: false,
    requiresQuote: true,
    intakeNote: 'Group placement and any fee are confirmed with you before the group starts.',
    order: 9,
    active: true,
  },
];

export const RESOURCES = [
  {
    id: 'res_burnout',
    slug: 'noticing-burnout-before-it-arrives',
    title: 'Noticing burnout before it arrives',
    excerpt:
      'Burnout rarely announces itself. It shows up first in small things — the shortened fuse, the Sunday dread, the tasks that used to take twenty minutes.',
    body: `Most people do not notice burnout starting. They notice it once it has already cost them something — a relationship strained, a deadline missed, a body that finally refused.

The earlier signals are quieter than that.

**The recovery gap.** Rest used to work. A weekend, a good night's sleep, and you were level again. When the same rest stops returning you to the same baseline, that gap is worth paying attention to.

**Flattened response.** Not sadness exactly. More an absence — things that used to land simply do not. Good news arrives and you register it without feeling it.

**The cost of small tasks.** A twenty-minute admin task takes the whole morning, not because it got harder, but because starting it did.

**Irritability that surprises you.** The disproportionate flash of anger at something minor is often exhaustion looking for an exit.

None of this is a diagnosis, and reading a list on a website is not an assessment. It is a prompt. If several of these have been true for more than a few weeks, that is usually the point at which talking to someone is cheaper than waiting.

A first session is often less dramatic than people expect. Mostly it is an hour of saying out loud, to someone who is not personally affected by your answers, what has actually been going on.`,
    kind: 'article' as const,
    topic: 'Stress & burnout',
    readMinutes: 4,
    published: true,
    order: 1,
  },
  {
    id: 'res_first_session',
    slug: 'what-actually-happens-in-a-first-session',
    title: 'What actually happens in a first session',
    excerpt:
      'If you have never been to counselling, the unknown itself can be the barrier. Here is the shape of a first hour.',
    body: `People often delay booking not because they doubt it would help, but because they cannot picture it. So here is the shape of it.

**It is a conversation, not an interview.** You will not be asked to produce your whole history in order. You will be asked what brought you here, and given room to answer that however it comes out.

**You set the depth.** Nothing obliges you to go into the hardest thing on day one. Saying "I'm not ready to talk about that yet" is a complete and acceptable answer.

**The practical parts come first.** Confidentiality and its limits are explained at the start, so you know exactly what is held in the room and what is not, before you decide what to share.

**It runs 60 minutes.** It begins and ends at the agreed time. That boundary is deliberate — it makes the hour safe to open up in, because you know when it closes.

**One session is a valid amount of sessions.** Some people come once, get their bearings, and go. There is no obligation to commit to a course of anything.

If you are nervous about the first one, it is worth saying that out loud in the first five minutes. It is the most common opening line there is.`,
    kind: 'article' as const,
    topic: 'Getting started',
    readMinutes: 3,
    published: true,
    order: 2,
  },
  {
    id: 'res_grief',
    slug: 'grief-does-not-move-in-stages',
    title: 'Grief does not move in stages',
    excerpt:
      'The five-stages model has been widely misread. Grief is not a queue you move through — and nothing has gone wrong if yours does not behave.',
    body: `The stages people quote were never meant as a sequence to be completed. They were observations, not instructions, and they were not a schedule.

Grief in practice tends to come in waves rather than phases. A steady month, then a Tuesday that flattens you for no reason you can name. A song, a smell, the shape of someone's shoulders in a queue.

This is worth saying plainly because so many grieving people carry a second burden on top of the first: the belief that they are doing it wrong. That they should be further along. That six months is somehow the deadline.

There is no deadline.

What does tend to help:

**Say the person's name.** People around you often avoid it, trying to protect you. It usually has the opposite effect.

**Keep one anchor.** One thing that stays the same each day — a walk, a meal at a fixed time, a person you message. Not to fix anything. To hold structure while the rest is unstructured.

**Let the waves be waves.** Bracing against one costs more than riding it.

If grief has settled into something that no longer moves at all — if months pass without the wave ever receding — that is a reasonable point to bring it to someone. Not because you are failing at grieving. Because carrying it alone stopped working.`,
    kind: 'reflection' as const,
    topic: 'Grief & loss',
    readMinutes: 4,
    published: true,
    order: 3,
  },
  {
    id: 'res_grounding',
    slug: 'a-grounding-practice-for-a-hard-moment',
    title: 'A grounding practice for a hard moment',
    excerpt:
      'A short guided reflection for when your thoughts are moving faster than you are. Roughly four minutes, wherever you are.',
    body: `This is not a treatment for anything. It is a small practice for a moment when your thinking has outrun you and you need to come back into the room.

**Sit, or stand still.** Feet flat. Let your weight settle down through them.

**Breathe out first.** Most of us try to breathe in when we are anxious, on top of lungs already full. Empty first — slowly, longer than feels natural. Then let the in-breath happen on its own.

**Name five things you can see.** Out loud if you can. Not interesting things. Ordinary ones. The corner of a door. A cable. The colour of the floor.

**Four things you can feel.** Fabric at your wrist. The chair. The temperature of the air on your hands.

**Three things you can hear.** Traffic. A fan. Your own breathing.

**Then one question, gently:** what is actually required of me in the next ten minutes? Not today. Not this week. Ten minutes.

Usually the answer is much smaller than the feeling suggested.

Come back to this as often as it is useful. And if the hard moments are becoming most moments, that is information worth taking to someone rather than managing alone.`,
    kind: 'reflection' as const,
    topic: 'Emotional wellbeing',
    readMinutes: 4,
    published: true,
    order: 4,
  },
  {
    id: 'res_conflict',
    slug: 'the-argument-underneath-the-argument',
    title: 'The argument underneath the argument',
    excerpt:
      'Couples rarely fight about dishes. They fight about what the dishes are being taken to mean.',
    body: `Most recurring arguments in a household are not really about their stated subject. The dishes, the phone, the late arrival — these are the surface. Underneath, almost always, sits a question about whether one person still matters to the other.

You can usually tell you have hit the real argument because the volume goes up while the topic stays trivially small. Nobody shouts about a mug. They shout about what the mug proves.

Two things tend to shift this.

**Slow the first sixty seconds.** Recurring arguments have a shape, and the shape is set early. If the first minute goes the way it always goes, the next twenty will too. Interrupting your own opening — even just pausing before responding — changes more than any technique deployed later.

**State the underneath thing.** "I felt like I didn't matter" is a harder sentence to say than "you never listen," and a much easier one to hear. The first invites a response. The second invites a defence.

This is difficult to do in the middle of it. That is not a personal failure — it is why couples' work exists. A third person in the room is not there to judge who is right. They are there because the pattern is easier to see from outside it.`,
    kind: 'article' as const,
    topic: 'Relationships',
    readMinutes: 3,
    published: true,
    order: 5,
  },
  {
    id: 'res_supporting',
    slug: 'how-to-support-someone-who-is-struggling',
    title: 'How to support someone who is struggling',
    excerpt:
      'You do not need the right words. Most of what helps is far less articulate than people assume.',
    body: `People hold back from someone who is struggling because they are afraid of saying the wrong thing. The absence usually lands harder than any clumsy sentence would have.

**Ask twice.** The first "how are you" gets the reflex answer. The second one — "no, really" — is the one that sometimes gets a true answer.

**Do not rush to fix.** The urge to offer a solution is mostly about relieving your own discomfort at their pain. Sit in it a little longer than is comfortable.

**Be specific with offers.** "Let me know if you need anything" puts the work on them. "I'm bringing food on Thursday, is 6 alright?" does not.

**Keep showing up after the first fortnight.** Support tends to arrive in a wave and then vanish. Week six is lonelier than week one, and almost nobody is still checking in by then.

**Know your limit.** You can be a good friend without being a counsellor. If someone's distress is beyond what you can hold — and particularly if you are worried about their safety — helping them find professional support is a better kind of care than trying to be the support yourself.

If there is immediate danger, contact emergency services or a 24-hour crisis line rather than waiting for an appointment.`,
    kind: 'article' as const,
    topic: 'Supporting others',
    readMinutes: 4,
    published: true,
    order: 6,
  },
];

export const WORKSHOPS = [
  {
    id: 'wsh_stress',
    slug: 'stress-management-workshop',
    title: 'Stress Management',
    summary: 'Practical tools for recognising and managing pressure before it compounds.',
    description:
      'An interactive session giving teams practical tools for stress management — recognising early load signals, building recovery into a working week, and knowing when to escalate for support.',
    audience: 'Companies, schools, universities, churches and organisations',
    format: 'hybrid' as const,
    date: null,
    durationLabel: 'Scheduled with your organisation',
    status: 'by_request' as const,
    order: 1,
  },
  {
    id: 'wsh_resilience',
    slug: 'emotional-resilience-workshop',
    title: 'Emotional Resilience',
    summary: 'Building the capacity to stay steady through demanding seasons.',
    description:
      'An interactive workshop on emotional resilience — regulation under pressure, recovering after difficult events, and sustaining people through demanding periods without burning through them.',
    audience: 'Companies, schools, universities, churches and organisations',
    format: 'hybrid' as const,
    date: null,
    durationLabel: 'Scheduled with your organisation',
    status: 'by_request' as const,
    order: 2,
  },
  {
    id: 'wsh_renewal',
    slug: 'spiritual-renewal-workshop',
    title: 'Spiritual Renewal',
    summary: 'A faith-centred session on renewal, purpose and wholeness.',
    description:
      'An interactive session designed for faith communities, focused on spiritual renewal alongside practical wellbeing — held with the same confidentiality and care as any other Be Whole Care engagement.',
    audience: 'Churches, faith groups and organisations',
    format: 'hybrid' as const,
    date: null,
    durationLabel: 'Scheduled with your organisation',
    status: 'by_request' as const,
    order: 3,
  },
];

/* -------------------------------------------------------------- demo people */

const DEMO_CLIENTS = [
  { first: 'Thandiwe', last: 'Mokoena', email: 'thandiwe.demo@example.com', phone: '0821234567' },
  { first: 'Sipho', last: 'Ndlovu', email: 'sipho.demo@example.com', phone: '0837654321' },
  { first: 'Lerato', last: 'Mahlangu', email: 'lerato.demo@example.com', phone: '0729876543' },
  { first: 'Johan', last: 'van Wyk', email: 'johan.demo@example.com', phone: '0834455667' },
  { first: 'Nomsa', last: 'Dlamini', email: 'nomsa.demo@example.com', phone: '0715558899' },
  { first: 'Kagiso', last: 'Sithole', email: 'kagiso.demo@example.com', phone: '0842223344' },
  { first: 'Aisha', last: 'Patel', email: 'aisha.demo@example.com', phone: '0761112233' },
];

/* ------------------------------------------------------------------- build */

export async function buildSeedDatabase(): Promise<Database> {
  const ts = nowISO();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const users: User[] = [
    {
      id: 'usr_admin',
      email: 'admin@bewholecare.co.za',
      passwordHash,
      role: 'SUPER_ADMIN',
      emailVerified: true,
      createdAt: ts,
      updatedAt: ts,
      isDemo: true,
    },
    {
      id: 'usr_staff',
      email: 'staff@bewholecare.co.za',
      passwordHash,
      role: 'STAFF',
      emailVerified: true,
      createdAt: ts,
      updatedAt: ts,
      isDemo: true,
    },
  ];

  const profiles: Profile[] = [
    {
      id: 'prf_admin',
      userId: 'usr_admin',
      firstName: 'Demo',
      lastName: 'Administrator',
      phone: BUSINESS.phone,
      preferredContact: 'email',
      createdAt: ts,
      updatedAt: ts,
      isDemo: true,
    },
    {
      id: 'prf_staff',
      userId: 'usr_staff',
      firstName: 'Demo',
      lastName: 'Practitioner',
      phone: BUSINESS.phone,
      preferredContact: 'email',
      createdAt: ts,
      updatedAt: ts,
      isDemo: true,
    },
  ];

  DEMO_CLIENTS.forEach((c, i) => {
    users.push({
      id: `usr_client_${i + 1}`,
      email: c.email,
      passwordHash,
      role: 'CLIENT',
      emailVerified: true,
      createdAt: addISODays(today(), -(40 - i * 4)) + 'T09:00:00.000Z',
      updatedAt: ts,
      isDemo: true,
    });
    profiles.push({
      id: `prf_client_${i + 1}`,
      userId: `usr_client_${i + 1}`,
      firstName: c.first,
      lastName: c.last,
      phone: c.phone,
      preferredContact: i % 3 === 0 ? 'whatsapp' : 'email',
      medicalAid:
        i === 1
          ? { scheme: 'Discovery Health', memberNumber: 'DEMO-1102938', mainMember: 'Self' }
          : null,
      createdAt: addISODays(today(), -(40 - i * 4)) + 'T09:00:00.000Z',
      updatedAt: ts,
      isDemo: true,
    });
  });

  const locations = LOCATIONS.map((l, i) => ({
    id: `loc_${l.slug}`,
    slug: l.slug,
    name: l.name,
    addressLine: l.addressLine,
    city: l.city,
    postalCode: l.postalCode,
    region: l.region,
    active: true,
    order: i,
  }));

  /**
   * A single practitioner record standing for the practice itself. The live
   * site names no individual practitioner, so none is invented here — admins
   * add real staff from the dashboard.
   */
  const practitioners = [
    {
      id: 'prc_practice',
      userId: 'usr_staff',
      displayName: 'Be Whole Care',
      title: 'Counselling & wellness team',
      bio: null,
      locationIds: locations.map((l) => l.id),
      offersOnline: true,
      active: true,
    },
  ];

  const availabilityRules = BUSINESS_HOURS.filter((h) => h.open && h.close).map((h, i) => ({
    id: `avr_${i}`,
    practitionerId: 'prc_practice',
    weekday: h.day,
    start: h.open as string,
    end: h.close as string,
    mode: 'any' as const,
    locationId: null,
    active: true,
  }));

  const settings: Settings = {
    business: {
      name: BUSINESS.name,
      email: BUSINESS.email,
      phone: BUSINESS.phone,
      whatsapp: BUSINESS.whatsapp,
      website: BUSINESS.website,
      timezone: BUSINESS.timezone,
      currency: BUSINESS.currency,
    },
    scheduling: { ...SESSION_DEFAULTS },
    reminders: {
      confirmationImmediate: true,
      firstReminderHours: 24,
      secondReminderHours: 2,
      followUpAfterHours: 24,
      channels: ['email', 'whatsapp'],
    },
    payments: {
      provider: process.env.PEACH_ENTITY_ID ? 'peach' : process.env.PAYFAST_MERCHANT_ID ? 'payfast' : 'mock',
      medicalAidEnabled: true,
      medicalAidCoPaymentCents: RATES.medicalAidCoPaymentInPerson,
      requirePaymentToConfirm: true,
    },
    banking: {
      accountName: '',
      bank: '',
      accountNumber: '',
      branchCode: '',
      showOnInvoices: false,
    },
    calendar: {
      provider: process.env.GOOGLE_CLIENT_ID ? 'google' : 'mock',
      calendarId: BUSINESS.email,
      connected: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
    },
    policy: { cancellation: POLICY.cancellation, minimumAge: 16 },
    updatedAt: ts,
  };

  const db: Database = {
    version: 1,
    users,
    profiles,
    serviceCategories: SERVICE_CATEGORIES,
    services: SERVICES,
    locations,
    practitioners,
    availabilityRules,
    availabilityBlocks: [],
    appointments: [],
    payments: [],
    paymentEvents: [],
    followUps: [],
    calendarEvents: [],
    notifications: [],
    notificationLogs: [],
    resources: RESOURCES.map((r) => ({ ...r, publishedAt: addISODays(today(), -r.order * 9) + 'T08:00:00.000Z' })),
    workshops: WORKSHOPS,
    clientNotes: [],
    consents: [],
    auditLogs: [],
    sessions: [],
    settings,
  };

  seedActivity(db);
  return db;
}

/**
 * Fabricated appointment/payment/follow-up history so the dashboards are not
 * empty on first run. All records are flagged isDemo and surfaced as such.
 */
function seedActivity(db: Database) {
  const t = today();
  const plan: {
    client: number;
    service: string;
    day: number;
    time: string;
    mode: 'online' | 'in_person';
    status: Appointment['status'];
    method: 'card' | 'medical_aid';
    pay: Payment['status'];
  }[] = [
    { client: 1, service: 'svc_individual', day: 0, time: '10:00', mode: 'online', status: 'confirmed', method: 'card', pay: 'paid' },
    { client: 2, service: 'svc_couple', day: 0, time: '14:00', mode: 'in_person', status: 'confirmed', method: 'medical_aid', pay: 'pending' },
    { client: 3, service: 'svc_trauma', day: 1, time: '09:00', mode: 'online', status: 'confirmed', method: 'card', pay: 'paid' },
    { client: 4, service: 'svc_workplace', day: 1, time: '11:00', mode: 'in_person', status: 'pending_payment', method: 'card', pay: 'pending' },
    { client: 5, service: 'svc_individual', day: 2, time: '15:00', mode: 'online', status: 'confirmed', method: 'card', pay: 'paid' },
    { client: 6, service: 'svc_family', day: 3, time: '10:00', mode: 'in_person', status: 'confirmed', method: 'card', pay: 'paid' },
    { client: 7, service: 'svc_screening', day: 4, time: '08:30', mode: 'online', status: 'confirmed', method: 'card', pay: 'paid' },
    { client: 1, service: 'svc_individual', day: -7, time: '10:00', mode: 'online', status: 'completed', method: 'card', pay: 'paid' },
    { client: 1, service: 'svc_individual', day: -14, time: '10:00', mode: 'online', status: 'completed', method: 'card', pay: 'paid' },
    { client: 3, service: 'svc_trauma', day: -6, time: '09:00', mode: 'online', status: 'completed', method: 'card', pay: 'paid' },
    { client: 2, service: 'svc_couple', day: -9, time: '14:00', mode: 'in_person', status: 'completed', method: 'medical_aid', pay: 'paid' },
    { client: 5, service: 'svc_individual', day: -12, time: '15:00', mode: 'online', status: 'cancelled', method: 'card', pay: 'refunded' },
    { client: 4, service: 'svc_workplace', day: -3, time: '11:00', mode: 'in_person', status: 'no_show', method: 'card', pay: 'paid' },
    { client: 6, service: 'svc_family', day: -18, time: '10:00', mode: 'in_person', status: 'completed', method: 'card', pay: 'paid' },
    { client: 7, service: 'svc_individual', day: -21, time: '16:00', mode: 'online', status: 'completed', method: 'card', pay: 'paid' },
  ];

  plan.forEach((p, i) => {
    const service = db.services.find((s) => s.id === p.service)!;
    const date = addISODays(t, p.day);
    const start = fromLocalParts(date, p.time);
    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    const userId = `usr_client_${p.client}`;
    const amount =
      p.method === 'medical_aid'
        ? p.mode === 'in_person'
          ? db.settings.payments.medicalAidCoPaymentCents
          : 0
        : p.mode === 'online'
          ? service.priceOnlineCents
          : service.priceInPersonCents;

    const apptId = `apt_demo_${i + 1}`;
    const payId = `pay_demo_${i + 1}`;
    const createdAt = addISODays(date, -5) + 'T09:15:00.000Z';

    const appointment: Appointment = {
      id: apptId,
      reference: `BWC-DEMO${String(i + 1).padStart(2, '0')}`,
      clientUserId: userId,
      serviceId: service.id,
      practitionerId: 'prc_practice',
      mode: p.mode,
      locationId: p.mode === 'in_person' ? db.locations[i % 2].id : null,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      durationMinutes: service.durationMinutes,
      status: p.status,
      paymentMethod: p.method,
      amountCents: amount,
      reason: null,
      isFirstSession: p.day < -10,
      sessionLink: p.mode === 'online' ? `https://meet.google.com/demo-${apptId.slice(-4)}` : null,
      calendarEventId: null,
      cancelledAt: p.status === 'cancelled' ? addISODays(date, -2) + 'T12:00:00.000Z' : null,
      cancellationReason: p.status === 'cancelled' ? 'Client rescheduled to a later date' : null,
      completedAt: p.status === 'completed' ? end.toISOString() : null,
      createdAt,
      updatedAt: createdAt,
      isDemo: true,
    };
    db.appointments.push(appointment);

    if (amount > 0 || p.method === 'card') {
      const payment: Payment = {
        id: payId,
        appointmentId: apptId,
        clientUserId: userId,
        amountCents: amount,
        currency: 'ZAR',
        method: p.method,
        status: p.pay,
        provider: p.method === 'medical_aid' ? 'manual' : 'mock',
        providerCheckoutId: null,
        providerPaymentId: p.pay === 'paid' ? `mock_${apptId}` : null,
        checkoutUrl: null,
        paidAt: p.pay === 'paid' ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
        isDemo: true,
      };
      db.payments.push(payment);
    }

    if (p.status === 'confirmed' || p.status === 'completed') {
      db.calendarEvents.push({
        id: `cal_demo_${i + 1}`,
        appointmentId: apptId,
        provider: 'mock',
        externalId: `mockevt_${apptId}`,
        calendarId: db.settings.calendar.calendarId,
        htmlLink: null,
        status: 'synced',
        syncedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  const followUps: FollowUp[] = [
    {
      id: 'fup_demo_1',
      clientUserId: 'usr_client_1',
      serviceId: 'svc_individual',
      createdByUserId: 'usr_staff',
      sourceAppointmentId: 'apt_demo_8',
      appointmentId: null,
      dueDate: addISODays(t, 6),
      preferredTime: '10:00',
      mode: 'online',
      locationId: null,
      paymentRequired: true,
      amountCents: RATES.individual.online,
      status: 'awaiting_payment',
      reminderDate: addISODays(t, 2),
      channel: 'whatsapp',
      notes: 'Continuing fortnightly rhythm.',
      createdAt: addISODays(t, -2) + 'T10:00:00.000Z',
      updatedAt: addISODays(t, -2) + 'T10:00:00.000Z',
      isDemo: true,
    },
    {
      id: 'fup_demo_2',
      clientUserId: 'usr_client_3',
      serviceId: 'svc_trauma',
      createdByUserId: 'usr_staff',
      sourceAppointmentId: 'apt_demo_10',
      appointmentId: null,
      dueDate: addISODays(t, -2),
      preferredTime: '09:00',
      mode: 'online',
      locationId: null,
      paymentRequired: true,
      amountCents: RATES.individual.online,
      status: 'awaiting_payment',
      reminderDate: addISODays(t, -4),
      reminderSentAt: addISODays(t, -4) + 'T08:00:00.000Z',
      channel: 'email',
      notes: 'Payment link sent, awaiting response.',
      createdAt: addISODays(t, -8) + 'T10:00:00.000Z',
      updatedAt: addISODays(t, -4) + 'T08:00:00.000Z',
      isDemo: true,
    },
    {
      id: 'fup_demo_3',
      clientUserId: 'usr_client_6',
      serviceId: 'svc_family',
      createdByUserId: 'usr_admin',
      sourceAppointmentId: 'apt_demo_14',
      appointmentId: 'apt_demo_6',
      dueDate: addISODays(t, 3),
      preferredTime: '10:00',
      mode: 'in_person',
      locationId: 'loc_centurion',
      paymentRequired: true,
      amountCents: RATES.couple.centurion,
      status: 'confirmed',
      reminderDate: addISODays(t, 1),
      reminderSentAt: null,
      channel: 'whatsapp',
      notes: 'Paid up front, calendar event created.',
      createdAt: addISODays(t, -10) + 'T10:00:00.000Z',
      updatedAt: addISODays(t, -1) + 'T10:00:00.000Z',
      isDemo: true,
    },
    {
      id: 'fup_demo_4',
      clientUserId: 'usr_client_5',
      serviceId: 'svc_individual',
      createdByUserId: 'usr_staff',
      sourceAppointmentId: null,
      appointmentId: null,
      dueDate: addISODays(t, 14),
      preferredTime: '15:00',
      mode: 'online',
      locationId: null,
      paymentRequired: false,
      amountCents: 0,
      status: 'scheduled',
      reminderDate: addISODays(t, 10),
      channel: 'email',
      notes: 'Check-in call, no charge.',
      createdAt: addISODays(t, -1) + 'T10:00:00.000Z',
      updatedAt: addISODays(t, -1) + 'T10:00:00.000Z',
      isDemo: true,
    },
  ];
  db.followUps.push(...followUps);

  db.payments.push({
    id: 'pay_demo_fup_2',
    followUpId: 'fup_demo_2',
    clientUserId: 'usr_client_3',
    amountCents: RATES.individual.online,
    currency: 'ZAR',
    method: 'card',
    status: 'pending',
    provider: 'mock',
    providerCheckoutId: 'mock_chk_fup2',
    checkoutUrl: '/pay/mock_chk_fup2',
    createdAt: addISODays(t, -4) + 'T08:00:00.000Z',
    updatedAt: addISODays(t, -4) + 'T08:00:00.000Z',
    isDemo: true,
  });

  const notes: ClientNote[] = [
    {
      id: 'nte_demo_1',
      clientUserId: 'usr_client_1',
      authorUserId: 'usr_staff',
      appointmentId: 'apt_demo_8',
      category: 'admin',
      body: 'Prefers online sessions. Fortnightly rhythm works well with their shift schedule.',
      createdAt: addISODays(t, -7) + 'T11:30:00.000Z',
      isDemo: true,
    },
    {
      id: 'nte_demo_2',
      clientUserId: 'usr_client_2',
      authorUserId: 'usr_admin',
      appointmentId: null,
      category: 'billing',
      body: 'Medical aid authorisation number on file. Co-payment settled at each in-person session.',
      createdAt: addISODays(t, -9) + 'T15:00:00.000Z',
      isDemo: true,
    },
    {
      id: 'nte_demo_3',
      clientUserId: 'usr_client_4',
      authorUserId: 'usr_staff',
      appointmentId: 'apt_demo_13',
      category: 'session_admin',
      body: 'Did not arrive and did not make contact. Follow-up message sent the same afternoon.',
      createdAt: addISODays(t, -3) + 'T12:10:00.000Z',
      isDemo: true,
    },
  ];
  db.clientNotes.push(...notes);

  db.notifications.push(
    {
      id: 'ntf_demo_1',
      audience: 'staff',
      type: 'booking.created',
      title: 'New booking — Individual Counselling',
      body: 'Thandiwe Mokoena booked an online session.',
      href: '/admin/appointments',
      read: false,
      createdAt: addISODays(t, -1) + 'T07:40:00.000Z',
    },
    {
      id: 'ntf_demo_2',
      audience: 'staff',
      type: 'payment.pending',
      title: 'Payment outstanding',
      body: 'Johan van Wyk has not completed payment for tomorrow’s session.',
      href: '/admin/payments',
      read: false,
      createdAt: addISODays(t, -1) + 'T09:10:00.000Z',
    },
    {
      id: 'ntf_demo_3',
      audience: 'staff',
      type: 'followup.overdue',
      title: 'Follow-up overdue',
      body: 'Lerato Mahlangu’s follow-up passed its due date.',
      href: '/admin/follow-ups',
      read: true,
      createdAt: addISODays(t, -2) + 'T06:00:00.000Z',
    },
    {
      id: 'ntf_demo_4',
      userId: 'usr_client_1',
      audience: 'client',
      type: 'appointment.confirmed',
      title: 'Your session is confirmed',
      body: 'Individual Counselling — online. We’ll send your link before the session.',
      href: '/portal/appointments',
      read: false,
      createdAt: addISODays(t, -1) + 'T07:41:00.000Z',
    },
  );

  db.auditLogs.push({
    id: 'aud_demo_1',
    actorUserId: 'usr_admin',
    actorRole: 'SUPER_ADMIN',
    action: 'system.seeded',
    entity: 'database',
    meta: { note: 'Demo dataset generated for development.' },
    createdAt: nowISO(),
  });
}

export { DEMO_PASSWORD };
