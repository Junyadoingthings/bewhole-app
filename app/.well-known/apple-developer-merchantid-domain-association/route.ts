import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/**
 * Apple Pay domain verification.
 *
 * Apple will not show the Apple Pay button on a domain it has not verified.
 * Verification works by Apple fetching this exact path over HTTPS and matching
 * the file contents against what was registered.
 *
 * The gateway (Peach) issues the association file during Apple Pay onboarding.
 * Paste its contents into APPLE_PAY_DOMAIN_ASSOCIATION as a single-line
 * environment variable — it is not a secret, but it is deployment-specific, so
 * it does not belong in the repository.
 *
 * Until it is set this returns 404, which is the honest answer: the domain is
 * genuinely not verified yet, and Apple Pay will not appear.
 */
export async function GET() {
  const association = process.env.APPLE_PAY_DOMAIN_ASSOCIATION;

  if (!association) {
    return new NextResponse(
      'Apple Pay domain association file is not configured. See PAYMENTS.md.',
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  return new NextResponse(association, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
