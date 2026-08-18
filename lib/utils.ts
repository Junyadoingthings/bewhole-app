import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format cents as South African Rand. All money is cents end to end. */
export function money(cents: number, opts: { decimals?: boolean } = {}) {
  const value = cents / 100;
  const decimals = opts.decimals ?? value % 1 !== 0;
  return `R${value.toLocaleString('en-ZA', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

export function initials(first?: string | null, last?: string | null) {
  return `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || '—';
}

export function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Cheap, dependency-free slug for admin-authored content. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function truncate(input: string, max = 120) {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}

/** Format a SA mobile number for display: 063 883 7170 */
export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('27'))
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return raw;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}
