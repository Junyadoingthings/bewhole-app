'use client';

import * as React from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Buttons are pill-shaped throughout the product. The press animation is a
 * 1% scale — enough to feel responsive, small enough never to read as bouncy.
 */
const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium',
    'transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-calm',
    'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
    'whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-forest-800 text-cream-100 shadow-subtle hover:bg-forest-900 hover:shadow-card',
        secondary:
          'bg-white text-ink border border-line-strong shadow-subtle hover:border-forest-300 hover:bg-cream-50 dark:hover:bg-canvas',
        ghost: 'text-ink-muted hover:bg-cream-100 dark:hover:bg-card hover:text-ink',
        quiet: 'text-forest-700 dark:text-forest-300 hover:text-forest-900 dark:hover:text-forest-200 hover:bg-forest-50 dark:hover:bg-forest-900/30',
        cream: 'bg-cream-200 dark:bg-canvas-sunk text-forest-900 dark:text-forest-200 hover:bg-cream-300 dark:hover:bg-line',
        outline:
          'border border-forest-800/25 text-forest-900 dark:text-forest-200 hover:border-forest-800/60 hover:bg-forest-50 dark:hover:bg-forest-900/30',
        onDark:
          'bg-cream-100 dark:bg-card text-forest-900 dark:text-forest-200 hover:bg-white shadow-subtle',
        onDarkGhost:
          'border border-cream-100/25 text-cream-100 hover:border-cream-100/60 hover:bg-cream-100/10',
        danger: 'bg-state-danger text-canvas hover:brightness-95',
        dangerQuiet:
          'border border-state-danger/25 text-state-danger hover:bg-state-dangerSoft',
      },
      size: {
        xs: 'h-8 px-3 text-xs',
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-[0.95rem]',
        xl: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
        iconSm: 'h-8 w-8',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, full, loading, loadingText, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & { className?: string };

export function ButtonLink({ className, variant, size, full, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, full }), className)} {...props} />;
}

export { buttonVariants };
