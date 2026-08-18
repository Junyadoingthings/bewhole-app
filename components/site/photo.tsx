'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

import type { Photo as PhotoType } from '@/config/photos';
import { cn } from '@/lib/utils';

/**
 * Photography primitives.
 *
 * Every photo is warmed the same way — a faint cream wash and a grain layer —
 * so the practice's images sit inside the palette instead of fighting it.
 *
 * Reveal animations only ever move or veil the image; they never take it to
 * opacity 0. If an animation frame never arrives (throttled tab, low-power
 * mode) the photograph is still on screen.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function Photo({
  photo,
  className,
  imageClassName,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  priority,
  zoom,
  tone = 'warm',
  children,
}: {
  photo: PhotoType;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** Slow scale on hover — only for photos inside a link or card. */
  zoom?: boolean;
  tone?: 'warm' | 'forest' | 'none';
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('group/photo relative isolate overflow-hidden bg-cream-200 dark:bg-canvas-sunk', className)}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={82}
        style={{ objectPosition: photo.position }}
        className={cn(
          'object-cover',
          zoom &&
            'transition-transform duration-700 ease-calm group-hover/photo:scale-[1.04]',
          imageClassName,
        )}
      />

      {/* Palette wash: keeps every image inside the brand's warmth. */}
      {tone === 'warm' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cream-200/10 mix-blend-multiply"
        />
      )}
      {tone === 'forest' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-forest-950/25 mix-blend-multiply"
        />
      )}

      {/* Fine grain stops large flat areas looking digital. */}
      <div aria-hidden className="photo-grain pointer-events-none absolute inset-0" />

      {children}
    </div>
  );
}

/**
 * Scroll reveal for a photograph: a cream veil lifts and the frame settles up.
 * The image itself never fades, so a frozen animation still shows the photo.
 */
export function PhotoReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={cn('relative', className)}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-80px 0px' }}
      variants={{ hidden: { y: 18 }, shown: { y: 0 } }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-cream-50 dark:bg-canvas"
        variants={{ hidden: { opacity: 0.55 }, shown: { opacity: 0 } }}
        transition={{ duration: 1, ease: EASE, delay: delay + 0.05 }}
      />
    </motion.div>
  );
}

/**
 * Gentle vertical parallax. The image is rendered taller than its frame and
 * drifts within it, so no edge is ever exposed at either end of the range.
 */
export function ParallaxPhoto({
  photo,
  className,
  sizes,
  priority,
  distance = 40,
  tone = 'warm',
  children,
}: {
  photo: PhotoType;
  className?: string;
  sizes?: string;
  priority?: boolean;
  distance?: number;
  tone?: 'warm' | 'forest' | 'none';
  children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <div ref={ref} className={cn('relative isolate overflow-hidden bg-cream-200 dark:bg-canvas-sunk', className)}>
      <motion.div
        className="absolute inset-x-0"
        style={{
          top: reduced ? 0 : -distance,
          bottom: reduced ? 0 : -distance,
          y: reduced ? 0 : y,
        }}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes ?? '(min-width: 1024px) 50vw, 100vw'}
          priority={priority}
          quality={82}
          style={{ objectPosition: photo.position }}
          className="object-cover"
        />
      </motion.div>

      {tone === 'warm' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cream-200/10 mix-blend-multiply"
        />
      )}
      {tone === 'forest' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-forest-950/30 mix-blend-multiply"
        />
      )}
      <div aria-hidden className="photo-grain pointer-events-none absolute inset-0" />

      {children}
    </div>
  );
}

/** Bottom-up scrim so type stays readable over any photograph. */
export function PhotoScrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/30 to-transparent',
        className,
      )}
    />
  );
}
