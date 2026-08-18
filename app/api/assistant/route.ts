import { NextResponse } from 'next/server';

import { BUSINESS, CRISIS_SUPPORT, HOURS_SUMMARY, LOCATIONS, POLICY, RATES } from '@/config/business';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { listCategories } from '@/lib/db';
import { money } from '@/lib/utils';

/**
 * Wellness assistant.
 *
 * Answers only from the practice's published information. It is explicitly not
 * clinical: distress language short-circuits everything else and routes to real
 * crisis services, and any request for a diagnosis or clinical opinion is
 * declined rather than attempted.
 */

const CRISIS_PATTERNS = [
  /\b(kill|hurt|harm)\s+(myself|my ?self|me)\b/i,
  /\bsuicid/i,
  /\bend (my|it all|my life)\b/i,
  /\bwant to die\b/i,
  /\bnot safe\b/i,
  /\boverdos/i,
  /\bself[- ]harm/i,
  /\bemergency\b/i,
];

const DIAGNOSTIC_PATTERNS = [
  /\bdo i have\b/i,
  /\bam i (depressed|bipolar|autistic|adhd|anxious|traumatised|traumatized)\b/i,
  /\bdiagnos/i,
  /\bwhat('| i)?s wrong with me\b/i,
  /\bmedication|antidepressant|prescri/i,
];

interface Answer {
  reply: string;
  links?: { href: string; label: string }[];
  crisis?: boolean;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request.headers, 'assistant'), LIMITS.assistant);
  if (!limit.ok) {
    return NextResponse.json(
      {
        reply:
          "You've sent a lot of questions in a short time. Give it a minute — or call us on 063 883 7170 and speak to a person.",
      },
      { status: 429 },
    );
  }

  let message = '';
  try {
    const body = (await request.json()) as { message?: unknown };
    message = typeof body.message === 'string' ? body.message.slice(0, 800) : '';
  } catch {
    return NextResponse.json({ reply: 'I did not catch that — could you try again?' }, { status: 400 });
  }

  if (!message.trim()) {
    return NextResponse.json({ reply: 'Ask me anything about our services or booking.' });
  }

  return NextResponse.json(await answer(message));
}

async function answer(message: string): Promise<Answer> {
  const text = message.toLowerCase();

  // Safety always wins, regardless of what else the message asks.
  if (CRISIS_PATTERNS.some((p) => p.test(message))) {
    return {
      crisis: true,
      reply:
        "I'm glad you said something — and I want to be straight with you: I'm an AI assistant, so I'm not the right support for this.\n\nPlease reach a person now. These lines are staffed 24 hours and are free to call:",
      links: [{ href: '/contact', label: 'Contact Be Whole Care' }],
    };
  }

  if (DIAGNOSTIC_PATTERNS.some((p) => p.test(message))) {
    return {
      reply:
        "I can't answer that one — I'm an AI assistant, not a clinician, and questions about diagnosis or medication need a qualified professional who can actually talk with you.\n\nWhat I can do is help you book a session, or point you to a free screening conversation as a starting point.",
      links: [
        { href: '/book?service=svc_screening', label: 'Free screening' },
        { href: '/book', label: 'Book a session' },
      ],
    };
  }

  if (/(price|cost|fee|how much|rate|charge)/.test(text)) {
    return {
      reply: `Private card rates are:\n\n• Individual — ${money(RATES.individual.centurion)} in person, ${money(RATES.individual.online)} online\n• Couple or family — ${money(RATES.couple.centurion)} in person, ${money(RATES.couple.online)} online\n\nSessions run 60 minutes. Psychometric assessment, coaching and group work are quoted after a short intake conversation, and mental health screening is free.`,
      links: [
        { href: '/book', label: 'Book a session' },
        { href: '/terms#payment', label: 'Payment terms' },
      ],
    };
  }

  if (/(medical aid|scheme|discovery|momentum|bonitas|claim|co-?pay)/.test(text)) {
    return {
      reply: `Yes — medical aid is accepted. A ${money(RATES.medicalAidCoPaymentInPerson)} co-payment applies per in-person consultation when you use medical aid benefits.\n\n${POLICY.medicalAid}`,
      links: [{ href: '/book', label: 'Book with medical aid' }],
    };
  }

  if (/(cancel|reschedul|move my|change my appointment|refund)/.test(text)) {
    return {
      reply: `${POLICY.cancellation}\n\nIf you already have a booking, you can cancel or move it yourself from your client portal.`,
      links: [{ href: '/portal/appointments', label: 'My appointments' }],
    };
  }

  if (/(where|location|address|centurion|tembisa|directions|parking)/.test(text)) {
    return {
      reply: `We see clients in person at two practices:\n\n• ${LOCATIONS[0].name} — ${LOCATIONS[0].full}\n• ${LOCATIONS[1].name} — ${LOCATIONS[1].full}\n\nOnline sessions are available anywhere in South Africa.`,
      links: [{ href: '/book', label: 'Choose a practice' }],
    };
  }

  if (/(hour|open|time|when are you|saturday|weekend|available)/.test(text)) {
    return {
      reply: `Our hours are:\n\n${HOURS_SUMMARY.map((h) => `• ${h.label}: ${h.value}`).join('\n')}\n\nSessions are by appointment only — the booking page shows only times that are genuinely open.`,
      links: [{ href: '/book', label: 'See available times' }],
    };
  }

  if (/(online|virtual|video|zoom|link|remote)/.test(text)) {
    return {
      reply:
        "Both online and in-person sessions are available, and they run the same 60 minutes. If you book online, a private session link is sent to you before we meet — you'll also find it on your appointment page in the portal.",
      links: [{ href: '/book', label: 'Book an online session' }],
    };
  }

  if (/(first session|what happens|nervous|expect|scared|never been)/.test(text)) {
    return {
      reply:
        "A first session is mostly a conversation. You'll be asked what brought you here and given room to answer however it comes out — you're not expected to lay out your whole history, and \"I'm not ready to talk about that yet\" is a complete answer.\n\nConfidentiality and its limits are explained at the start, so you know what's held in the room before you decide what to share. It runs 60 minutes and starts and ends at the agreed time.",
      links: [
        { href: '/resources/what-actually-happens-in-a-first-session', label: 'Read more' },
        { href: '/book', label: 'Book a first session' },
      ],
    };
  }

  if (/(confidential|private|secure|popia|data|record|who sees)/.test(text)) {
    return {
      reply: `${POLICY.confidentiality} There are three situations where it has limits:\n\n${POLICY.confidentialityLimits.map((l) => `• ${l}`).join('\n')}\n\nThese are explained to you during informed consent. We also collect as little personal information as a booking needs.`,
      links: [{ href: '/privacy', label: 'Privacy notice' }],
    };
  }

  if (/(workshop|company|school|church|organisation|organization|team|staff wellness|program)/.test(text)) {
    return {
      reply:
        'We run interactive workshops and wellness programs for companies, schools, universities, churches and other organisations — covering stress management, emotional resilience and spiritual renewal. These are scheduled directly with your organisation.',
      links: [
        { href: '/workshops', label: 'Workshops' },
        { href: '/contact', label: 'Request a workshop' },
      ],
    };
  }

  if (/(test|psychometric|aptitude|iq|assessment|career guidance|subject choice)/.test(text)) {
    return {
      reply:
        'Psychometric and psychological testing covers intelligence, ability, aptitude, learning potential, personality, interest, study habits and scholastic assessments.\n\nIt starts with a 60-minute intake conversation so the right battery is chosen — fees depend on which assessments are used and are confirmed then, so nothing is charged when you book the intake.',
      links: [
        { href: '/services/psychometric-and-psychological-testing', label: 'Testing services' },
        { href: '/book?service=svc_testing', label: 'Book an intake' },
      ],
    };
  }

  if (/(which service|what service|right for me|not sure|help me choose|recommend|where do i start)/.test(text)) {
    const categories = await listCategories();
    return {
      reply: `We offer six areas of support:\n\n${categories.map((c) => `• ${c.name} — ${c.summary}`).join('\n')}\n\nIf you're not sure, most people start with individual counselling, or a free mental health screening conversation. I can't advise on what you need — but you don't have to have it worked out before booking.`,
      links: [
        { href: '/services', label: 'All services' },
        { href: '/book?service=svc_screening', label: 'Free screening' },
      ],
    };
  }

  if (/(contact|phone|call|whatsapp|email|speak to someone|reach)/.test(text)) {
    return {
      reply: `You can reach the practice on ${BUSINESS.phone} — that number takes calls and WhatsApp — or by email at ${BUSINESS.email}. Someone replies during business hours.`,
      links: [{ href: '/contact', label: 'Contact page' }],
    };
  }

  if (/(book|appointment|schedule|slot|availability)/.test(text)) {
    return {
      reply:
        "Booking takes about two minutes: choose a service, online or in person, then a date and time from real availability. You'll pay securely at the end, and your confirmation and calendar invitation follow immediately.",
      links: [{ href: '/book', label: 'Start booking' }],
    };
  }

  if (/(child|kid|teen|minor|16|under 18|son|daughter)/.test(text)) {
    return {
      reply: `${POLICY.eligibility}\n\nIf you're arranging support for a young person, get in touch and the practice will talk you through what's needed.`,
      links: [{ href: '/contact', label: 'Contact us' }],
    };
  }

  return {
    reply:
      "I'm not certain I can answer that one well — I only know what Be Whole Care publishes about its services, fees, hours and booking.\n\nFor anything else, the practice will answer properly on 063 883 7170 or bewholecare@gmail.com.",
    links: [
      { href: '/services', label: 'Browse services' },
      { href: '/contact', label: 'Contact us' },
    ],
  };
}
