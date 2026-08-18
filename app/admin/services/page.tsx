import type { Metadata } from 'next';

import { ServiceEditor } from '@/components/admin/service-editor';
import { ServiceIcon } from '@/components/site/service-icon';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { listAllServices, listCategories, listLocations } from '@/lib/db';

export const metadata: Metadata = { title: 'Services', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const user = await requireStaff();
  const canEdit = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  const [categories, services, locations] = await Promise.all([
    listCategories(),
    listAllServices(),
    listLocations(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Services & pricing</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Prices here drive the website, the booking flow and every invoice. Changes take effect
          immediately.
          {!canEdit && ' You need administrator access to change them.'}
        </p>
      </Reveal>

      <div className="mt-8 space-y-10">
        {categories.map((category) => {
          const inCategory = services.filter((s) => s.categoryId === category.id);
          if (inCategory.length === 0) return null;
          return (
            <section key={category.id}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <ServiceIcon name={category.icon} className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="font-display text-xl text-ink">{category.name}</h2>
                  <p className="text-sm text-ink-soft">{category.summary}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {inCategory.map((service) => (
                  <ServiceEditor key={service.id} service={service} canEdit={canEdit} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl text-ink">Practices</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {locations.map((location) => (
            <div key={location.id} className="rounded-3xl border border-line bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-ink">{location.name}</h3>
                <Badge tone="success" size="sm">
                  Active
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {location.addressLine}
                <br />
                {location.city}, {location.postalCode}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
