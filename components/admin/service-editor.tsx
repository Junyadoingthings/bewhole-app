'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { CheckboxRow, Input, Label } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { updateServicePricing } from '@/app/actions/admin';
import type { Service } from '@/types';

/**
 * Prices are configurable, not hardcoded. The values that ship are the ones
 * published on the practice's site; from here they are the admin's to change.
 */
export function ServiceEditor({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();

  const [inPerson, setInPerson] = React.useState(String(service.priceInPersonCents / 100));
  const [online, setOnline] = React.useState(String(service.priceOnlineCents / 100));
  const [active, setActive] = React.useState(service.active);
  const [busy, setBusy] = React.useState(false);

  const dirty =
    Number(inPerson) !== service.priceInPersonCents / 100 ||
    Number(online) !== service.priceOnlineCents / 100 ||
    active !== service.active;

  async function save() {
    setBusy(true);
    const result = await updateServicePricing(service.id, {
      priceInPersonRands: Number(inPerson),
      priceOnlineRands: Number(online),
      active,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not save', description: result.error });
      return;
    }
    toast({ tone: 'success', title: `${service.name} updated` });
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg text-ink">{service.name}</h3>
            {service.requiresQuote && (
              <Badge tone="info" size="sm">
                Quoted after intake
              </Badge>
            )}
            {service.rateBand === 'free' && (
              <Badge tone="success" size="sm">
                Free
              </Badge>
            )}
            {!service.active && (
              <Badge tone="neutral" size="sm">
                Hidden
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-soft">{service.summary}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {service.durationMinutes} minutes ·{' '}
            {[service.allowsOnline && 'online', service.allowsInPerson && 'in person']
              .filter(Boolean)
              .join(' & ')}
          </p>
        </div>
      </div>

      {service.requiresQuote || service.rateBand === 'free' ? (
        <p className="mt-5 rounded-2xl bg-cream-100 dark:bg-card p-4 text-sm leading-relaxed text-ink-muted">
          {service.intakeNote}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${service.id}-inperson`}>In person</Label>
            <Input
              id={`${service.id}-inperson`}
              type="number"
              min={0}
              step={10}
              value={inPerson}
              onChange={(e) => setInPerson(e.target.value)}
              icon={<span className="text-sm">R</span>}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor={`${service.id}-online`}>Online</Label>
            <Input
              id={`${service.id}-online`}
              type="number"
              min={0}
              step={10}
              value={online}
              onChange={(e) => setOnline(e.target.value)}
              icon={<span className="text-sm">R</span>}
              disabled={!canEdit}
            />
          </div>
        </div>
      )}

      {canEdit && (
        <>
          <div className="mt-5">
            <CheckboxRow
              id={`${service.id}-active`}
              checked={active}
              onChange={setActive}
              title="Bookable"
              description="Turn this off to hide the service from the site and booking flow."
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button size="sm" onClick={save} disabled={!dirty || busy} loading={busy}>
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
