import type { MetadataRoute } from 'next';

import { BUSINESS } from '@/config/business';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS.name} — ${BUSINESS.tagline}`,
    short_name: BUSINESS.name,
    description: BUSINESS.promise,
    start_url: '/portal',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FDFBF7',
    theme_color: '#0D3110',
    lang: 'en-ZA',
    categories: ['health', 'lifestyle', 'medical'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Book an appointment', url: '/book' },
      { name: 'My appointments', url: '/portal/appointments' },
    ],
  };
}
