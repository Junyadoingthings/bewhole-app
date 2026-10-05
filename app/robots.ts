import type { MetadataRoute } from 'next';

const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5600').replace(/\/+$/, '');

/**
 * Public pages may be indexed; private areas may not. These are also sent
 * `noindex`, so this is a second, polite layer — never the access control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/portal', '/print', '/api', '/pay', '/book/confirmation'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
