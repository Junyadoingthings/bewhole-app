import type { Config } from 'tailwindcss';

/**
 * Be Whole Care design system.
 *
 * The palette is lifted from the live brand: deep forest greens (the leaf mark),
 * a warm cream (rgb(249,236,214) on the site) and the clay-brown wordmark.
 *
 * ── Light and dark ────────────────────────────────────────────────────────
 * The palette is deliberately split in two.
 *
 *   BRAND ramps (forest, cream, clay) are FIXED hex. They never change between
 *   themes. This is not laziness — `text-cream-100` appears over a hundred
 *   times as the label on a deep-green button or over a photo scrim, and
 *   `from-forest-950/85` is what makes those scrims dark. Inverting either ramp
 *   would turn every one of those into dark-on-dark.
 *
 *   NEUTRALS (canvas, card, ink, line, surface, state) are CSS variables
 *   defined in globals.css and re-pointed under `.dark`. These carry the whole
 *   theme flip, which is why `bg-white` — used ~150 times to mean "raised
 *   surface" — is mapped to the card variable rather than to literal white.
 *
 * The consequence to remember: a colour that must stay light on a dark
 * background belongs to the brand ramp; a colour that describes page chrome
 * belongs to the neutrals. Putting one in the other's place breaks a theme.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#F1F7EE',
          100: '#DCEDD6',
          200: '#B6DBAC',
          300: '#7FBB72',
          400: '#4E9A45',
          500: '#2F7A2A',
          600: '#24601C',
          700: '#1B5220',
          800: '#14401A',
          900: '#0D3110',
          950: '#07200A',
        },
        cream: {
          50: '#FDFBF7',
          100: '#F9F3E9',
          200: '#F9ECD6',
          300: '#EFE0C6',
          400: '#E2CEAC',
        },
        clay: {
          200: '#E4D3C9',
          300: '#C4A796',
          500: '#8A6350',
          600: '#6B4A3A',
          700: '#503428',
        },
        /* ---- neutrals: these are what actually flip between themes ---- */

        // `bg-white` reads as "raised surface" everywhere in this codebase, so
        // it is mapped to the card token. Genuine, never-changing white is
        // `text-pure` / `bg-pure` below — used only on brand-coloured buttons.
        white: 'rgb(var(--c-card) / <alpha-value>)',
        pure: '#FFFFFF',

        canvas: {
          DEFAULT: 'rgb(var(--c-canvas) / <alpha-value>)',
          sunk: 'rgb(var(--c-canvas-sunk) / <alpha-value>)',
        },
        card: 'rgb(var(--c-card) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          strong: 'rgb(var(--c-line-strong) / <alpha-value>)',
          soft: 'rgb(var(--c-line-soft) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--c-card) / <alpha-value>)',
          sunk: 'rgb(var(--c-canvas-sunk) / <alpha-value>)',
          raised: 'rgb(var(--c-card) / <alpha-value>)',
        },
        state: {
          success: 'rgb(var(--c-success) / <alpha-value>)',
          successSoft: 'rgb(var(--c-success-soft) / <alpha-value>)',
          warning: 'rgb(var(--c-warning) / <alpha-value>)',
          warningSoft: 'rgb(var(--c-warning-soft) / <alpha-value>)',
          danger: 'rgb(var(--c-danger) / <alpha-value>)',
          dangerSoft: 'rgb(var(--c-danger-soft) / <alpha-value>)',
          info: 'rgb(var(--c-info) / <alpha-value>)',
          infoSoft: 'rgb(var(--c-info-soft) / <alpha-value>)',
          neutral: 'rgb(var(--c-neutral) / <alpha-value>)',
          neutralSoft: 'rgb(var(--c-neutral-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        // Sans fallbacks: the display face is Poppins now, and a Georgia
        // fallback meant a serif flashed before the webfont loaded.
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
        display: ['clamp(2.75rem, 6.5vw, 5.25rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        headline: ['clamp(2rem, 4.2vw, 3.5rem)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        title: ['clamp(1.5rem, 2.6vw, 2.25rem)', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        sm: '0.625rem',
        DEFAULT: '0.875rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.75rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
        '4xl': '3rem',
      },
      spacing: {
        // Half-steps and control heights the default scale is missing.
        4.5: '1.125rem',
        13: '3.25rem',
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
        section: 'clamp(4.5rem, 9vw, 8.5rem)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '82rem',
      },
      /**
       * Shadows are whole values held in CSS variables, defined per theme in
       * globals.css — not a shared colour with a per-theme multiplier.
       *
       * That was tried and it silently failed: a `calc()` in the alpha slot of
       * `rgb(... / ...)` does not survive Tailwind's shadow processing, and
       * every shadow in the app computed to rgba(0,0,0,0). Nothing errored;
       * the shadows were simply gone. Keep the full value in the variable.
       */
      boxShadow: {
        subtle: 'var(--sh-subtle)',
        card: 'var(--sh-card)',
        lifted: 'var(--sh-lifted)',
        float: 'var(--sh-float)',
        ring: 'var(--sh-ring)',
        inset: 'var(--sh-inset)',
        dock: 'var(--sh-dock)',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 1, 0.36, 1)',
        gentle: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'leaf-fade':
          'radial-gradient(120% 90% at 50% 0%, rgb(var(--c-fade-1)) 0%, rgb(var(--c-fade-2)) 55%, rgb(var(--c-fade-3)) 100%)',
        'forest-deep': 'linear-gradient(155deg, #14401A 0%, #0D3110 55%, #07200A 100%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        drift: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'draw-check': {
          to: { strokeDashoffset: '0' },
        },
        /**
         * A slow ring pushing outward from the WhatsApp button, like a radar
         * sweep. Scale and fade only — both composited, so it costs nothing
         * per frame and cannot cause layout work while the page scrolls.
         */
        beacon: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        /** A gentle brightening of the button itself, in sympathy. */
        'beacon-core': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37, 211, 102, 0)' },
          '50%': { boxShadow: '0 0 22px 4px rgba(37, 211, 102, 0.45)' },
        },
        /**
         * Same brightening, in white — for the dock's Sign in tab. `beacon`
         * (the expanding ring, above) is already colour-neutral and is reused
         * as-is with a white-tinted ring element; only the glow needs its own
         * variant because its colour is baked into the box-shadow.
         */
        'beacon-core-white': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0)' },
          '50%': { boxShadow: '0 0 16px 3px rgba(255, 255, 255, 0.85)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        drift: 'drift 7s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        'draw-check': 'draw-check 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards',
        beacon: 'beacon 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'beacon-core': 'beacon-core 2.8s ease-in-out infinite',
        'beacon-core-white': 'beacon-core-white 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
