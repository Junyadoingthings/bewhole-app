'use client';

import * as React from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Form controls.
 *
 * Every input is rounded-2xl, sits on white, and states are communicated by
 * border colour plus an icon — never by colour alone, so the validation is
 * readable without colour vision.
 */

const baseField = [
  'w-full rounded-2xl border bg-white px-4 text-[0.95rem] text-ink',
  'placeholder:text-ink-faint',
  'transition-[border-color,box-shadow,background-color] duration-200 ease-calm',
  'focus:outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10',
  'disabled:cursor-not-allowed disabled:bg-cream-100 dark:disabled:bg-card disabled:text-ink-faint',
].join(' ');

export function Label({
  children,
  htmlFor,
  optional,
  hint,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-baseline justify-between gap-3', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {children}
        {optional && <span className="ml-1.5 text-xs font-normal text-ink-faint">Optional</span>}
      </label>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-state-danger">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</p>;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, icon, suffix, id, ...props },
  ref,
) {
  const errorId = error && id ? `${id}-error` : undefined;
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          baseField,
          'h-13 py-3',
          icon && 'pl-11',
          suffix && 'pr-12',
          error && 'border-state-danger/60 focus:border-state-danger focus:ring-state-danger/10',
          className,
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
          {suffix}
        </span>
      )}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, id, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && id ? `${id}-error` : undefined}
      className={cn(
        baseField,
        'min-h-[7.5rem] resize-y py-3.5 leading-relaxed',
        error && 'border-state-danger/60 focus:border-state-danger focus:ring-state-danger/10',
        className,
      )}
      {...props}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          baseField,
          'h-13 appearance-none py-3 pr-11',
          error && 'border-state-danger/60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
    </div>
  );
});

/** Large, tappable checkbox row — used for consent and preference toggles. */
export function CheckboxRow({
  id,
  checked,
  onChange,
  title,
  description,
  error,
  name,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  name?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer items-start gap-3.5 rounded-2xl border bg-white p-4 transition-colors duration-200',
          checked ? 'border-forest-400 bg-forest-50/40 dark:bg-forest-900/25' : 'border-line hover:border-line-strong',
          error && 'border-state-danger/60',
        )}
      >
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200 ease-calm',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-forest-600 peer-focus-visible:ring-offset-2',
              checked ? 'border-forest-700 bg-forest-700' : 'border-line-strong bg-white',
            )}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 text-pure transition-transform duration-200 ease-calm',
                checked ? 'scale-100' : 'scale-0',
              )}
              strokeWidth={3}
            />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{title}</span>
          {description && (
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{description}</span>
          )}
        </span>
      </label>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** Radio presented as a selectable card. Used across the booking wizard. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  icon,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group relative w-full rounded-2xl border bg-white p-5 text-left transition-all duration-250 ease-calm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2',
        selected
          ? 'border-forest-600 bg-forest-50/50 dark:bg-forest-900/30 shadow-subtle'
          : 'border-line hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-card',
        disabled && 'cursor-not-allowed opacity-45 hover:translate-y-0 hover:shadow-none',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-250',
              selected ? 'bg-forest-800 text-cream-100' : 'bg-cream-100 dark:bg-card text-forest-700 dark:text-forest-300',
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="font-medium text-ink">{title}</span>
            {meta && <span className="shrink-0 text-sm tabular text-ink-soft">{meta}</span>}
          </span>
          {description && (
            <span className="mt-1.5 block text-sm leading-relaxed text-ink-soft text-pretty">
              {description}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-250 ease-calm',
            selected ? 'border-forest-700 bg-forest-700' : 'border-line-strong bg-white',
          )}
        >
          <Check
            className={cn(
              'h-3 w-3 text-pure transition-transform duration-200 ease-calm',
              selected ? 'scale-100' : 'scale-0',
            )}
            strokeWidth={3}
          />
        </span>
      </div>
    </button>
  );
}
