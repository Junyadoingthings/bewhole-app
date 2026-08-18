import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Decorative artwork.
 *
 * The practice has no licensed photography library, so rather than dropping in
 * stock images that misrepresent the rooms and the people, the visual language
 * is built from botanical line work and soft organic fields. Where a real
 * photograph belongs, <ImageSlot> marks the space and names what goes there.
 */

/** Layered organic blobs — the warm backdrop behind large sections. */
export function OrganicField({
  className,
  tone = 'cream',
}: {
  className?: string;
  tone?: 'cream' | 'forest';
}) {
  const fills =
    tone === 'forest'
      ? ['#14401A', '#1B5220', '#24601C']
      : ['#F1EDE1', '#EDE7D6', '#E6DFC9'];

  return (
    <svg
      viewBox="0 0 600 600"
      className={cn('pointer-events-none absolute', className)}
      aria-hidden
      // `meet` keeps the blobs whole: `slice` would clip them into hard edges.
      preserveAspectRatio="xMidYMid meet"
    >
      <g opacity={tone === 'forest' ? 0.5 : 0.9}>
        <path
          fill={fills[0]}
          d="M472 118c46 52 74 128 55 191-19 63-85 113-152 137-67 24-135 22-186-11-51-33-85-97-79-160 6-63 52-125 111-158 59-33 131-37 175-15 44 22 60 68 76 16Z"
        />
        <path
          fill={fills[1]}
          opacity="0.75"
          d="M403 141c47 33 82 96 78 156-4 60-47 117-104 145-57 28-128 27-176-8-48-35-73-104-60-166 13-62 64-117 122-133 58-16 123 6 140 6Z"
        />
        <path
          fill={fills[2]}
          opacity="0.5"
          d="M356 178c40 24 66 76 62 124-4 48-38 92-83 113-45 21-101 19-137-9-36-28-53-82-42-130 11-48 50-90 96-101 46-11 99 9 104 3Z"
        />
      </g>
    </svg>
  );
}

/** Fine botanical line drawing used as a large watermark. */
export function BotanicalLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 420"
      className={cn('pointer-events-none absolute', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
    >
      <path d="M160 415C160 300 160 190 160 96" />
      {Array.from({ length: 7 }).map((_, i) => {
        const y = 110 + i * 42;
        const spread = 44 + i * 12;
        return (
          <g key={i}>
            <path d={`M160 ${y}C${160 - spread * 0.5} ${y - 8} ${160 - spread} ${y + 12} ${160 - spread - 12} ${y + 38}`} />
            <path
              d={`M160 ${y}C${160 - spread * 0.4} ${y + 4} ${160 - spread * 0.75} ${y + 26} ${160 - spread - 12} ${y + 38}`}
            />
            <path d={`M160 ${y + 20}C${160 + spread * 0.5} ${y + 12} ${160 + spread} ${y + 32} ${160 + spread + 12} ${y + 58}`} />
            <path
              d={`M160 ${y + 20}C${160 + spread * 0.4} ${y + 24} ${160 + spread * 0.75} ${y + 46} ${160 + spread + 12} ${y + 58}`}
            />
          </g>
        );
      })}
      <path d="M160 96C146 74 148 46 168 28C182 46 178 76 160 96Z" />
    </svg>
  );
}

/** Concentric arcs — a calm, quiet motif for headers and empty areas. */
export function ArcMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={cn('pointer-events-none absolute', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {[40, 68, 96, 124, 152].map((r, i) => (
        <circle key={r} cx="120" cy="120" r={r} opacity={0.5 - i * 0.07} />
      ))}
    </svg>
  );
}

/**
 * A deliberate placeholder for practice photography.
 * It is styled to belong in the layout, and labelled so nobody mistakes it for
 * a finished asset — swap the `src` in and the surrounding design is unchanged.
 */
export function ImageSlot({
  label,
  className,
  aspect = 'aspect-[4/5]',
  tone = 'cream',
}: {
  label: string;
  className?: string;
  aspect?: string;
  tone?: 'cream' | 'forest' | 'clay';
}) {
  const tones = {
    cream: 'from-cream-200 dark:from-canvas-sunk via-cream-100 dark:via-card to-cream-300 dark:to-line text-forest-700/45 dark:text-forest-300/45',
    forest: 'from-forest-800 via-forest-900 to-forest-950 text-forest-300/50',
    clay: 'from-clay-200 via-cream-100 dark:via-card to-clay-300 text-clay-600/45',
  }[tone];

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-3xl bg-gradient-to-br',
        tones,
        aspect,
        className,
      )}
    >
      <BotanicalLines className="-right-8 bottom-0 h-[85%] opacity-30" />
      <ArcMotif className="-left-10 -top-10 h-48 w-48 opacity-40" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-2xs font-medium uppercase tracking-[0.14em] text-ink-soft backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
          {label}
        </span>
      </div>
    </div>
  );
}

/** Thin decorative rule with a leaf terminal, used between editorial sections. */
export function LeafRule({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-hidden>
      <span className="h-px flex-1 bg-line" />
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-forest-400" fill="currentColor">
        <path d="M12 2c4 3.5 6 7 6 10.5S15.3 20 12 22c-3.3-2-6-5.9-6-9.5S8 5.5 12 2Z" />
      </svg>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
