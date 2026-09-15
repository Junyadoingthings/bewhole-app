'use client';

import * as React from 'react';
import { Check, ShieldCheck } from 'lucide-react';

import { COUNSELLING_CONSENT, BUSINESS, PRACTITIONER } from '@/config/business';
import { cn } from '@/lib/utils';

export function isConsentComplete(value: Record<string, boolean>): boolean {
  return COUNSELLING_CONSENT.items.every((item) => value[item.id]);
}

export function ConsentForm({
  value,
  onChange,
  showPrint = true,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  showPrint?: boolean;
}) {
  const allAgreed = isConsentComplete(value);

  const handleToggle = (id: string) => {
    onChange({
      ...value,
      [id]: !value[id],
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-foreground">Informed Consent</h2>
            <p className="text-sm text-muted-foreground">Before your first session with {PRACTITIONER.name}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Please read each point and confirm you agree. Each clause ensures transparency and confidentiality under {BUSINESS.name}.
        </p>
      </div>

      <div className="space-y-4">
        {COUNSELLING_CONSENT.items.map((item, index) => {
          const isChecked = !!value[item.id];
          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={cn(
                'cursor-pointer border rounded-2xl p-5 transition-all duration-200',
                isChecked
                  ? 'border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary'
                  : 'border-border/80 hover:border-border bg-background'
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-colors mt-0.5 shrink-0 shadow-sm',
                    isChecked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/50 bg-background hover:border-primary'
                  )}
                >
                  {isChecked && <Check className="w-4 h-4 stroke-[3.5]" />}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground/80 tracking-wider">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed pt-1">{item.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}