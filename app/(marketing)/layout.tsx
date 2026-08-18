import { SiteDock } from '@/components/site/dock';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { ScrollProgress } from '@/components/site/interactions';
import { TermsProvider } from '@/components/site/terms-modal';
import { WhatsAppButton } from '@/components/site/whatsapp';
import { AssistantLauncher } from '@/components/assistant/launcher';

/**
 * The public site renders WITHOUT reading the session.
 *
 * This layout used to await `getCurrentUser()`, which reads a cookie. Reading
 * a cookie opts the entire route out of static rendering, so every visit to
 * every marketing page — including someone arriving from a Google result or a
 * WhatsApp link — booted a serverless function and waited on a database round
 * trip before a single pixel appeared.
 *
 * All that bought was showing "My portal" instead of "Sign in" to someone
 * already signed in, while they were reading the public pages. That is a poor
 * trade against first-visit speed on a phone, on mobile data, for someone who
 * may be having a hard day.
 *
 * The pages are now static and served from the CDN edge. The portal and admin
 * areas still resolve the session properly on every request — that is where it
 * matters, and they are behind a login anyway.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = null;

  return (
    // TermsProvider wraps the whole marketing site so any page can open the
    // terms dialog — the practice's rules on cancellation and payment apply
    // wherever someone happens to be reading.
    <TermsProvider>
      <div className="flex min-h-dvh flex-col">
        <ScrollProgress />
        <SiteHeader user={user} />
        <main id="main" className="flex-1 pt-24 sm:pt-28">
          {children}
        </main>
      {/*
        The dock floats over the page, so the last of the footer would sit
        underneath it. This reserves the height back.
      */}
        <SiteFooter className="pb-28" />
        <AssistantLauncher />
        <WhatsAppButton />
        {/*
          StickyBookBar used to live here — a mobile-only bar that slid up after
          620px of scroll carrying "Book an appointment". The dock now holds Book
          permanently and on every breakpoint, so keeping both would have stacked
          two bars on top of each other on a phone.
        */}
        <SiteDock user={user} />
      </div>
    </TermsProvider>
  );
}
