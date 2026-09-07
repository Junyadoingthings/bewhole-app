import 'server-only';

/**
 * Is this the real, public deployment?
 *
 * Vercel sets VERCEL_ENV to 'production' only for the production deployment;
 * previews report 'preview'. NODE_ENV is checked too so a self-hosted
 * production build is treated the same way.
 *
 * Preview deployments deliberately count as non-production: they are where the
 * simulated gateway is useful, and no client ever books through them.
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}
