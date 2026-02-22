/**
 * Site classification logic.
 *
 * Determines whether a site is a PWA (PWAPP), a web app with manifest (WAPP),
 * or a plain website (WS).
 * @module site-classifier
 */

/** @typedef {import('./manifest-schema.js').Manifest} Manifest */

/**
 * @typedef {'PWAPP' | 'WAPP' | 'WS'} SiteLevel
 * @typedef {{
 *   level: SiteLevel,
 *   hasManifest: boolean,
 *   hasServiceWorker: boolean,
 *   description: string
 * }} Classification
 */

/** @type {Record<SiteLevel, string>} */
const DESCRIPTIONS = {
  PWAPP: 'Progressive Web App — manifest and service worker detected',
  WAPP: 'Web App — manifest detected, no service worker',
  WS: 'Website — no manifest detected',
};

/**
 * Classify a site based on manifest and service worker presence.
 * @param {{ manifest: Manifest | null, sw: boolean }} input
 * @returns {{ success: true, data: Classification }}
 */
export function classifySite({ manifest, sw }) {
  const hasManifest = manifest !== null;
  const hasServiceWorker = sw;

  /** @type {SiteLevel} */
  let level;
  if (hasManifest && hasServiceWorker) {
    level = 'PWAPP';
  } else if (hasManifest) {
    level = 'WAPP';
  } else {
    level = 'WS';
  }

  return {
    success: true,
    data: {
      level,
      hasManifest,
      hasServiceWorker,
      description: DESCRIPTIONS[level],
    },
  };
}
