import { ResourceCta } from '@/components/home/resource-cta';
import { Hero } from '@/components/home/hero';
import { TermsCallout } from '@/components/home/welcome-sections';

/**
 * Home.
 *
 * Three sections: the welcome, the terms, and the two take-away resources
 * (the Wellness Journal and Naked Vows). Kept intentionally short.
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