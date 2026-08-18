import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';

import { BookingWizard } from '@/components/booking/wizard';
import { getCurrentUser } from '@/lib/auth';
import { acceptedMethods, getPaymentProvider } from '@/services/payments';
import { getProfile, getSettings, listCategories, listLocations, listServices } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Book an appointment',
  description:
    'Book a counselling session with Be Whole Care — online or in person in Centurion and Tembisa. Real availability, secure payment, instant confirmation.',
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

/**
 * The catalogue, cached across requests.
 *
 * Services, categories, locations and the settings row are the same for
 * everybody and change perhaps a few times a year. They were being re-queried
 * from Postgres on every single visit to this page — four round trips before
 * the first service card could render, which on a cold function meant over two
 * seconds of blank screen after someone tapped "Schedule your session here".
 *
 * `unstable_cache` keeps the result for five minutes, so the overwhelming
 * majority of visits skip the database entirely. A price edited in the admin
 * dashboard takes up to five minutes to appear here — an acceptable trade for
 * a page that is the front door to every booking. Shorten the window, or call
 * `revalidateTag('booking-catalogue')` after a settings save, if that matters.
 *
 * Availability is NOT cached: slots are fetched per request further in, so
 * nobody is ever offered a time that has already gone.
 */
const getBookingCatalogue = unstable_cache(
  async () => {
    const [categories, services, locations, settings] = await Promise.all([
      listCategories(),
      listServices(),
      listLocations(),
      getSettings(),
    ]);
    return { categories, services, locations, settings };
  },
  ['booking-catalogue'],
  { revalidate: 300, tags: ['booking-catalogue'] },
);

export default async function BookPage({
  searchParams,
}: {
  searchParams: { service?: string; category?: string };
}) {
  const user = await getCurrentUser();
  const [{ categories, services, locations, settings }, profile] = await Promise.all([
    getBookingCatalogue(),
    user ? getProfile(user.id) : Promise.resolve(null),
  ]);

  /**
   * What can actually be booked online.
   *
   * The catalogue still holds every service the practice offers — family
   * counselling, trauma work, workplace support, coaching, groups — and those
   * remain on the Services pages. They are not bookable through this form:
   * the practice arranges them directly, because they need a conversation
   * about scope, length or group size before a time can be held.
   *
   * Filtering here rather than deleting the services keeps the marketing
   * pages, the historic appointments and the admin catalogue intact. Match on
   * slug so renaming a service's display name cannot silently drop it from
   * booking.
   */
  /**
   * Excluded, not allow-listed — and matched on NAME, not slug.
   *
   * The first version listed the slugs that may be booked and fell back to
   * showing everything if none matched. Both halves were wrong: the live
   * database's slugs differ from the ones in the seed file, so nothing
   * matched, and the fallback then displayed the whole catalogue — the exact
   * services the practice had asked to remove.
   *
   * An exclusion list cannot fail that way. If a name here stops matching, the
   * worst case is one extra service appearing, not the removal silently
   * undoing itself. Matching is on a normalised name so punctuation and case
   * ("Couple's" vs "Couples") cannot break it.
   */
  const EXCLUDED = ['family', 'trauma', 'workplace', 'career', 'coaching', 'mentorship', 'group'];

  const bookableServices = services.filter((s) => {
    const name = s.name.toLowerCase();
    return !EXCLUDED.some((word) => name.includes(word));
  });

  return (
    <BookingWizard
      categories={categories}
      services={bookableServices}
      locations={locations}
      user={user}
      profile={profile ? { phone: profile.phone } : null}
      medicalAidCoPaymentCents={settings.payments.medicalAidCoPaymentCents}
      acceptedMethods={[...acceptedMethods()]}
      supportsEmbedded={getPaymentProvider().supportsEmbedded}
      paymentProvider={getPaymentProvider().name}
      prefill={{ serviceId: searchParams.service, categorySlug: searchParams.category }}
    />
  );
}
