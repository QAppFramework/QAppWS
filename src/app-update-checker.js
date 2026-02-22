/**
 * App update checker — detects manifest changes for installed apps.
 *
 * Compares stored metadata against freshly fetched manifest data
 * to determine if an update is available.
 * @module app-update-checker
 */

import { classifyUrl } from './classify-pipeline.js';

/** @typedef {import('./app-metadata.js').AppMetadata} AppMetadata */
/** @typedef {import('./metadata-extractor.js').DisplayMetadata} DisplayMetadata */

/**
 * @typedef {{
 *   hasUpdate: boolean,
 *   changes: string[],
 * }} UpdateCheckResult
 */

/**
 * Normalize a display mode for comparison.
 * "browser" and undefined are equivalent (default).
 * @param {string | undefined} mode
 * @returns {string}
 */
function normalizeDisplayMode(mode) {
  if (!mode || mode === 'browser') return '';
  return mode;
}

/**
 * Normalize a nullable string for comparison.
 * null and undefined are equivalent (empty).
 * @param {string | null | undefined} val
 * @returns {string}
 */
function normalizeStr(val) {
  return val ?? '';
}

/**
 * Compare stored app metadata against freshly extracted metadata.
 *
 * Pure function — no network calls. Compares name, displayMode,
 * themeColor, startUrl, and scope.
 *
 * @param {AppMetadata} stored - Stored metadata from JSON file.
 * @param {DisplayMetadata} fresh - Freshly extracted metadata from pipeline.
 * @returns {UpdateCheckResult}
 */
export function compareMetadata(stored, fresh) {
  /** @type {string[]} */
  const changes = [];

  if (stored.name !== fresh.name) {
    changes.push('name');
  }

  if (normalizeDisplayMode(stored.displayMode) !== normalizeDisplayMode(fresh.displayMode)) {
    changes.push('displayMode');
  }

  if (normalizeStr(stored.themeColor) !== normalizeStr(fresh.themeColor)) {
    changes.push('themeColor');
  }

  // Compare startUrl: stored has resolved absolute, fresh has relative from manifest
  // We compare the raw manifest startUrl against the stored one
  if (normalizeStr(stored.startUrl) !== '' || normalizeStr(fresh.startUrl) !== '') {
    // If stored has startUrl, fresh must have one too and they must resolve to same thing
    const storedStart = normalizeStr(stored.startUrl);
    const freshStart = normalizeStr(fresh.startUrl);
    if (storedStart !== '' && freshStart !== '') {
      // Resolve fresh relative startUrl against the stored URL for comparison
      try {
        const resolved = new URL(freshStart, stored.url).href;
        if (storedStart !== resolved) {
          changes.push('startUrl');
        }
      } catch {
        if (storedStart !== freshStart) changes.push('startUrl');
      }
    } else if (storedStart !== freshStart) {
      changes.push('startUrl');
    }
  }

  if (normalizeStr(stored.scope) !== normalizeStr(fresh.scope)) {
    changes.push('scope');
  }

  return { hasUpdate: changes.length > 0, changes };
}

/**
 * Check a single installed app for manifest updates.
 *
 * Re-fetches the URL, runs the classify pipeline, and compares
 * the fresh metadata against stored values.
 *
 * @param {AppMetadata} stored - Stored metadata from JSON file.
 * @returns {Promise<{ success: true, data: UpdateCheckResult } | { success: false, error: string }>}
 */
export async function checkAppUpdate(stored) {
  const result = await classifyUrl(stored.url);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const comparison = compareMetadata(stored, result.data.metadata);
  return { success: true, data: comparison };
}
