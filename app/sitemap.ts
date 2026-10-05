import type { MetadataRoute } from 'next';

import { listCategories } from '@/lib/db';

const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5600').replace(/\/+$/, '');

export const revalidate = 86400;

/** The public pages, plus one per active service category. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/services', '/about', '/contact', '/book', '/consent', '/privacy', '/terms'];
  // A sitemap must never fail the page: without the database it lists the
  // fixed pages only.
  const categories = await listCategories().catch(() => []);
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'monthly' as const })),
    ...categories.map((c) => ({ url: `${base}/services/${c.slug}`, changeFrequency: 'monthly' as const })),
  ];
}
