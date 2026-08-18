/**
 * Practice photography.
 *
 * These are Be Whole Care's own images, supplied by the practice. Alt text
 * describes what is actually in each frame — it is never used to make a claim
 * about the people in it.
 *
 * `position` sets the object-position so a face is never cropped out when the
 * frame changes aspect ratio between breakpoints.
 */

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  position: string;
}

export const PHOTOS = {
  /** Couple in session with a practitioner, warm consulting room. */
  coupleSession: {
    src: '/images/session-couple.jpg',
    width: 1800,
    height: 1440,
    alt: 'A couple sitting together on a sofa in a Be Whole Care consulting room, speaking with a practitioner.',
    position: '58% 40%',
  },
  /** One-to-one session, practitioner listening with a notebook. */
  individualSession: {
    src: '/images/session-individual.jpg',
    width: 1800,
    height: 1440,
    alt: 'A Be Whole Care practitioner listening and taking notes during a one-to-one session.',
    position: '35% 40%',
  },
  /** Practitioner portrait — black. */
  practitioner: {
    src: '/images/practitioner-portrait.jpg',
    width: 1200,
    height: 1800,
    alt: 'A Be Whole Care practitioner.',
    position: '50% 28%',
  },
  /** Practitioner portrait — lilac. */
  practitionerAlt: {
    src: '/images/practitioner-portrait-alt.jpg',
    width: 1000,
    height: 1500,
    alt: 'A Be Whole Care practitioner.',
    position: '50% 26%',
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
