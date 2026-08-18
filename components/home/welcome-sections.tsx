import Image from 'next/image';
import { ArrowUpRight, FileText, Play } from 'lucide-react';

import { TermsTrigger } from '@/components/site/terms-modal';
import { POLICY } from '@/config/business';
import { PHOTOS } from '@/config/photos';

const PODCAST_URL = 'https://www.youtube.com/@ntombimothoagae';

/**
 * Terms, on the way to booking.
 *
 * Two rules are quoted in full here rather than summarised — the ones that
 * decide who pays when a session is missed, which is where almost every
 * misunderstanding starts. The rest opens in the dialog, where the tickbox is.
 */
export function TermsCallout() {
  return (
    <section className="border-t border-line-soft bg-canvas py-16 sm:py-20">
      <div className="shell">
        <div className="rounded-3xl border border-line bg-canvas-sunk p-7 sm:p-10">
          <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
            <FileText className="h-3.5 w-3.5" />
            Before you book
          </p>

          <h2 className="mt-3 font-display text-2xl font-semibold text-ink sm:text-3xl">
            Terms &amp; conditions
          </h2>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-ink">Cancellations</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{POLICY.cancellation}</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-ink">Payment</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{POLICY.cardPayments}</p>
            </div>
          </div>

          <TermsTrigger className="mt-7 rounded-full bg-forest-800 px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:bg-forest-900">
            Read and accept the full terms
          </TermsTrigger>
        </div>
      </div>
    </section>
  );
}

/**
 * The podcast, immediately above the footer.
 *
 * Styled from her channel rather than from this site: warm off-white, the
 * clay-brown wordmark, her portrait to the side. It is the one place on the
 * page that is allowed to feel like a personal invitation rather than a
 * clinical service, which is why it sits at the end — after the booking
 * decision has been made or deferred, not competing with it.
 */
export function PodcastInvite() {
  const photo = PHOTOS.practitionerAlt;

  return (
    <section className="bg-canvas pb-4 pt-16 sm:pt-20">
      <div className="shell">
        <a
          href={PODCAST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-[2rem] border border-clay-200 bg-cream-100 transition-shadow duration-300 ease-calm hover:shadow-lifted"
        >
          {/*
            No portrait here. She already appears twice in the hero, and a
            third photograph of the same person on one page turned the podcast
            card into a second advertisement for her rather than a link to the
            show. The wordmark carries the branding on its own.
          */}
          <div>
            <div className="p-8 sm:p-12">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-clay-500">
                The podcast
              </p>

              <p className="mt-5 font-display text-3xl font-semibold leading-none text-clay-700 sm:text-4xl">
                be whole.
              </p>
              <p className="mt-2 text-base text-clay-600 sm:text-lg">by Ntombi Mothoagae</p>

              <p className="mt-5 max-w-md text-sm leading-relaxed text-clay-700/80 sm:text-base">
                A space for honest conversations about inner healing. Free to watch, no
                appointment needed.
              </p>

              <span className="mt-7 inline-flex items-center gap-2.5 rounded-full bg-clay-700 px-5 py-3 text-sm font-medium text-cream-50 transition-transform duration-300 ease-calm group-hover:translate-x-0.5">
                <Play className="h-4 w-4 fill-current" />
                Watch on YouTube
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>

          </div>
        </a>
      </div>
    </section>
  );
}
