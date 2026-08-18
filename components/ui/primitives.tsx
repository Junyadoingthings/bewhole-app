import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------- card */

const cardVariants = cva('relative transition-shadow duration-300 ease-calm', {
  variants: {
    variant: {
      plain: 'bg-white border border-line',
      sunk: 'bg-cream-100/70 dark:bg-card/70 border border-line-soft',
      raised: 'bg-white border border-line shadow-card',
      forest: 'bg-forest-900 text-cream-100 border border-forest-800',
      outline: 'border border-line bg-transparent',
      ghost: 'bg-transparent',
    },
    radius: {
      md: 'rounded-lg',
      lg: 'rounded-xl',
      xl: 'rounded-2xl',
      '2xl': 'rounded-3xl',
      '3xl': 'rounded-4xl',
    },
    pad: {
      none: '',
      sm: 'p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
      xl: 'p-7 sm:p-10',
    },
  },
  defaultVariants: { variant: 'plain', radius: 'xl', pad: 'md' },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, radius, pad, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, radius, pad }), className)} {...props} />;
}

/* ------------------------------------------------------------------ badge */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-state-neutralSoft text-ink-muted',
        success: 'bg-state-successSoft text-forest-700 dark:text-forest-300',
        warning: 'bg-state-warningSoft text-state-warning',
        danger: 'bg-state-dangerSoft text-state-danger',
        info: 'bg-state-infoSoft text-state-info',
        forest: 'bg-forest-900 text-cream-100',
        cream: 'bg-cream-200 dark:bg-canvas-sunk text-forest-800 dark:text-forest-200',
        outline: 'border border-line-strong text-ink-muted',
      },
      size: {
        sm: 'px-2 py-1 text-2xs uppercase tracking-[0.1em]',
        md: 'px-2.5 py-1.5 text-xs',
        lg: 'px-3 py-2 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/* --------------------------------------------------------------- skeleton */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden {...props} />;
}

/** Standard loading shape for a list of cards. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-cream-50/60 dark:bg-card/60 text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-forest-600 dark:text-forest-300 shadow-subtle">
          {icon}
        </div>
      )}
      <p className="font-display text-lg text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft text-pretty">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- typography */

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' && 'items-center text-center',
        action && 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="text-title text-ink text-balance">{title}</h2>
        {lead && (
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft text-pretty">{lead}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} aria-hidden />;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  icon?: React.ReactNode;
}) {
  const toneClass = {
    neutral: 'text-ink',
    positive: 'text-forest-600 dark:text-forest-300',
    warning: 'text-state-warning',
    danger: 'text-state-danger',
  }[tone];

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">{label}</p>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <p className={cn('mt-3 font-display text-3xl tabular', toneClass)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
