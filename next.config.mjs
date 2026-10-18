/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Only the site's own images (public/) are optimised: no remote hosts, and
    // no AVIF — both are attack surface in Next.js's image optimiser and the
    // site needs neither.
    formats: ['image/webp'],
  },
  async redirects() {
    return [
      // The separate privacy page was folded into the terms (2026-10, at the
      // practice's request); old links land on that section.
      { source: '/privacy', destination: '/terms#privacy', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // A narrow policy that breaks nothing: no plugins, no <base> hijacking,
          // and no framing by other sites (X-Frame-Options' modern equivalent).
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
        ],
      },
      {
        // Never let a proxy or browser cache authenticated surfaces.
        source: '/(portal|admin)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
