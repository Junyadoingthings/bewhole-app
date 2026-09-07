import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A resource cover — the real artwork when it exists, a designed placeholder
 * when it does not.
 *
 * The placeholder is not a grey box. It is a typographic cover in the brand's
 * own palette, so a page missing its artwork still looks finished rather than
 * broken. That matters here because these pages go live before the cover
 * files are supplied.
 */
export function ResourceCover({
  src,
  title,
  subtitle,
  tone = 'cream',
  priority = false,
  className,
  sizes,
}: {
  src: string | null;
  title: string;
  subtitle?: string;
  tone?: 'cream' | 'clay';
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={`${title} cover`}
        fill
        priority={priority}
        quality={88}
        sizes={sizes}
        className={cn('object-cover', className)}
      />
    );
  }

  return (
    <div
      aria-label={`${title} cover`}
      role="img"
      className={cn(
        'flex h-full w-full flex-col items-center justify-center px-4 text-center',
        tone === 'clay' ? 'bg-clay-100' : 'bg-cream-100',
        className,
      )}
    >
      <span
        className={cn(
          'font-display text-sm font-bold leading-tight sm:text-xl',
          tone === 'clay' ? 'text-clay-700' : 'text-forest-800',
        )}
      >
        {title}
      </span>
      {subtitle && (
        <span
          className={cn(
            'mt-2 text-[0.55rem] uppercase leading-relaxed tracking-[0.16em] sm:mt-3 sm:text-2xs',
            tone === 'clay' ? 'text-clay-600' : 'text-forest-700',
          )}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
