import { ResourceCta } from '@/components/home/resource-cta';
import { Hero } from '@/components/home/hero';
import { TermsCallout } from '@/components/home/welcome-sections';

/**
 * Home.
 *
 * Three sections: the welcome, the terms, and the two take-away resources
 * (the Wellness Journal and Naked Vows). Kept intentionally short.
 *
 * It used to run nine sections deep with the full service catalogue. A
 * counselling practice's front page is read by someone who is often already
 * tired, and asking them to scroll past a feature tour to find a phone number
 * was the wrong trade. Services, resources and workshops have their own pages.
 *
 * Nothing here queries the database, so it renders immediately.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TermsCallout />
      <ResourceCta />
    </>
  );
}
